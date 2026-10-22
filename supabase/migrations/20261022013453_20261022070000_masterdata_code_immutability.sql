-- K3 (audit finding): the `code` column on master data tables (customers,
-- suppliers, products) was only protected from edits by the UI disabling the
-- input field. Enforce immutability at the database level with a trigger so
-- a direct API/SQL call cannot change the code of an existing row either.

create or replace function app_private.prevent_code_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception using
      errcode = '22023',
      message = 'Code cannot be changed after creation';
  end if;
  return new;
end;
$$;
revoke all on function app_private.prevent_code_change() from public, anon, authenticated;

create trigger customers_prevent_code_change
  before update on public.customers
  for each row execute function app_private.prevent_code_change();

create trigger suppliers_prevent_code_change
  before update on public.suppliers
  for each row execute function app_private.prevent_code_change();

create trigger products_prevent_code_change
  before update on public.products
  for each row execute function app_private.prevent_code_change();
