-- Direct supplier-to-customer shipments. No inventory receipt, AP/HPP posting,
-- tax calculation, sales invoice, or accounting journal is created here.

-- Record manual PO hand-off/acknowledgement; these actions do not email suppliers.
alter table public.purchase_orders
  add column sent_at timestamptz,
  add column sent_by uuid references auth.users(id) on delete restrict,
  add column acknowledged_at timestamptz,
  add column acknowledged_by uuid references auth.users(id) on delete restrict,
  add constraint purchase_orders_sent_metadata_check
    check (status not in ('sent', 'acknowledged') or (sent_at is not null and sent_by is not null)),
  add constraint purchase_orders_ack_metadata_check
    check (status <> 'acknowledged' or (acknowledged_at is not null and acknowledged_by is not null));

create index purchase_orders_sent_by_idx on public.purchase_orders (sent_by);
create index purchase_orders_acknowledged_by_idx on public.purchase_orders (acknowledged_by);

create function public.set_purchase_order_status(
  p_purchase_order_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_purchase_order_id is null or p_new_status is null then
    raise exception using errcode = '22023', message = 'Purchase order and target status are required';
  end if;

  select po.status into v_status
  from public.purchase_orders po
  where po.id = p_purchase_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Purchase order not found';
  end if;

  if v_status = 'draft' and p_new_status = 'sent' then
    update public.purchase_orders
    set status = 'sent', sent_at = pg_catalog.now(), sent_by = auth.uid()
    where id = p_purchase_order_id;
  elsif v_status = 'sent' and p_new_status = 'acknowledged' then
    update public.purchase_orders
    set status = 'acknowledged', acknowledged_at = pg_catalog.now(), acknowledged_by = auth.uid()
    where id = p_purchase_order_id;
  else
    raise exception using errcode = '22023', message = 'Only draft-to-sent or sent-to-acknowledged transitions are allowed';
  end if;
end;
$$;
revoke all on function public.set_purchase_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_purchase_order_status(uuid, text) to authenticated;

create sequence public.shipment_number_seq;

create table public.shipments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  shipment_number text not null unique,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  shipment_date date not null,
  ship_to_address_snapshot text not null check (pg_catalog.length(pg_catalog.btrim(ship_to_address_snapshot)) > 0),
  carrier text,
  tracking_number text,
  delivery_note_number text,
  status text not null default 'draft' check (status in ('draft', 'shipped', 'delivered', 'issue', 'cancelled')),
  shipped_at date,
  delivered_at date,
  issue_reason text,
  cancelled_reason text,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint shipments_status_dates_check check (
    ((status in ('draft', 'cancelled')) and shipped_at is null) or
    ((status in ('shipped', 'delivered', 'issue')) and shipped_at is not null)
  ),
  constraint shipments_delivery_date_check check (
    (status = 'delivered' and delivered_at is not null and delivered_at >= shipped_at) or
    (status <> 'delivered' and delivered_at is null)
  ),
  constraint shipments_issue_reason_check check (
    (status = 'issue' and nullif(pg_catalog.btrim(issue_reason), '') is not null) or
    (status <> 'issue' and issue_reason is null)
  ),
  constraint shipments_cancelled_metadata_check check (
    (status = 'cancelled' and nullif(pg_catalog.btrim(cancelled_reason), '') is not null and cancelled_by is not null and cancelled_at is not null) or
    (status <> 'cancelled' and cancelled_reason is null and cancelled_by is null and cancelled_at is null)
  )
);

create table public.shipment_lines (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(20,4) not null check (quantity > 0),
  created_at timestamptz not null default pg_catalog.now(),
  constraint shipment_lines_number_unique unique (shipment_id, line_number),
  constraint shipment_lines_po_line_once unique (shipment_id, purchase_order_line_id)
);

create table public.shipment_status_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  previous_status text check (previous_status is null or previous_status in ('draft', 'shipped', 'delivered', 'issue', 'cancelled')),
  new_status text not null check (new_status in ('draft', 'shipped', 'delivered', 'issue', 'cancelled')),
  event_date date not null,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  occurred_at timestamptz not null default pg_catalog.now()
);

create index shipments_purchase_order_idx on public.shipments (purchase_order_id, created_at desc);
create index shipments_sales_order_idx on public.shipments (sales_order_id);
create index shipments_supplier_date_idx on public.shipments (supplier_id, shipment_date desc);
create index shipments_customer_date_idx on public.shipments (customer_id, shipment_date desc);
create index shipments_status_date_idx on public.shipments (status, shipment_date desc);
create index shipments_created_by_idx on public.shipments (created_by);
create index shipments_cancelled_by_idx on public.shipments (cancelled_by);
create index shipment_lines_shipment_idx on public.shipment_lines (shipment_id, line_number);
create index shipment_lines_po_line_idx on public.shipment_lines (purchase_order_line_id);
create index shipment_status_events_shipment_date_idx on public.shipment_status_events (shipment_id, occurred_at desc);
create index shipment_status_events_created_by_idx on public.shipment_status_events (created_by);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function app_private.set_updated_at();

create function public.create_shipment(
  p_purchase_order_id uuid,
  p_shipment_date date,
  p_carrier text,
  p_tracking_number text,
  p_delivery_note_number text,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_shipment_id uuid;
  v_shipment_number text;
  v_sequence bigint;
  v_line jsonb;
  v_po_line_id uuid;
  v_po_line_purchase_order_id uuid;
  v_po_quantity numeric(20,4);
  v_reserved_quantity numeric(20,4);
  v_quantity numeric(20,4);
  v_product_code text;
  v_product_name text;
  v_unit text;
  v_line_number integer := 0;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_purchase_order_id is null or p_shipment_date is null then
    raise exception using errcode = '22023', message = 'Purchase order and shipment date are required';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array' or pg_catalog.jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'At least one shipment line is required';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) as item(value)
    group by item.value->>'purchase_order_line_id' having pg_catalog.count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A PO line may appear only once per shipment';
  end if;

  select * into v_po
  from public.purchase_orders po
  where po.id = p_purchase_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Purchase order not found';
  end if;
  if v_po.status not in ('sent', 'acknowledged') then
    raise exception using errcode = '22023', message = 'Purchase order must be sent to or acknowledged by the supplier before shipment';
  end if;
  if p_shipment_date < v_po.order_date then
    raise exception using errcode = '22023', message = 'Shipment date cannot be before the purchase order date';
  end if;

  v_shipment_id := pg_catalog.gen_random_uuid();
  v_sequence := pg_catalog.nextval('public.shipment_number_seq'::regclass);
  v_shipment_number := 'SJ-' || pg_catalog.to_char(p_shipment_date, 'YYYYMM') || '-' || pg_catalog.lpad(v_sequence::text, greatest(6, pg_catalog.length(v_sequence::text)), '0');

  insert into public.shipments (
    id, shipment_number, purchase_order_id, sales_order_id, supplier_id, customer_id,
    shipment_date, ship_to_address_snapshot, carrier, tracking_number,
    delivery_note_number, status, notes, created_by
  ) values (
    v_shipment_id, v_shipment_number, v_po.id, v_po.sales_order_id, v_po.supplier_id, v_po.customer_id,
    p_shipment_date, v_po.ship_to_address_snapshot, nullif(pg_catalog.btrim(p_carrier), ''),
    nullif(pg_catalog.btrim(p_tracking_number), ''), nullif(pg_catalog.btrim(p_delivery_note_number), ''),
    'draft', nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  );

  for v_line in
    select value
    from pg_catalog.jsonb_array_elements(p_lines) as lines(value)
    order by value->>'purchase_order_line_id'
  loop
    v_line_number := v_line_number + 1;
    if pg_catalog.jsonb_typeof(v_line) <> 'object' or v_line->>'purchase_order_line_id' is null or v_line->>'quantity' is null then
      raise exception using errcode = '22023', message = 'Each shipment line requires a PO line and quantity';
    end if;
    v_po_line_id := (v_line->>'purchase_order_line_id')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    if v_quantity <= 0 then
      raise exception using errcode = '22023', message = 'Shipment quantity must be greater than zero';
    end if;

    select pol.purchase_order_id, pol.quantity, pol.product_code_snapshot, pol.product_name_snapshot, pol.unit_snapshot
    into v_po_line_purchase_order_id, v_po_quantity, v_product_code, v_product_name, v_unit
    from public.purchase_order_lines pol
    where pol.id = v_po_line_id
    for update;
    if not found or v_po_line_purchase_order_id <> v_po.id then
      raise exception using errcode = '23503', message = 'Every shipment line must match a line in the selected purchase order';
    end if;

    select coalesce(sum(sl.quantity), 0)
    into v_reserved_quantity
    from public.shipment_lines sl
    join public.shipments sh on sh.id = sl.shipment_id
    where sl.purchase_order_line_id = v_po_line_id and sh.status <> 'cancelled';
    if v_reserved_quantity + v_quantity > v_po_quantity then
      raise exception using errcode = '23514', message = 'Shipment quantity would exceed the unshipped PO line quantity';
    end if;

    insert into public.shipment_lines (
      shipment_id, line_number, purchase_order_line_id, product_code_snapshot,
      product_name_snapshot, unit_snapshot, quantity
    ) values (
      v_shipment_id, v_line_number, v_po_line_id, v_product_code,
      v_product_name, v_unit, v_quantity
    );
  end loop;

  insert into public.shipment_status_events (
    shipment_id, previous_status, new_status, event_date, note, created_by
  ) values (
    v_shipment_id, null, 'draft', p_shipment_date, 'Draft pengiriman dibuat', auth.uid()
  );
  return v_shipment_id;
end;
$$;
revoke all on function public.create_shipment(uuid, date, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_shipment(uuid, date, text, text, text, text, jsonb) to authenticated;

create function public.transition_shipment(
  p_shipment_id uuid,
  p_new_status text,
  p_event_date date,
  p_note text,
  p_carrier text,
  p_tracking_number text,
  p_delivery_note_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_event_date date := coalesce(p_event_date, current_date);
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_shipment_id is null or p_new_status is null then
    raise exception using errcode = '22023', message = 'Shipment and target status are required';
  end if;

  select * into v_shipment
  from public.shipments sh
  where sh.id = p_shipment_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Shipment not found';
  end if;

  if p_new_status = 'shipped' then
    if v_shipment.status not in ('draft', 'issue') then
      raise exception using errcode = '22023', message = 'Only draft or issue shipments can be marked shipped';
    end if;
    if v_event_date < v_shipment.shipment_date or (v_shipment.shipped_at is not null and v_event_date < v_shipment.shipped_at) then
      raise exception using errcode = '22023', message = 'Dispatch date cannot be before the shipment or previous dispatch date';
    end if;
    update public.shipments
    set status = 'shipped', shipped_at = coalesce(shipped_at, v_event_date), issue_reason = null,
        carrier = coalesce(nullif(pg_catalog.btrim(p_carrier), ''), carrier),
        tracking_number = coalesce(nullif(pg_catalog.btrim(p_tracking_number), ''), tracking_number),
        delivery_note_number = coalesce(nullif(pg_catalog.btrim(p_delivery_note_number), ''), delivery_note_number)
    where id = p_shipment_id;
  elsif p_new_status = 'delivered' then
    if v_shipment.status not in ('shipped', 'issue') then
      raise exception using errcode = '22023', message = 'Only shipped or issue shipments can be marked delivered';
    end if;
    if v_event_date < coalesce(v_shipment.shipped_at, v_shipment.shipment_date) then
      raise exception using errcode = '22023', message = 'Receipt date cannot be before dispatch date';
    end if;
    update public.shipments
    set status = 'delivered', delivered_at = v_event_date, issue_reason = null,
        carrier = coalesce(nullif(pg_catalog.btrim(p_carrier), ''), carrier),
        tracking_number = coalesce(nullif(pg_catalog.btrim(p_tracking_number), ''), tracking_number),
        delivery_note_number = coalesce(nullif(pg_catalog.btrim(p_delivery_note_number), ''), delivery_note_number)
    where id = p_shipment_id;
  elsif p_new_status = 'issue' then
    if v_shipment.status <> 'shipped' then
      raise exception using errcode = '22023', message = 'Only shipped shipments can be marked with an issue';
    end if;
    if v_event_date < coalesce(v_shipment.shipped_at, v_shipment.shipment_date) then
      raise exception using errcode = '22023', message = 'Issue date cannot be before dispatch date';
    end if;
    if p_note is null or pg_catalog.length(pg_catalog.btrim(p_note)) < 3 then
      raise exception using errcode = '22023', message = 'Issue description must contain at least 3 characters';
    end if;
    update public.shipments
    set status = 'issue', issue_reason = pg_catalog.btrim(p_note)
    where id = p_shipment_id;
  elsif p_new_status = 'cancelled' then
    if v_shipment.status <> 'draft' then
      raise exception using errcode = '22023', message = 'Only draft shipments can be cancelled';
    end if;
    if v_event_date < v_shipment.shipment_date then
      raise exception using errcode = '22023', message = 'Cancellation date cannot be before the shipment date';
    end if;
    if p_note is null or pg_catalog.length(pg_catalog.btrim(p_note)) < 3 then
      raise exception using errcode = '22023', message = 'Cancellation reason must contain at least 3 characters';
    end if;
    update public.shipments
    set status = 'cancelled', cancelled_reason = pg_catalog.btrim(p_note), cancelled_by = auth.uid(), cancelled_at = pg_catalog.now()
    where id = p_shipment_id;
  else
    raise exception using errcode = '22023', message = 'Unsupported shipment status transition';
  end if;

  insert into public.shipment_status_events (
    shipment_id, previous_status, new_status, event_date, note, created_by
  ) values (
    p_shipment_id, v_shipment.status, p_new_status, v_event_date,
    nullif(pg_catalog.btrim(p_note), ''), auth.uid()
  );
end;
$$;
revoke all on function public.transition_shipment(uuid, text, date, text, text, text, text) from public, anon, authenticated;
grant execute on function public.transition_shipment(uuid, text, date, text, text, text, text) to authenticated;

alter table public.shipments enable row level security;
alter table public.shipment_lines enable row level security;
alter table public.shipment_status_events enable row level security;
revoke all on public.shipments, public.shipment_lines, public.shipment_status_events from public, anon, authenticated;
grant select on public.shipments, public.shipment_lines, public.shipment_status_events to authenticated;

create policy shipments_read_role on public.shipments for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy shipment_lines_read_role on public.shipment_lines for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy shipment_status_events_read_role on public.shipment_status_events for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
