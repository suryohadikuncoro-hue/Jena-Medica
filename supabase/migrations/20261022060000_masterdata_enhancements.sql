-- Master data enhancements: customer tax status, customer ship-to addresses,
-- supplier bank accounts (owner/admin only), and price version corrections.
-- Customer price snapshots on existing orders/invoices are never rewritten;
-- only future (scheduled) versions can be edited or deleted, and open versions
-- can only be ended early.

alter table public.customers
  add column tax_status text not null default 'unverified' check (tax_status in ('pkp', 'non_pkp', 'unverified'));

create table public.customer_shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  label text not null check (length(pg_catalog.btrim(label)) > 0),
  address text not null check (length(pg_catalog.btrim(address)) > 0),
  contact_name text,
  phone text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_shipping_addresses_customer_idx on public.customer_shipping_addresses (customer_id);

-- Bank details are sensitive: visible and writable by owner/admin only.
create table public.supplier_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  bank_name text not null check (length(pg_catalog.btrim(bank_name)) > 0),
  account_number text not null check (length(pg_catalog.btrim(account_number)) > 0),
  account_name text not null check (length(pg_catalog.btrim(account_name)) > 0),
  note text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplier_bank_accounts_supplier_idx on public.supplier_bank_accounts (supplier_id);

alter table public.customer_shipping_addresses enable row level security;
alter table public.supplier_bank_accounts enable row level security;
revoke all on public.customer_shipping_addresses, public.supplier_bank_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.customer_shipping_addresses to authenticated;
grant select, insert, update, delete on public.supplier_bank_accounts to authenticated;

create policy customer_shipping_addresses_read_role on public.customer_shipping_addresses for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy customer_shipping_addresses_write_admin on public.customer_shipping_addresses for insert to authenticated
  with check ((select app_private.has_business_role(array['owner', 'admin'])));
create policy customer_shipping_addresses_update_admin on public.customer_shipping_addresses for update to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])))
  with check ((select app_private.has_business_role(array['owner', 'admin'])));
create policy customer_shipping_addresses_delete_admin on public.customer_shipping_addresses for delete to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])));

create policy supplier_bank_accounts_read_admin on public.supplier_bank_accounts for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])));
create policy supplier_bank_accounts_insert_admin on public.supplier_bank_accounts for insert to authenticated
  with check ((select app_private.has_business_role(array['owner', 'admin'])));
create policy supplier_bank_accounts_update_admin on public.supplier_bank_accounts for update to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])))
  with check ((select app_private.has_business_role(array['owner', 'admin'])));
create policy supplier_bank_accounts_delete_admin on public.supplier_bank_accounts for delete to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin'])));

-- Correct a scheduled (not yet effective) price version. Rejected when the
-- version is already effective, already referenced by an order/invoice line,
-- or when a later version exists for the same customer and product.
create or replace function public.update_scheduled_customer_product_price(
  p_price_id uuid,
  p_unit_price numeric,
  p_valid_from date,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price public.customer_product_prices%rowtype;
  v_previous public.customer_product_prices%rowtype;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_price_id is null or p_unit_price is null or p_valid_from is null then
    raise exception using errcode = '22023', message = 'Price version, unit price and effective date are required';
  end if;
  if p_unit_price < 0 then
    raise exception using errcode = '22023', message = 'Unit price cannot be negative';
  end if;
  select * into v_price
  from public.customer_product_prices cpp
  where cpp.id = p_price_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'Price version not found';
  end if;
  if v_price.valid_from <= current_date then
    raise exception using errcode = '22023', message = 'Only scheduled price versions that have not taken effect can be edited';
  end if;
  if p_valid_from <= current_date then
    raise exception using errcode = '22023', message = 'Price versions cannot be backdated';
  end if;
  if exists (
    select 1 from public.sales_order_lines sol where sol.customer_product_price_id = p_price_id
  ) or exists (
    select 1 from public.sales_invoice_lines sil where sil.customer_product_price_id = p_price_id
  ) then
    raise exception using errcode = '23503', message = 'Price version is already referenced by an order or invoice and cannot be edited';
  end if;
  if exists (
    select 1 from public.customer_product_prices cpp
    where cpp.customer_id = v_price.customer_id and cpp.product_id = v_price.product_id
      and cpp.valid_from > v_price.valid_from
  ) then
    raise exception using errcode = '22023', message = 'A later price version exists; only the latest scheduled version can be edited';
  end if;
  if p_valid_from <> v_price.valid_from then
    if exists (
      select 1 from public.customer_product_prices cpp
      where cpp.customer_id = v_price.customer_id and cpp.product_id = v_price.product_id
        and cpp.valid_from = p_valid_from
    ) then
      raise exception using errcode = '22023', message = 'Another price version already starts on that date';
    end if;
    select * into v_previous
    from public.customer_product_prices cpp
    where cpp.customer_id = v_price.customer_id and cpp.product_id = v_price.product_id
      and cpp.valid_from < v_price.valid_from
    order by cpp.valid_from desc
    limit 1;
    if found then
      if v_previous.valid_until is not null and v_previous.valid_until >= p_valid_from then
        raise exception using errcode = '22023', message = 'The previous price version would overlap the new effective date';
      end if;
      update public.customer_product_prices
      set valid_until = p_valid_from - 1
      where id = v_previous.id and valid_until is null;
    end if;
  end if;
  update public.customer_product_prices
  set unit_price = p_unit_price,
      valid_from = p_valid_from,
      note = nullif(pg_catalog.btrim(p_note), '')
  where id = p_price_id;
end;
$$;

-- End an open price version early. The version keeps its history; snapshots on
-- existing orders and invoices are unchanged. A version that starts today ends
-- after today; older versions end yesterday.
create or replace function public.end_customer_product_price(p_price_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price public.customer_product_prices%rowtype;
  v_end date;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_price_id is null then
    raise exception using errcode = '22023', message = 'Price version is required';
  end if;
  select * into v_price
  from public.customer_product_prices cpp
  where cpp.id = p_price_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'Price version not found';
  end if;
  if v_price.valid_until is not null then
    raise exception using errcode = '22023', message = 'Price version is already ended';
  end if;
  if v_price.valid_from > current_date then
    raise exception using errcode = '22023', message = 'Scheduled price versions should be deleted instead of ended';
  end if;
  v_end := greatest(current_date - 1, v_price.valid_from);
  update public.customer_product_prices
  set valid_until = v_end
  where id = p_price_id;
end;
$$;

-- Delete an unused scheduled price version.
create or replace function public.delete_scheduled_customer_product_price(p_price_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price public.customer_product_prices%rowtype;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_price_id is null then
    raise exception using errcode = '22023', message = 'Price version is required';
  end if;
  select * into v_price
  from public.customer_product_prices cpp
  where cpp.id = p_price_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'Price version not found';
  end if;
  if v_price.valid_from <= current_date then
    raise exception using errcode = '22023', message = 'Only scheduled price versions that have not taken effect can be deleted';
  end if;
  if exists (
    select 1 from public.sales_order_lines sol where sol.customer_product_price_id = p_price_id
  ) or exists (
    select 1 from public.sales_invoice_lines sil where sil.customer_product_price_id = p_price_id
  ) then
    raise exception using errcode = '23503', message = 'Price version is already referenced by an order or invoice and cannot be deleted';
  end if;
  delete from public.customer_product_prices where id = p_price_id;
end;
$$;

revoke all on function public.update_scheduled_customer_product_price(uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function public.update_scheduled_customer_product_price(uuid, numeric, date, text) to authenticated;
revoke all on function public.end_customer_product_price(uuid) from public, anon, authenticated;
grant execute on function public.end_customer_product_price(uuid) to authenticated;
revoke all on function public.delete_scheduled_customer_product_price(uuid) from public, anon, authenticated;
grant execute on function public.delete_scheduled_customer_product_price(uuid) to authenticated;
