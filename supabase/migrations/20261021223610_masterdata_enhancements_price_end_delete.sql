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
revoke all on function public.end_customer_product_price(uuid) from public, anon, authenticated;
grant execute on function public.end_customer_product_price(uuid) to authenticated;
revoke all on function public.delete_scheduled_customer_product_price(uuid) from public, anon, authenticated;
grant execute on function public.delete_scheduled_customer_product_price(uuid) to authenticated;