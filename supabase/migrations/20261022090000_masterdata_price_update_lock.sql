-- S2: update_scheduled_customer_product_price did not take the same
-- pg_advisory_xact_lock as create_customer_product_price, so a concurrent
-- "create new version" and "correct scheduled version" for the same
-- customer+product pair could race past each other's overlap/"later version
-- exists" checks and leave overlapping or inconsistent price history rows.
-- Re-create the function with the same lock, acquired right after the
-- target row is fetched (so we know customer_id/product_id) and before any
-- sibling-row checks run.

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

  -- Serialize against create_customer_product_price / concurrent updates for
  -- the same customer+product pair before evaluating sibling-row rules below.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_price.customer_id::text || ':' || v_price.product_id::text, 0));

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
revoke all on function public.update_scheduled_customer_product_price(uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function public.update_scheduled_customer_product_price(uuid, numeric, date, text) to authenticated;
