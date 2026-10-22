create table public.customer_product_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  unit_price numeric(20,2) not null check (unit_price >= 0),
  valid_from date not null,
  valid_until date,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint customer_product_prices_period_valid check (valid_until is null or valid_until >= valid_from),
  constraint customer_product_prices_start_unique unique (customer_id, product_id, valid_from)
);

alter table public.sales_order_lines
  add column customer_product_price_id uuid references public.customer_product_prices(id) on delete restrict,
  add column price_overridden boolean not null default false;

create index customer_product_prices_product_idx on public.customer_product_prices (product_id);
create index customer_product_prices_created_by_idx on public.customer_product_prices (created_by);
create index sales_order_lines_customer_price_idx on public.sales_order_lines (customer_product_price_id);

alter table public.customer_product_prices enable row level security;
revoke all on public.customer_product_prices from public, anon, authenticated;
grant select on public.customer_product_prices to authenticated;
create policy customer_product_prices_read_role on public.customer_product_prices for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));

create function public.create_customer_product_price(
  p_customer_id uuid,
  p_product_id uuid,
  p_unit_price numeric,
  p_valid_from date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_product public.products%rowtype;
  v_previous public.customer_product_prices%rowtype;
  v_price_id uuid;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_customer_id is null or p_product_id is null or p_unit_price is null or p_valid_from is null then
    raise exception using errcode = '22023', message = 'Customer, product, unit price and effective date are required';
  end if;
  if p_unit_price < 0 then
    raise exception using errcode = '22023', message = 'Unit price cannot be negative';
  end if;
  if p_valid_from < current_date then
    raise exception using errcode = '22023', message = 'Price versions cannot be backdated';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id::text || ':' || p_product_id::text, 0));
  select * into v_customer from public.customers c where c.id = p_customer_id and c.is_active for key share;
  if not found then raise exception using errcode = '23503', message = 'Active customer not found'; end if;
  select * into v_product from public.products p where p.id = p_product_id and p.is_active for key share;
  if not found then raise exception using errcode = '23503', message = 'Active product not found'; end if;

  select * into v_previous
  from public.customer_product_prices cpp
  where cpp.customer_id = p_customer_id and cpp.product_id = p_product_id
  order by cpp.valid_from desc
  limit 1
  for update;

  if found then
    if p_valid_from <= v_previous.valid_from then
      raise exception using errcode = '22023', message = 'Effective date must be after the latest version; price versions cannot be backdated or replaced on the same date';
    end if;
    if v_previous.valid_until is null then
      update public.customer_product_prices
      set valid_until = p_valid_from - 1
      where id = v_previous.id;
    elsif v_previous.valid_until >= p_valid_from then
      raise exception using errcode = '22023', message = 'Effective date overlaps an existing price version';
    end if;
  end if;

  insert into public.customer_product_prices (customer_id, product_id, unit_price, valid_from, note, created_by)
  values (p_customer_id, p_product_id, p_unit_price, p_valid_from, nullif(pg_catalog.btrim(p_note), ''), auth.uid())
  returning id into v_price_id;
  return v_price_id;
end;
$$;
revoke all on function public.create_customer_product_price(uuid, uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function public.create_customer_product_price(uuid, uuid, numeric, date, text) to authenticated;

create or replace function public.create_sales_order(
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
  v_price public.customer_product_prices%rowtype;
  v_price_id uuid;
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
    v_discount := coalesce((v_line->>'discount_amount')::numeric, 0);
    v_price_id := null;
    if nullif(v_line->>'customer_product_price_id', '') is not null then
      v_price_id := (v_line->>'customer_product_price_id')::uuid;
      select * into v_price
      from public.customer_product_prices cpp
      where cpp.id = v_price_id
        and cpp.customer_id = p_customer_id
        and cpp.product_id = v_product.id
        and cpp.valid_from <= p_order_date
        and (cpp.valid_until is null or cpp.valid_until >= p_order_date)
      for share;
      if not found then
        raise exception using errcode = '23503', message = 'Selected customer price is not valid for this order date, customer or product';
      end if;
      v_unit_price := v_price.unit_price;
    else
      v_unit_price := (v_line->>'unit_price')::numeric;
    end if;
    if v_quantity <= 0 or v_unit_price < 0 or v_discount < 0 or v_discount > round(v_quantity * v_unit_price, 2) then
      raise exception using errcode = '22023', message = 'Order line quantity, price or discount is invalid';
    end if;
    insert into public.sales_order_lines (
      sales_order_id, line_number, product_id, product_code_snapshot,
      product_name_snapshot, unit_snapshot, quantity, unit_price_snapshot,
      discount_amount, customer_product_price_id, price_overridden
    ) values (
      v_order_id, v_line_number, v_product.id, v_product.code,
      v_product.name, v_product.unit, v_quantity, v_unit_price,
      v_discount, v_price_id, (v_price_id is null)
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