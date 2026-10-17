-- D-09/D-10 (owner-approved): remove shipment tracking and generate customer invoices manually from confirmed sales orders.
-- Existing shipment rows are test data under D-09. Customer/supplier payment rows are intentionally not touched.
-- Invoice quantities and amounts are serialized and capped against their SO-line by create_customer_invoice.

begin;

drop trigger if exists shipments_create_customer_invoice_on_delivery on public.shipments;
drop trigger if exists shipments_set_updated_at on public.shipments;
drop function if exists app_private.create_draft_customer_invoice_on_delivery();
drop function if exists public.create_customer_invoice(uuid, date, text);
drop function if exists public.create_shipment(uuid, date, text, text, text, text, jsonb);
drop function if exists public.transition_shipment(uuid, text, date, text, text, text, text);

drop index if exists public.sales_invoices_one_active_per_shipment_uq;
alter table public.sales_invoices drop constraint if exists sales_invoices_shipment_id_fkey;
alter table public.sales_invoices drop column if exists shipment_id;
alter table public.sales_invoice_lines drop constraint if exists sales_invoice_lines_shipment_line_id_fkey;
alter table public.sales_invoice_lines drop column if exists shipment_line_id;

drop table if exists public.shipment_status_events;
drop table if exists public.shipment_lines;
drop table if exists public.shipments;
drop sequence if exists public.shipment_number_seq;

create function public.create_customer_invoice(
  p_sales_order_id uuid,
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
  v_sales_order public.sales_orders%rowtype;
  v_customer public.customers%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_sequence bigint;
  v_invoice_date date;
  v_expected_line_count bigint;
  v_line_count bigint := 0;
  v_request jsonb;
  v_source record;
  v_prior_quantity numeric(20,4);
  v_prior_total numeric(20,2);
  v_line_total numeric(20,2);
  v_subtotal numeric(20,2);
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_sales_order_id is null then
    raise exception using errcode = '22023', message = 'Confirmed sales order is required';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array' or pg_catalog.jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'At least one sales order line quantity is required';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_lines) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'object'
       or nullif(item.value->>'sales_order_line_id', '') is null
       or nullif(item.value->>'quantity', '') is null
  ) then
    raise exception using errcode = '22023', message = 'Each invoice line requires a sales order line ID and quantity';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_lines) as item(value)
    group by item.value->>'sales_order_line_id'
    having pg_catalog.count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A sales order line may appear only once per invoice';
  end if;

  v_invoice_date := coalesce(p_invoice_date, current_date);

  -- Lock the SO first so concurrent invoice requests for this SO are serialized.
  select * into v_sales_order
  from public.sales_orders so
  where so.id = p_sales_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sales order not found';
  end if;
  if v_sales_order.status <> 'confirmed' then
    raise exception using errcode = '22023', message = 'Only a confirmed sales order can be invoiced';
  end if;
  if v_invoice_date < v_sales_order.order_date then
    raise exception using errcode = '22023', message = 'Invoice date cannot be before the sales order date';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = v_sales_order.customer_id
  for key share;
  if not found then
    raise exception using errcode = '23503', message = 'Customer for sales order was not found';
  end if;

  select pg_catalog.count(*) into v_expected_line_count
  from pg_catalog.jsonb_array_elements(p_lines);
  if v_expected_line_count = 0 then
    raise exception using errcode = '22023', message = 'At least one sales order line quantity is required';
  end if;

  v_sequence := pg_catalog.nextval('public.sales_invoice_number_seq'::regclass);
  v_invoice_number := 'DRAFT-INV-' || pg_catalog.to_char(v_invoice_date, 'YYYYMM') || '-' ||
    pg_catalog.lpad(v_sequence::text, greatest(6, pg_catalog.length(v_sequence::text)), '0');

  insert into public.sales_invoices (
    invoice_number, sales_order_id, customer_id, invoice_date, due_date,
    currency_code, customer_code_snapshot, customer_name_snapshot, customer_phone_snapshot,
    ship_to_address_snapshot, subtotal_amount, total_amount, tax_amount, notes, created_by
  ) values (
    v_invoice_number, v_sales_order.id, v_customer.id, v_invoice_date,
    v_invoice_date + v_sales_order.payment_terms_days_snapshot,
    'IDR', v_customer.code, v_customer.legal_name, v_customer.phone,
    v_sales_order.ship_to_address_snapshot, 0, 0, 0, nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  ) returning id into v_invoice_id;

  for v_source in
    select
      sol.id as sales_order_line_id,
      sol.line_number,
      sol.quantity as sales_order_quantity,
      sol.product_code_snapshot,
      sol.product_name_snapshot,
      sol.unit_snapshot,
      sol.unit_price_snapshot,
      sol.line_total as sales_order_line_total,
      sol.customer_product_price_id,
      sol.price_overridden,
      (item.value->>'quantity')::numeric as requested_quantity
    from pg_catalog.jsonb_array_elements(p_lines) as item(value)
    join public.sales_order_lines sol
      on sol.id = (item.value->>'sales_order_line_id')::uuid
    where sol.sales_order_id = v_sales_order.id
    order by sol.line_number
    for update of sol
  loop
    v_line_count := v_line_count + 1;
    if v_source.requested_quantity <= 0
       or v_source.requested_quantity <> pg_catalog.round(v_source.requested_quantity, 4) then
      raise exception using errcode = '22023', message = 'Invoice quantity must be positive with at most four decimal places';
    end if;

    select coalesce(sum(sil.quantity), 0), coalesce(sum(sil.line_total), 0)
    into v_prior_quantity, v_prior_total
    from public.sales_invoice_lines sil
    join public.sales_invoices si on si.id = sil.sales_invoice_id
    where sil.sales_order_line_id = v_source.sales_order_line_id
      and si.status <> 'void';

    if v_prior_quantity + v_source.requested_quantity > v_source.sales_order_quantity then
      raise exception using errcode = '23514', message = 'Invoiced quantity would exceed the sales order line quantity';
    end if;

    if v_prior_quantity + v_source.requested_quantity = v_source.sales_order_quantity then
      v_line_total := v_source.sales_order_line_total - v_prior_total;
    else
      v_line_total := pg_catalog.round(
        v_source.sales_order_line_total * v_source.requested_quantity / v_source.sales_order_quantity,
        2
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
      v_invoice_id, v_line_count::integer, v_source.sales_order_line_id,
      v_source.customer_product_price_id, v_source.price_overridden,
      v_source.product_code_snapshot, v_source.product_name_snapshot, v_source.unit_snapshot,
      v_source.requested_quantity, v_source.unit_price_snapshot, v_line_total
    );
  end loop;

  if v_line_count <> v_expected_line_count then
    raise exception using errcode = '23514', message = 'Every invoice line must reference a line in the selected sales order';
  end if;

  select coalesce(sum(sil.line_total), 0) into v_subtotal
  from public.sales_invoice_lines sil
  where sil.sales_invoice_id = v_invoice_id;
  update public.sales_invoices
  set subtotal_amount = v_subtotal, total_amount = v_subtotal
  where id = v_invoice_id;

  return v_invoice_id;
end;
$$;

revoke all on function public.create_customer_invoice(uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_customer_invoice(uuid, date, text, jsonb) to authenticated;

comment on function public.create_customer_invoice(uuid, date, text, jsonb) is
  'Creates a draft customer invoice manually from a confirmed sales order; cumulative active invoice quantity and values cannot exceed each sales order line.';

notify pgrst, 'reload schema';

commit;
