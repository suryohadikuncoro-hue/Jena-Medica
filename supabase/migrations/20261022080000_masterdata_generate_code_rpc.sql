-- K4 (audit finding): client-side code suggestion (suggestCode/suggestSupplierCode)
-- read only the currently loaded page of rows and computed the next code
-- number in the browser. With server-side pagination (K2) this is no longer
-- even correct (it only sees one page), and it was always racy: two users
-- opening the "Add" form at the same time could get the same suggested code,
-- with the second insert failing a unique-constraint race.
--
-- Move code generation into a single atomic, server-side RPC that takes a
-- pg_advisory_xact_lock per (table, prefix) so concurrent calls are
-- serialized, computes the next number from the real max in the table
-- (not just a loaded page), and normalizes to uppercase.

create or replace function public.generate_master_data_code(
  p_table text,
  p_prefix text,
  p_pad integer default 4
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock_key bigint;
  v_prefix text;
  v_next integer;
  v_max integer;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_table not in ('customers', 'suppliers', 'products') then
    raise exception using errcode = '22023', message = 'Unsupported table for code generation';
  end if;
  if p_prefix is null or length(pg_catalog.btrim(p_prefix)) = 0 then
    raise exception using errcode = '22023', message = 'Prefix is required';
  end if;
  v_prefix := upper(pg_catalog.btrim(p_prefix));

  -- Serialize code generation per (table, prefix) so two concurrent requests
  -- never compute the same "next" number.
  v_lock_key := hashtextextended(p_table || ':' || v_prefix, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  if p_table = 'customers' then
    select coalesce(max((regexp_match(code, '^' || v_prefix || '(\d+)$'))[1]::integer), 0)
      into v_max from public.customers where code ~ ('^' || v_prefix || '\d+$');
  elsif p_table = 'suppliers' then
    select coalesce(max((regexp_match(code, '^' || v_prefix || '(\d+)$'))[1]::integer), 0)
      into v_max from public.suppliers where code ~ ('^' || v_prefix || '\d+$');
  else
    select coalesce(max((regexp_match(code, '^' || v_prefix || '(\d+)$'))[1]::integer), 0)
      into v_max from public.products where code ~ ('^' || v_prefix || '\d+$');
  end if;

  v_next := v_max + 1;
  return v_prefix || lpad(v_next::text, greatest(p_pad, 1), '0');
end;
$$;
revoke all on function public.generate_master_data_code(text, text, integer) from public, anon, authenticated;
grant execute on function public.generate_master_data_code(text, text, integer) to authenticated;
