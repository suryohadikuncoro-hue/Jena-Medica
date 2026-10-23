-- D-12: supplier approval precedes sales-order confirmation.
-- Existing confirmed orders are unchanged. Draft SO confirmation now requires full sourcing
-- coverage and acknowledgment of every active supplier PO.
begin;

create function public.create_purchase_order(
  p_supplier_id uuid,
  p_sales_order_id uuid,
  p_expected_delivery_date date,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier public.suppliers%rowtype;
  v_sales_order public.sales_orders%rowtype;
  v_sales_line public.sales_order_lines%rowtype;
  v_po_id uuid;
  v_po_number text;
  v_sequence bigint;
  v_line jsonb;
  v_sales_order_line_id uuid;
  v_quantity numeric(20,4);
  v_cost numeric(20,2);
  v_reserved numeric(20,4);
  v_line_number integer := 0;
  v_estimated_total numeric(20,2);
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_supplier_id is null or p_sales_order_id is null then
    raise exception using errcode = '22023', message = 'Supplier and sales order are required';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array' then
    raise exception using errcode = '22023', message = 'PO lines must be a JSON array';
  end if;
  if pg_catalog.jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'At least one PO line is required';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) as items(value)
    group by items.value->>'sales_order_line_id' having pg_catalog.count(*) > 1
  ) then raise exception using errcode = '22023', message = 'A sales order line may appear only once per purchase order'; end if;

  select * into v_supplier from public.suppliers s where s.id = p_supplier_id and s.is_active for key share;
  if not found then raise exception using errcode = '23503', message = 'Active supplier not found'; end if;
  select * into v_sales_order from public.sales_orders so where so.id = p_sales_order_id for update;
  if not found then raise exception using errcode = '23503', message = 'Sales order not found'; end if;
  if v_sales_order.status not in ('draft', 'confirmed') then raise exception using errcode = '22023', message = 'Supplier orders can only be created for draft or confirmed sales orders'; end if;

  v_po_id := gen_random_uuid();
  v_sequence := pg_catalog.nextval('public.purchase_order_number_seq'::regclass);
  v_po_number := 'PO-' || pg_catalog.to_char(current_date, 'YYYYMM') || '-' || pg_catalog.lpad(v_sequence::text, greatest(6, pg_catalog.length(v_sequence::text)), '0');
  insert into public.purchase_orders (
    id, order_number, sales_order_id, supplier_id, customer_id, order_date,
    expected_delivery_date, ship_to_address_snapshot, status, notes, created_by
  ) values (
    v_po_id, v_po_number, v_sales_order.id, v_supplier.id, v_sales_order.customer_id, current_date,
    p_expected_delivery_date, v_sales_order.ship_to_address_snapshot, 'draft',
    nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  );

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as lines(value) loop
    v_line_number := v_line_number + 1;
    if pg_catalog.jsonb_typeof(v_line) <> 'object' or v_line->>'sales_order_line_id' is null or v_line->>'quantity' is null or v_line->>'quoted_unit_cost' is null then
      raise exception using errcode = '22023', message = 'Each PO line requires sales_order_line_id, quantity and quoted_unit_cost';
    end if;
    v_sales_order_line_id := (v_line->>'sales_order_line_id')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    v_cost := (v_line->>'quoted_unit_cost')::numeric;
    if v_quantity <= 0 or v_cost < 0 then raise exception using errcode = '22023', message = 'PO quantity or quoted unit cost is invalid'; end if;

    select * into v_sales_line
    from public.sales_order_lines sol
    where sol.id = v_sales_order_line_id and sol.sales_order_id = v_sales_order.id
    for update;
    if not found then raise exception using errcode = '23503', message = 'PO line must reference a line in the selected sales order'; end if;

    select coalesce(sum(pol.quantity), 0) into v_reserved
    from public.purchase_order_lines pol
    join public.purchase_orders po on po.id = pol.purchase_order_id
    where pol.sales_order_line_id = v_sales_order_line_id and po.status <> 'cancelled';
    if v_reserved + v_quantity > v_sales_line.quantity then
      raise exception using errcode = '23514', message = 'Sourced quantity would exceed the sales order line quantity';
    end if;

    insert into public.purchase_order_lines (
      purchase_order_id, line_number, sales_order_line_id, product_id,
      product_code_snapshot, product_name_snapshot, unit_snapshot, quantity, quoted_unit_cost
    ) values (
      v_po_id, v_line_number, v_sales_line.id, v_sales_line.product_id,
      v_sales_line.product_code_snapshot, v_sales_line.product_name_snapshot,
      v_sales_line.unit_snapshot, v_quantity, v_cost
    );
  end loop;

  select coalesce(sum(estimated_line_total), 0) into v_estimated_total
  from public.purchase_order_lines pol where pol.purchase_order_id = v_po_id;
  update public.purchase_orders set estimated_total = v_estimated_total where id = v_po_id;
  return v_po_id;
end;
$$;
revoke all on function public.create_purchase_order(uuid, uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_purchase_order(uuid, uuid, date, text, jsonb) to authenticated;

create function public.confirm_sales_order(p_sales_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_line_count bigint;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  select so.status into v_status from public.sales_orders so where so.id = p_sales_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Sales order not found'; end if;
  if v_status <> 'draft' then raise exception using errcode = '22023', message = 'Only draft sales orders can be confirmed'; end if;
  select count(*) into v_line_count from public.sales_order_lines sol where sol.sales_order_id = p_sales_order_id;
  if v_line_count = 0 then raise exception using errcode = '22023', message = 'Cannot confirm an order without lines'; end if;
  if exists (
    select 1
    from public.sales_order_lines sol
    where sol.sales_order_id = p_sales_order_id
      and sol.quantity > coalesce((
        select sum(pol.quantity)
        from public.purchase_order_lines pol
        join public.purchase_orders po on po.id = pol.purchase_order_id
        where pol.sales_order_line_id = sol.id and po.status <> 'cancelled'
      ), 0)
  ) then
    raise exception using errcode = '23514', message = 'Every sales order line must be fully assigned to supplier orders before confirmation';
  end if;
  if not exists (
    select 1 from public.purchase_orders po
    where po.sales_order_id = p_sales_order_id and po.status = 'acknowledged'
  ) then
    raise exception using errcode = '23514', message = 'At least one supplier order must be approved before sales order confirmation';
  end if;
  if exists (
    select 1 from public.purchase_orders po
    where po.sales_order_id = p_sales_order_id and po.status not in ('acknowledged', 'cancelled')
  ) then
    raise exception using errcode = '23514', message = 'All active supplier orders must be acknowledged before sales order confirmation';
  end if;
  update public.sales_orders set status = 'confirmed', confirmed_at = pg_catalog.now() where id = p_sales_order_id;
end;
$$;
revoke all on function public.confirm_sales_order(uuid) from public, anon, authenticated;
grant execute on function public.confirm_sales_order(uuid) to authenticated;

commit;
