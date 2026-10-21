-- D-10 hardening: cap cumulative invoice value as well as quantity per SO line.
-- Keeps the SO-first lock order introduced by 20261021152000_d10_invoice_lock_order.sql.
-- This migration only replaces the draft-edit RPC; it does not modify existing data.

begin;

create or replace function public.update_customer_invoice_draft(
  p_customer_invoice_id uuid,
  p_invoice_date date,
  p_notes text,
  p_lines jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_invoice public.sales_invoices%rowtype;
  v_so public.sales_orders%rowtype;
  v_invoice_so_id uuid;
  v_expected bigint;
  v_count bigint := 0;
  v_line record;
  v_prior_qty numeric(20,4);
  v_prior_total numeric(20,2);
  v_amount numeric(20,2);
  v_subtotal numeric(20,2);
begin
  if not app_private.has_business_role(array['owner','admin']) then
    raise exception using errcode='42501', message='Owner/Admin role required';
  end if;
  if p_customer_invoice_id is null or p_invoice_date is null or
     p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then
    raise exception using errcode='22023', message='Invoice, date and at least one line are required';
  end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x
    where jsonb_typeof(x.value)<>'object' or nullif(x.value->>'sales_order_line_id','') is null
       or nullif(x.value->>'quantity','') is null) then
    raise exception using errcode='22023', message='Each line requires sales_order_line_id and quantity';
  end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x group by x.value->>'sales_order_line_id' having count(*)>1) then
    raise exception using errcode='22023', message='A sales order line may appear only once';
  end if;

  -- Read association without locking; then consistently lock SO before invoice.
  select i.sales_order_id into v_invoice_so_id
  from public.sales_invoices i where i.id=p_customer_invoice_id;
  if not found then
    raise exception using errcode='P0002', message='Customer invoice not found';
  end if;

  select * into v_so from public.sales_orders where id=v_invoice_so_id for update;
  if not found or v_so.status<>'confirmed' then
    raise exception using errcode='22023', message='Invoice must reference a confirmed sales order';
  end if;

  select * into v_invoice from public.sales_invoices where id=p_customer_invoice_id for update;
  if not found then
    raise exception using errcode='P0002', message='Customer invoice not found';
  end if;
  if v_invoice.sales_order_id is distinct from v_invoice_so_id then
    raise exception using errcode='40001', message='Invoice sales order changed; retry the operation';
  end if;
  if v_invoice.status<>'draft' then
    raise exception using errcode='22023', message='Only a draft invoice can be edited';
  end if;
  if p_invoice_date<v_so.order_date then
    raise exception using errcode='22023', message='Invoice date cannot be before the SO date';
  end if;

  select count(*) into v_expected from jsonb_array_elements(p_lines);
  delete from public.sales_invoice_lines where sales_invoice_id=v_invoice.id;

  for v_line in
    select sol.*, (x.value->>'quantity')::numeric requested_quantity
    from jsonb_array_elements(p_lines) x
    join public.sales_order_lines sol on sol.id=(x.value->>'sales_order_line_id')::uuid
    where sol.sales_order_id=v_so.id
    order by sol.line_number
    for update of sol
  loop
    v_count:=v_count+1;
    if v_line.requested_quantity<=0 or v_line.requested_quantity<>round(v_line.requested_quantity,4) then
      raise exception using errcode='22023', message='Invoice quantity must be positive with at most four decimals';
    end if;
    if v_line.quantity<=0 or v_line.line_total is null or v_line.line_total<0 then
      raise exception using errcode='23514', message='Selected SO line has invalid quantity or total';
    end if;

    select coalesce(sum(l.quantity),0),coalesce(sum(l.line_total),0)
      into v_prior_qty,v_prior_total
    from public.sales_invoice_lines l
    join public.sales_invoices i on i.id=l.sales_invoice_id
    where l.sales_order_line_id=v_line.id
      and i.id<>v_invoice.id
      and i.status<>'void';

    if v_prior_qty+v_line.requested_quantity>v_line.quantity then
      raise exception using errcode='23514', message='Invoiced quantity would exceed SO line quantity';
    end if;
    if v_prior_total<0 or v_prior_total>v_line.line_total then
      raise exception using errcode='23514', message='Existing invoice value exceeds SO line value; reconcile invoices before editing';
    end if;

    if v_prior_qty+v_line.requested_quantity=v_line.quantity then
      v_amount:=v_line.line_total-v_prior_total;
    else
      v_amount:=round(v_line.line_total*v_line.requested_quantity/v_line.quantity,2);
    end if;
    if v_amount<0 or v_prior_total+v_amount>v_line.line_total then
      raise exception using errcode='23514', message='Cumulative invoice value would exceed SO line value';
    end if;

    insert into public.sales_invoice_lines(
      sales_invoice_id,line_number,sales_order_line_id,customer_product_price_id,price_overridden,
      product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,unit_price_snapshot,line_total
    ) values (
      v_invoice.id,v_count::integer,v_line.id,v_line.customer_product_price_id,v_line.price_overridden,
      v_line.product_code_snapshot,v_line.product_name_snapshot,v_line.unit_snapshot,
      v_line.requested_quantity,v_line.unit_price_snapshot,v_amount
    );
  end loop;

  if v_count<>v_expected then
    raise exception using errcode='23514', message='Every invoice line must belong to this SO';
  end if;

  select coalesce(sum(line_total),0) into v_subtotal
  from public.sales_invoice_lines where sales_invoice_id=v_invoice.id;

  update public.sales_invoices
  set invoice_date=p_invoice_date,
      due_date=p_invoice_date+v_so.payment_terms_days_snapshot,
      notes=nullif(btrim(p_notes),''),
      subtotal_amount=v_subtotal,
      total_amount=v_subtotal,
      tax_amount=0
  where id=v_invoice.id;

  return v_invoice.id;
end;
$$;

revoke all on function public.update_customer_invoice_draft(uuid,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.update_customer_invoice_draft(uuid,date,text,jsonb) to authenticated;

comment on function public.update_customer_invoice_draft(uuid,date,text,jsonb) is
  'Edits draft invoice with SO-first locking and enforces cumulative active invoice quantity and value caps per SO line.';

notify pgrst,'reload schema';
commit;
