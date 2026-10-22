-- S5: customers/suppliers/products only recorded updated_at, with no
-- updated_by and no history, so sensitive fields (tax status, payment
-- terms, active flag) that affect VAT/COGS calculations could not be
-- traced to a user or a prior value. Add updated_by plus an append-only
-- change log populated by an AFTER UPDATE trigger for those fields.
-- customer_product_prices is intentionally out of scope: it is already
-- append-only/versioned (see 20261016132858_customer_product_price_history.sql).

alter table public.customers add column updated_by uuid references auth.users(id) on delete set null;
alter table public.suppliers add column updated_by uuid references auth.users(id) on delete set null;
alter table public.products add column updated_by uuid references auth.users(id) on delete set null;

create or replace function app_private.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function app_private.set_updated_by() from public, anon, authenticated;

create trigger customers_set_updated_by before update on public.customers for each row execute function app_private.set_updated_by();
create trigger suppliers_set_updated_by before update on public.suppliers for each row execute function app_private.set_updated_by();
create trigger products_set_updated_by before update on public.products for each row execute function app_private.set_updated_by();

create table public.master_data_change_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null check (table_name in ('customers', 'suppliers', 'products')),
  row_id uuid not null,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index master_data_change_log_row_idx on public.master_data_change_log (table_name, row_id, changed_at desc);

alter table public.master_data_change_log enable row level security;
create policy master_data_change_log_select_business on public.master_data_change_log for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
-- No insert/update/delete policies: rows are written only by the trigger
-- function below, which runs with definer rights.

revoke all on public.master_data_change_log from public, anon, authenticated;
grant select on public.master_data_change_log to authenticated;

create or replace function app_private.log_customer_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tax_status is distinct from old.tax_status then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('customers', new.id, 'tax_status', old.tax_status, new.tax_status, auth.uid());
  end if;
  if new.payment_terms_days is distinct from old.payment_terms_days then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('customers', new.id, 'payment_terms_days', old.payment_terms_days::text, new.payment_terms_days::text, auth.uid());
  end if;
  if new.credit_limit is distinct from old.credit_limit then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('customers', new.id, 'credit_limit', old.credit_limit::text, new.credit_limit::text, auth.uid());
  end if;
  if new.is_active is distinct from old.is_active then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('customers', new.id, 'is_active', old.is_active::text, new.is_active::text, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function app_private.log_customer_change() from public, anon, authenticated;
create trigger customers_log_change after update on public.customers for each row execute function app_private.log_customer_change();

create or replace function app_private.log_supplier_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tax_status is distinct from old.tax_status then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('suppliers', new.id, 'tax_status', old.tax_status, new.tax_status, auth.uid());
  end if;
  if new.payment_terms_days is distinct from old.payment_terms_days then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('suppliers', new.id, 'payment_terms_days', old.payment_terms_days::text, new.payment_terms_days::text, auth.uid());
  end if;
  if new.is_active is distinct from old.is_active then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('suppliers', new.id, 'is_active', old.is_active::text, new.is_active::text, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function app_private.log_supplier_change() from public, anon, authenticated;
create trigger suppliers_log_change after update on public.suppliers for each row execute function app_private.log_supplier_change();

create or replace function app_private.log_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active then
    insert into public.master_data_change_log(table_name, row_id, field, old_value, new_value, changed_by)
    values ('products', new.id, 'is_active', old.is_active::text, new.is_active::text, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function app_private.log_product_change() from public, anon, authenticated;
create trigger products_log_change after update on public.products for each row execute function app_private.log_product_change();
