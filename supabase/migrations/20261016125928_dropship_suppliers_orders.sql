-- Drop-ship foundation: supplier, sales order and supplier purchase order tables.
-- No physical-inventory tables or demo rows are created. RLS requires an
-- authenticated JWT claim: app_metadata.business_role = owner | admin | viewer.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create or replace function app_private.has_business_role(p_allowed_roles text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and coalesce((select auth.jwt() -> 'app_metadata' ->> 'business_role'), '') = any (p_allowed_roles);
$$;
revoke all on function app_private.has_business_role(text[]) from public, anon, authenticated;
grant execute on function app_private.has_business_role(text[]) to authenticated;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function app_private.set_updated_at() from public, anon, authenticated;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  legal_name text not null check (length(btrim(legal_name)) > 0),
  display_name text,
  default_shipping_address text,
  contact_name text,
  phone text,
  email text,
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 3650),
  credit_limit numeric(20,2) check (credit_limit is null or credit_limit >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  legal_name text not null check (length(btrim(legal_name)) > 0),
  display_name text,
  tax_status text not null default 'unverified' check (tax_status in ('pkp', 'non_pkp', 'unverified')),
  tax_identifier text,
  email text,
  phone text,
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 3650),
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  category text,
  unit text not null check (length(btrim(unit)) > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.sales_order_number_seq;
create sequence public.purchase_order_number_seq;

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_date date not null default current_date,
  due_date date not null,
  payment_terms_days_snapshot integer not null check (payment_terms_days_snapshot between 0 and 3650),
  ship_to_address_snapshot text not null check (length(btrim(ship_to_address_snapshot)) > 0),
  ship_to_contact_snapshot text,
  ship_to_phone_snapshot text,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  subtotal_amount numeric(20,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(20,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(20,2) not null default 0 check (total_amount >= 0),
  notes text,
  cancellation_reason text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_orders_due_after_order check (due_date >= order_date),
  constraint sales_orders_amounts_balance check (total_amount = subtotal_amount - discount_amount)
);

create table public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  product_id uuid not null references public.products(id) on delete restrict,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(20,4) not null check (quantity > 0),
  unit_price_snapshot numeric(20,2) not null check (unit_price_snapshot >= 0),
  discount_amount numeric(20,2) not null default 0 check (discount_amount >= 0),
  gross_amount numeric(20,2) generated always as (round(quantity * unit_price_snapshot, 2)) stored,
  line_total numeric(20,2) generated always as (round(quantity * unit_price_snapshot - discount_amount, 2)) stored,
  created_at timestamptz not null default now(),
  constraint sales_order_lines_number_unique unique (sales_order_id, line_number),
  constraint sales_order_lines_discount_lte_gross check (discount_amount <= round(quantity * unit_price_snapshot, 2))
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_date date not null default current_date,
  expected_delivery_date date,
  ship_to_address_snapshot text not null check (length(btrim(ship_to_address_snapshot)) > 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'acknowledged', 'cancelled')),
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  estimated_total numeric(20,2) not null default 0 check (estimated_total >= 0),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_expected_after_order check (expected_delivery_date is null or expected_delivery_date >= order_date)
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  sales_order_line_id uuid not null references public.sales_order_lines(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(20,4) not null check (quantity > 0),
  quoted_unit_cost numeric(20,2) not null check (quoted_unit_cost >= 0),
  estimated_line_total numeric(20,2) generated always as (round(quantity * quoted_unit_cost, 2)) stored,
  created_at timestamptz not null default now(),
  constraint purchase_order_lines_number_unique unique (purchase_order_id, line_number)
);

create index customers_active_name_idx on public.customers (is_active, legal_name);
create index suppliers_active_name_idx on public.suppliers (is_active, legal_name);
create index products_active_name_idx on public.products (is_active, name);
create index sales_orders_customer_date_idx on public.sales_orders (customer_id, order_date desc);
create index sales_orders_status_date_idx on public.sales_orders (status, order_date desc);
create index sales_order_lines_order_idx on public.sales_order_lines (sales_order_id, line_number);
create index purchase_orders_supplier_date_idx on public.purchase_orders (supplier_id, order_date desc);
create index purchase_orders_sales_order_idx on public.purchase_orders (sales_order_id);
create index purchase_order_lines_order_idx on public.purchase_order_lines (purchase_order_id, line_number);
create index purchase_order_lines_sales_line_idx on public.purchase_order_lines (sales_order_line_id);

create trigger customers_set_updated_at before update on public.customers for each row execute function app_private.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function app_private.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function app_private.set_updated_at();
create trigger sales_orders_set_updated_at before update on public.sales_orders for each row execute function app_private.set_updated_at();
create trigger purchase_orders_set_updated_at before update on public.purchase_orders for each row execute function app_private.set_updated_at();

create function public.create_sales_order(
  p_customer_id uuid,
  p_order_date date,
  p_ship_to_address text,
  p_ship_to_contact text,
  p_ship_to_phone text,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_product public.products%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_sequence bigint;
  v_line jsonb;
  v_quantity numeric(20,4);
  v_unit_price numeric(20,2);
  v_discount numeric(20,2);
  v_line_number integer := 0;
  v_subtotal numeric(20,2);
  v_discount_total numeric(20,2);
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_customer_id is null or p_order_date is null then
    raise exception using errcode = '22023', message = 'Customer and order date are required';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array' then
    raise exception using errcode = '22023', message = 'Order lines must be a JSON array';
  end if;
  if pg_catalog.jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'At least one order line is required';
  end if;
  if p_ship_to_address is null or pg_catalog.length(pg_catalog.btrim(p_ship_to_address)) = 0 then
    raise exception using errcode = '22023', message = 'Ship-to address is required for direct delivery';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id and c.is_active
  for key share;
  if not found then
    raise exception using errcode = '23503', message = 'Active customer not found';
  end if;

  v_order_id := gen_random_uuid();
  v_sequence := pg_catalog.nextval('public.sales_order_number_seq'::regclass);
  v_order_number := 'SO-' || pg_catalog.to_char(p_order_date, 'YYYYMM') || '-' || pg_catalog.lpad(v_sequence::text, greatest(6, pg_catalog.length(v_sequence::text)), '0');

  insert into public.sales_orders (
    id, order_number, customer_id, order_date, due_date, payment_terms_days_snapshot,
    ship_to_address_snapshot, ship_to_contact_snapshot, ship_to_phone_snapshot,
    status, notes, created_by
  ) values (
    v_order_id, v_order_number, p_customer_id, p_order_date,
    p_order_date + v_customer.payment_terms_days, v_customer.payment_terms_days,
    p_ship_to_address, nullif(pg_catalog.btrim(p_ship_to_contact), ''), nullif(pg_catalog.btrim(p_ship_to_phone), ''),
    'draft', nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  );

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as lines(value) loop
    v_line_number := v_line_number + 1;
    if pg_catalog.jsonb_typeof(v_line) <> 'object' or v_line->>'product_id' is null or v_line->>'quantity' is null or v_line->>'unit_price' is null then
      raise exception using errcode = '22023', message = 'Each order line requires product_id, quantity and unit_price';
    end if;
    select * into v_product
    from public.products p
    where p.id = (v_line->>'product_id')::uuid and p.is_active
    for key share;
    if not found then
      raise exception using errcode = '23503', message = 'Active product not found';
    end if;
    v_quantity := (v_line->>'quantity')::numeric;
    v_unit_price := (v_line->>'unit_price')::numeric;
    v_discount := coalesce((v_line->>'discount_amount')::numeric, 0);
    if v_quantity <= 0 or v_unit_price < 0 or v_discount < 0 or v_discount > round(v_quantity * v_unit_price, 2) then
      raise exception using errcode = '22023', message = 'Order line quantity, price or discount is invalid';
    end if;
    insert into public.sales_order_lines (
      sales_order_id, line_number, product_id, product_code_snapshot,
      product_name_snapshot, unit_snapshot, quantity, unit_price_snapshot, discount_amount
    ) values (
      v_order_id, v_line_number, v_product.id, v_product.code,
      v_product.name, v_product.unit, v_quantity, v_unit_price, v_discount
    );
  end loop;

  select coalesce(sum(gross_amount), 0), coalesce(sum(discount_amount), 0)
  into v_subtotal, v_discount_total
  from public.sales_order_lines sol where sol.sales_order_id = v_order_id;
  update public.sales_orders
  set subtotal_amount = v_subtotal,
      discount_amount = v_discount_total,
      total_amount = v_subtotal - v_discount_total
  where id = v_order_id;

  return v_order_id;
end;
$$;
revoke all on function public.create_sales_order(uuid, date, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_sales_order(uuid, date, text, text, text, text, jsonb) to authenticated;

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
  update public.sales_orders set status = 'confirmed', confirmed_at = pg_catalog.now() where id = p_sales_order_id;
end;
$$;
revoke all on function public.confirm_sales_order(uuid) from public, anon, authenticated;
grant execute on function public.confirm_sales_order(uuid) to authenticated;

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
  if v_sales_order.status <> 'confirmed' then raise exception using errcode = '22023', message = 'Sales order must be confirmed before sourcing'; end if;

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

-- Exposed tables are protected by RLS and non-public table grants.
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_lines enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

revoke all on public.customers, public.suppliers, public.products,
  public.sales_orders, public.sales_order_lines, public.purchase_orders, public.purchase_order_lines
from public, anon, authenticated;

grant select, insert, update on public.customers, public.suppliers, public.products to authenticated;
grant select on public.sales_orders, public.sales_order_lines, public.purchase_orders, public.purchase_order_lines to authenticated;
grant usage, select on sequence public.sales_order_number_seq, public.purchase_order_number_seq to authenticated;

create policy customers_read_role on public.customers for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy customers_insert_admin on public.customers for insert to authenticated
  with check ((select app_private.has_business_role(array['owner', 'admin'])));
create policy customers_update_admin on public.customers for update to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])))
  with check ((select app_private.has_business_role(array['owner', 'admin'])));

create policy suppliers_read_role on public.suppliers for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy suppliers_insert_admin on public.suppliers for insert to authenticated
  with check ((select app_private.has_business_role(array['owner', 'admin'])));
create policy suppliers_update_admin on public.suppliers for update to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])))
  with check ((select app_private.has_business_role(array['owner', 'admin'])));

create policy products_read_role on public.products for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy products_insert_admin on public.products for insert to authenticated
  with check ((select app_private.has_business_role(array['owner', 'admin'])));
create policy products_update_admin on public.products for update to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])))
  with check ((select app_private.has_business_role(array['owner', 'admin'])));

create policy sales_orders_read_role on public.sales_orders for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy sales_order_lines_read_role on public.sales_order_lines for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy purchase_orders_read_role on public.purchase_orders for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy purchase_order_lines_read_role on public.purchase_order_lines for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
