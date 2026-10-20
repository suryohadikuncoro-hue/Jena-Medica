-- D-10: create a draft invoice when an SO is confirmed and support editing that draft.
-- Invoice issuance remains handled by post_customer_invoice_to_ar(), which enforces the
-- accounting-period/profile gate and records the journal atomically.

begin;

create or replace function public.update_customer_invoice_draft(
  p_customer_invoice_id uuid,
  p_invoice_date date,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.sales_invoices%rowtype;
  v_sales_order public.sales_orders%rowtype;
  v_line_count bigint := 0;
  v_expected_line_count bigint;
  v_source record;
  v_prior_quantity numeric(20,4);
  v_prior_total numeric(20,2);
  v_line_total numeric(20,2);
  v_subtotal numeric(20,2);
begin
  if not app_private.has_business_role(array['owner','admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_customer_invoice_id is null or p_invoice_date is null
     or p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array'
     or pg_catalog.jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'Invoice, date and at least one line are required';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'object'
       or nullif(item.value->>'sales_order_line_id','') is null
       or nullif(item.value->>'quantity','') is null
  ) then
    raise exception using errcode = '22023', message = 'Each line requires sales_order_line_id and quantity';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) item(value)
    group by item.value->>'sales_order_line_id' having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A sales order line may appear only once';
  end if;

  select * into v_invoice from public.sales_invoices
  where id = p_customer_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Customer invoice not found'; end if;
  if v_invoice.status <> 'draft' then
    raise exception using errcode = '22023', message = 'Only a draft invoice can be edited';
  end if;

  select * into v_sales_order from public.sales_orders
  where id = v_invoice.sales_order_id for update;
  if not found or v_sales_order.status <> 'confirmed' then
    raise exception using errcode = '22023', message = 'Invoice must reference a confirmed sales order';
  end if;
  if p_invoice_date < v_sales_order.order_date then
    raise exception using errcode = '22023', message = 'Invoice date cannot be before the sales order date';
  end if;

  select count(*) into v_expected_line_count from pg_catalog.jsonb_array_elements(p_lines);
  -- Draft lines are mutable; the invoice header remains and keeps its audit identity.
  delete from public.sales_invoice_lines where sales_invoice_id = v_invoice.id;

  for v_source in
    select sol.id as sales_order_line_id, sol.line_number,
      sol.quantity as sales_order_quantity, sol.product_code_snapshot,
      sol.product_name_snapshot, sol.unit_snapshot, sol.unit_price_snapshot,
      sol.line_total as sales_order_line_total, sol.customer_product_price_id,
      sol.price_overridden, (item.value->>'quantity')::numeric as requested_quantity
    from pg_catalog.jsonb_array_elements(p_lines) item(value)
    join public.sales_order_lines sol on sol.id = (item.value->>'sales_order_line_id')::uuid
    where sol.sales_order_id = v_sales_order.id
    order by sol.line_number
    for update of sol
  loop
    v_line_count := v_line_count + 1;
    if v_source.requested_quantity <= 0
       or v_source.requested_quantity <> pg_catalog.round(v_source.requested_quantity,4) then
      raise exception using errcode = '22023', message = 'Invoice quantity must be positive with at most four decimal places';
    end if;
    if v_source.sales_order_quantity <= 0 or v_source.sales_order_line_total is null then
      raise exception using errcode = '23514', message = 'Selected sales order line has invalid quantity or total';
    end if;

    select coalesce(sum(sil.quantity),0), coalesce(sum(sil.line_total),0)
      into v_prior_quantity, v_prior_total
    from public.sales_invoice_lines sil
    join public.sales_invoices si on si.id = sil.sales_invoice_id
    where sil.sales_order_line_id = v_source.sales_order_line_id
      and si.id <> v_invoice.id and si.status <> 'void';

    if v_prior_quantity + v_source.requested_quantity > v_source.sales_order_quantity then
      raise exception using errcode = '23514', message = 'Invoiced quantity would exceed the sales order line quantity';
    end if;
    if v_prior_quantity + v_source.requested_quantity = v_source.sales_order_quantity then
      v_line_total := v_source.sales_order_line_total - v_prior_total;
    else
      v_line_total := pg_catalog.round(
        v_source.sales_order_line_total * v_source.requested_quantity / v_source.sales_order_quantity, 2
      );
    end if;
    if v_line_total < 0 then
      raise exception using errcode = '23514', message = 'Allocated invoice amount is invalid';
    end if;

    insert into public.sales_invoice_lines (
      sales_invoice_id, line_number, sales_order_line_id, customer_product_price_id,
      price_overridden, product_code_snapshot, product_name_snapshot, unit_snapshot,
      quantity, unit_price_snapshot, line_total
    ) values (
      v_invoice.id, v_line_count::integer, v_source.sales_order_line_id,
      v_source.customer_product_price_id, v_source.price_overridden,
      v_source.product_code_snapshot, v_source.product_name_snapshot, v_source.unit_snapshot,
      v_source.requested_quantity, v_source.unit_price_snapshot, v_line_total
    );
  end loop;

  if v_line_count <> v_expected_line_count then
    raise exception using errcode = '23514', message = 'Every invoice line must belong to the selected sales order';
  end if;

  select coalesce(sum(line_total),0) into v_subtotal
  from public.sales_invoice_lines where sales_invoice_id = v_invoice.id;
  update public.sales_invoices
    set invoice_date = p_invoice_date,
        due_date = p_invoice_date + v_sales_order.payment_terms_days_snapshot,
        notes = nullif(pg_catalog.btrim(p_notes),''),
        subtotal_amount = v_subtotal,
        total_amount = v_subtotal,
        tax_amount = 0
    where id = v_invoice.id;

  return v_invoice.id;
end;
$$;

revoke all on function public.update_customer_invoice_draft(uuid,date,text,jsonb) from public, anon, authenticated;
grant execute on function public.update_customer_invoice_draft(uuid,date,text,jsonb) to authenticated;

create function app_private.create_draft_customer_invoice_on_so_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines jsonb;
begin
  if old.status is distinct from 'confirmed' and new.status = 'confirmed' then
    -- Idempotent guard: only create the initial draft if this SO has no invoice yet.
    if not exists (select 1 from public.sales_invoices si where si.sales_order_id = new.id) then
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('sales_order_line_id', sol.id, 'quantity', sol.quantity)
        order by sol.line_number
      ) into v_lines
      from public.sales_order_lines sol where sol.sales_order_id = new.id;

      if v_lines is not null and pg_catalog.jsonb_array_length(v_lines) > 0 then
        perform public.create_customer_invoice(
          new.id, current_date,
          'Draf dibuat otomatis saat pesanan dikonfirmasi; tinjau kuantitas sebelum diterbitkan.',
          v_lines
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.create_draft_customer_invoice_on_so_confirmation() from public, anon, authenticated;

drop trigger if exists sales_orders_create_customer_invoice_on_confirmation on public.sales_orders;
create trigger sales_orders_create_customer_invoice_on_confirmation
  after update of status on public.sales_orders
  for each row
  when (old.status is distinct from 'confirmed' and new.status = 'confirmed')
  execute function app_private.create_draft_customer_invoice_on_so_confirmation();

comment on function public.update_customer_invoice_draft(uuid,date,text,jsonb) is
  'Updates an existing customer invoice draft; validates SO ownership and cumulative active invoiced quantities/values.';
comment on function app_private.create_draft_customer_invoice_on_so_confirmation() is
  'Creates one initial draft customer invoice when a sales order transitions to confirmed; does not issue or post accounting.';

notify pgrst, 'reload schema';
commit;
