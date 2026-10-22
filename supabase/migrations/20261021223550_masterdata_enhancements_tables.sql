-- Master data enhancements part 1: customer tax status, ship-to addresses, supplier bank accounts

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