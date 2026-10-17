-- Draft-only sales invoices, created once per delivered direct shipment.
-- No VAT calculation, receivables, payment, journal posting, PDF storage, or external messaging.

create sequence public.sales_invoice_number_seq;

create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
    check (invoice_number like 'DRAFT-INV-%' and length(btrim(invoice_number)) > 0),
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_date date not null,
  due_date date not null,
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  customer_code_snapshot text not null,
  customer_name_snapshot text not null,
  customer_phone_snapshot text,
  ship_to_address_snapshot text not null,
  subtotal_amount numeric(20,2) not null default 0 check (subtotal_amount >= 0),
  total_amount numeric(20,2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'void')),
  notes text,
  void_reason text,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint sales_invoices_due_after_date check (due_date >= invoice_date),
  constraint sales_invoices_amounts_balance check (total_amount = subtotal_amount),
  constraint sales_invoices_void_state_consistent check (
    (status = 'draft' and void_reason is null and voided_by is null and voided_at is null) or
    (status = 'void' and nullif(btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  )
);

-- A delivered shipment may have at most one active draft invoice; voided drafts remain auditable.
create unique index sales_invoices_one_active_per_shipment_uq
  on public.sales_invoices (shipment_id) where status <> 'void';
create index sales_invoices_customer_date_idx on public.sales_invoices (customer_id, invoice_date desc);
create index sales_invoices_sales_order_idx on public.sales_invoices (sales_order_id);
create index sales_invoices_status_date_idx on public.sales_invoices (status, invoice_date desc);
create index sales_invoices_created_by_idx on public.sales_invoices (created_by);
create index sales_invoices_voided_by_idx on public.sales_invoices (voided_by);

create table public.sales_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  sales_invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  shipment_line_id uuid not null references public.shipment_lines(id) on delete restrict,
  sales_order_line_id uuid not null references public.sales_order_lines(id) on delete restrict,
  customer_product_price_id uuid references public.customer_product_prices(id) on delete restrict,
  price_overridden boolean not null default false,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(20,4) not null check (quantity > 0),
  unit_price_snapshot numeric(20,2) not null check (unit_price_snapshot >= 0),
  line_total numeric(20,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint sales_invoice_lines_number_unique unique (sales_invoice_id, line_number),
  constraint sales_invoice_lines_shipment_line_unique unique (sales_invoice_id, shipment_line_id)
);
create index sales_invoice_lines_shipment_line_idx on public.sales_invoice_lines (shipment_line_id);
create index sales_invoice_lines_sales_order_line_idx on public.sales_invoice_lines (sales_order_line_id);

alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_lines enable row level security;
revoke all on public.sales_invoices, public.sales_invoice_lines from public, anon, authenticated;
grant select on public.sales_invoices, public.sales_invoice_lines to authenticated;

create policy sales_invoices_read_role on public.sales_invoices for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy sales_invoice_lines_read_role on public.sales_invoice_lines for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));

create function public.create_customer_invoice(
  p_shipment_id uuid,
  p_invoice_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_sales_order public.sales_orders%rowtype;
  v_customer public.customers%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_sequence bigint;
  v_invoice_date date;
  v_expected_line_count bigint;
  v_line_count bigint := 0;
  v_source record;
  v_prior_quantity numeric(20,4);
  v_prior_total numeric(20,2);
  v_line_total numeric(20,2);
  v_subtotal numeric(20,2);
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_shipment_id is null then
    raise exception using errcode = '22023', message = 'Delivered shipment is required';
  end if;
  v_invoice_date := coalesce(p_invoice_date, current_date);

  select * into v_shipment
  from public.shipments sh
  where sh.id = p_shipment_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Shipment not found';
  end if;
  if v_shipment.status <> 'delivered' or v_shipment.delivered_at is null then
    raise exception using errcode = '22023', message = 'Only a shipment recorded as delivered can be invoiced';
  end if;
  if v_invoice_date < v_shipment.delivered_at then
    raise exception using errcode = '22023', message = 'Invoice date cannot be before the recorded delivery date';
  end if;
  if exists (
    select 1 from public.sales_invoices si
    where si.shipment_id = v_shipment.id and si.status <> 'void'
  ) then
    raise exception using errcode = '23505', message = 'This delivered shipment already has an active draft invoice';
  end if;

  select * into v_sales_order
  from public.sales_orders so
  where so.id = v_shipment.sales_order_id
  for key share;
  if not found or v_sales_order.status <> 'confirmed' then
    raise exception using errcode = '22023', message = 'Shipment must reference a confirmed sales order';
  end if;
  if v_sales_order.customer_id <> v_shipment.customer_id then
    raise exception using errcode = '23514', message = 'Shipment customer does not match its sales order';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = v_shipment.customer_id
  for key share;
  if not found then
    raise exception using errcode = '23503', message = 'Customer for shipment was not found';
  end if;

  select count(*) into v_expected_line_count
  from public.shipment_lines sl
  where sl.shipment_id = v_shipment.id;
  if v_expected_line_count = 0 then
    raise exception using errcode = '22023', message = 'Delivered shipment has no lines to invoice';
  end if;

  v_sequence := pg_catalog.nextval('public.sales_invoice_number_seq'::regclass);
  v_invoice_number := 'DRAFT-INV-' || pg_catalog.to_char(v_invoice_date, 'YYYYMM') || '-' ||
    pg_catalog.lpad(v_sequence::text, greatest(6, pg_catalog.length(v_sequence::text)), '0');

  insert into public.sales_invoices (
    invoice_number, shipment_id, sales_order_id, customer_id, invoice_date, due_date,
    currency_code, customer_code_snapshot, customer_name_snapshot, customer_phone_snapshot,
    ship_to_address_snapshot, subtotal_amount, total_amount, notes, created_by
  ) values (
    v_invoice_number, v_shipment.id, v_sales_order.id, v_customer.id, v_invoice_date,
    v_invoice_date + v_sales_order.payment_terms_days_snapshot,
    'IDR', v_customer.code, v_customer.legal_name, v_customer.phone,
    v_shipment.ship_to_address_snapshot, 0, 0, nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  ) returning id into v_invoice_id;

  for v_source in
    select
      sl.id as shipment_line_id,
      sl.quantity as shipment_quantity,
      sol.id as sales_order_line_id,
      sol.quantity as sales_order_quantity,
      sol.product_code_snapshot,
      sol.product_name_snapshot,
      sol.unit_snapshot,
      sol.unit_price_snapshot,
      sol.line_total as sales_order_line_total,
      sol.customer_product_price_id,
      sol.price_overridden
    from public.shipment_lines sl
    join public.purchase_order_lines pol on pol.id = sl.purchase_order_line_id
    join public.sales_order_lines sol on sol.id = pol.sales_order_line_id
    where sl.shipment_id = v_shipment.id
      and sol.sales_order_id = v_sales_order.id
    order by sol.id, sl.id
    for update of sol
  loop
    v_line_count := v_line_count + 1;
    select coalesce(sum(sil.quantity), 0), coalesce(sum(sil.line_total), 0)
    into v_prior_quantity, v_prior_total
    from public.sales_invoice_lines sil
    join public.sales_invoices si on si.id = sil.sales_invoice_id
    where sil.sales_order_line_id = v_source.sales_order_line_id
      and si.status <> 'void';

    if v_prior_quantity + v_source.shipment_quantity > v_source.sales_order_quantity then
      raise exception using errcode = '23514', message = 'Invoiced quantity would exceed the sales order line quantity';
    end if;

    if v_prior_quantity + v_source.shipment_quantity = v_source.sales_order_quantity then
      v_line_total := v_source.sales_order_line_total - v_prior_total;
    else
      v_line_total := pg_catalog.round(
        v_source.sales_order_line_total * v_source.shipment_quantity / v_source.sales_order_quantity,
        2
      );
    end if;
    if v_line_total < 0 then
      raise exception using errcode = '23514', message = 'Allocated invoice amount is invalid';
    end if;

    insert into public.sales_invoice_lines (
      sales_invoice_id, line_number, shipment_line_id, sales_order_line_id,
      customer_product_price_id, price_overridden, product_code_snapshot,
      product_name_snapshot, unit_snapshot, quantity, unit_price_snapshot, line_total
    ) values (
      v_invoice_id, v_line_count::integer, v_source.shipment_line_id, v_source.sales_order_line_id,
      v_source.customer_product_price_id, v_source.price_overridden, v_source.product_code_snapshot,
      v_source.product_name_snapshot, v_source.unit_snapshot, v_source.shipment_quantity,
      v_source.unit_price_snapshot, v_line_total
    );
  end loop;

  if v_line_count <> v_expected_line_count then
    raise exception using errcode = '23514', message = 'Every shipment line must trace to a line in the linked sales order';
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
revoke all on function public.create_customer_invoice(uuid, date, text) from public, anon, authenticated;
grant execute on function public.create_customer_invoice(uuid, date, text) to authenticated;

create function public.void_customer_invoice(p_customer_invoice_id uuid, p_reason text)
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
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 then
    raise exception using errcode = '22023', message = 'Void reason must contain at least 3 characters';
  end if;
  select si.status into v_status
  from public.sales_invoices si
  where si.id = p_customer_invoice_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Customer invoice not found';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = '22023', message = 'Only a draft customer invoice can be voided';
  end if;
  update public.sales_invoices
  set status = 'void', void_reason = pg_catalog.btrim(p_reason),
      voided_by = auth.uid(), voided_at = pg_catalog.now()
  where id = p_customer_invoice_id;
end;
$$;
revoke all on function public.void_customer_invoice(uuid, text) from public, anon, authenticated;
grant execute on function public.void_customer_invoice(uuid, text) to authenticated;
