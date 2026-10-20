-- D-10: create the initial invoice draft on SO confirmation and allow safe draft edits.
-- Issuance/accounting remains exclusively in post_customer_invoice_to_ar().

begin;

-- One editable draft per SO; issued invoices can still be split across multiple invoices.
-- Creation fails safely if legacy data contains duplicate active drafts requiring reconciliation.
create unique index if not exists sales_invoices_one_draft_per_so_uq
  on public.sales_invoices (sales_order_id) where status = 'draft';

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

  select * into v_invoice from public.sales_invoices where id=p_customer_invoice_id for update;
  if not found then raise exception using errcode='P0002', message='Customer invoice not found'; end if;
  if v_invoice.status<>'draft' then raise exception using errcode='22023', message='Only a draft invoice can be edited'; end if;
  select * into v_so from public.sales_orders where id=v_invoice.sales_order_id for update;
  if not found or v_so.status<>'confirmed' then raise exception using errcode='22023', message='Invoice must reference a confirmed sales order'; end if;
  if p_invoice_date<v_so.order_date then raise exception using errcode='22023', message='Invoice date cannot be before the SO date'; end if;

  select count(*) into v_expected from jsonb_array_elements(p_lines);
  delete from public.sales_invoice_lines where sales_invoice_id=v_invoice.id;

  for v_line in
    select sol.*, (x.value->>'quantity')::numeric requested_quantity
    from jsonb_array_elements(p_lines) x
    join public.sales_order_lines sol on sol.id=(x.value->>'sales_order_line_id')::uuid
    where sol.sales_order_id=v_so.id
    order by sol.line_number for update of sol
  loop
    v_count:=v_count+1;
    if v_line.requested_quantity<=0 or v_line.requested_quantity<>round(v_line.requested_quantity,4) then
      raise exception using errcode='22023', message='Invoice quantity must be positive with at most four decimals';
    end if;
    if v_line.quantity<=0 or v_line.line_total is null then
      raise exception using errcode='23514', message='Selected SO line has invalid quantity or total';
    end if;
    select coalesce(sum(l.quantity),0),coalesce(sum(l.line_total),0)
      into v_prior_qty,v_prior_total
    from public.sales_invoice_lines l join public.sales_invoices i on i.id=l.sales_invoice_id
    where l.sales_order_line_id=v_line.id and i.id<>v_invoice.id and i.status<>'void';
    if v_prior_qty+v_line.requested_quantity>v_line.quantity then
      raise exception using errcode='23514', message='Invoiced quantity would exceed SO line quantity';
    end if;
    if v_prior_qty+v_line.requested_quantity=v_line.quantity then
      v_amount:=v_line.line_total-v_prior_total;
    else
      v_amount:=round(v_line.line_total*v_line.requested_quantity/v_line.quantity,2);
    end if;
    if v_amount<0 then raise exception using errcode='23514', message='Allocated invoice amount is invalid'; end if;
    insert into public.sales_invoice_lines(
      sales_invoice_id,line_number,sales_order_line_id,customer_product_price_id,price_overridden,
      product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,unit_price_snapshot,line_total
    ) values (
      v_invoice.id,v_count::integer,v_line.id,v_line.customer_product_price_id,v_line.price_overridden,
      v_line.product_code_snapshot,v_line.product_name_snapshot,v_line.unit_snapshot,
      v_line.requested_quantity,v_line.unit_price_snapshot,v_amount
    );
  end loop;
  if v_count<>v_expected then raise exception using errcode='23514', message='Every invoice line must belong to this SO'; end if;
  select coalesce(sum(line_total),0) into v_subtotal from public.sales_invoice_lines where sales_invoice_id=v_invoice.id;
  update public.sales_invoices set invoice_date=p_invoice_date,
    due_date=p_invoice_date+v_so.payment_terms_days_snapshot,
    notes=nullif(btrim(p_notes),''),subtotal_amount=v_subtotal,total_amount=v_subtotal,tax_amount=0
    where id=v_invoice.id;
  return v_invoice.id;
end;
$$;

revoke all on function public.update_customer_invoice_draft(uuid,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.update_customer_invoice_draft(uuid,date,text,jsonb) to authenticated;

create function app_private.create_draft_customer_invoice_on_so_confirmation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_lines jsonb;
begin
  if old.status is distinct from 'confirmed' and new.status='confirmed' then
    if not exists(select 1 from public.sales_invoices i where i.sales_order_id=new.id) then
      select jsonb_agg(jsonb_build_object('sales_order_line_id',l.id,'quantity',l.quantity) order by l.line_number)
        into v_lines from public.sales_order_lines l where l.sales_order_id=new.id;
      if v_lines is not null and jsonb_array_length(v_lines)>0 then
        perform public.create_customer_invoice(new.id,current_date,
          'Draf dibuat otomatis saat pesanan dikonfirmasi; tinjau kuantitas sebelum diterbitkan.',v_lines);
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.create_draft_customer_invoice_on_so_confirmation() from public,anon,authenticated;
drop trigger if exists sales_orders_create_customer_invoice_on_confirmation on public.sales_orders;
create trigger sales_orders_create_customer_invoice_on_confirmation
  after update of status on public.sales_orders
  for each row when (old.status is distinct from 'confirmed' and new.status='confirmed')
  execute function app_private.create_draft_customer_invoice_on_so_confirmation();

comment on function public.update_customer_invoice_draft(uuid,date,text,jsonb) is
  'Edits draft invoice lines/date/notes; active cumulative SO quantities and values remain capped.';
comment on function app_private.create_draft_customer_invoice_on_so_confirmation() is
  'Creates an initial draft invoice on SO transition to confirmed; does not issue or post accounting.';

notify pgrst,'reload schema';
commit;
