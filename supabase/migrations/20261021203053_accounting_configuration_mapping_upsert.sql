-- Replace the accounting configuration save routine so mapping updates do not use an
-- unqualified DELETE, which Supabase's database guard correctly rejects.
-- The RPC remains atomic: all mapping upserts and the policy-profile update run in
-- the same transaction. Lock the singleton profile row to serialize concurrent saves.
create or replace function public.save_accounting_configuration(
  p_mappings jsonb,
  p_revenue_recognition_reference text,
  p_supplier_ap_recognition_reference text,
  p_supplier_cost_treatment_reference text,
  p_tax_policy_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_key text;
  v_account_id uuid;
  v_expected_type text;
  v_actual_type text;
  v_count integer := 0;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;

  -- Serialize saves as one logical configuration update.
  perform 1 from public.accounting_posting_profile where singleton for update;
  if not found then
    raise exception using errcode = '23514', message = 'Accounting posting profile is unavailable';
  end if;

  if p_mappings is null or pg_catalog.jsonb_typeof(p_mappings) <> 'array' or pg_catalog.jsonb_array_length(p_mappings) <> 10 then
    raise exception using errcode = '22023', message = 'Exactly 10 approved account mappings are required';
  end if;
  if nullif(pg_catalog.btrim(p_revenue_recognition_reference), '') is null
    or nullif(pg_catalog.btrim(p_supplier_ap_recognition_reference), '') is null
    or nullif(pg_catalog.btrim(p_supplier_cost_treatment_reference), '') is null
    or nullif(pg_catalog.btrim(p_tax_policy_reference), '') is null then
    raise exception using errcode = '22023', message = 'Revenue, AP, cost, and tax policy references are required';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_mappings) x(value)
    where pg_catalog.jsonb_typeof(x.value) <> 'object'
      or x.value->>'mapping_key' is null
      or x.value->>'account_id' is null
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_mappings) x(value)
    group by x.value->>'mapping_key'
    having pg_catalog.count(*) <> 1
  ) then
    raise exception using errcode = '22023', message = 'Mapping payload is invalid or contains duplicate keys';
  end if;
  if exists (
    select needed.mapping_key
    from (values
      ('accounts_receivable','asset'),
      ('accounts_payable','liability'),
      ('customer_advances','liability'),
      ('supplier_advances','asset'),
      ('cash','asset'),
      ('bank','asset'),
      ('sales_revenue','revenue'),
      ('supplier_cost_clearing','asset'),
      ('vat_output','liability'),
      ('vat_input','asset')
    ) as needed(mapping_key, expected_type)
    left join pg_catalog.jsonb_array_elements(p_mappings) x(value)
      on x.value->>'mapping_key' = needed.mapping_key
    where x.value is null
  ) then
    raise exception using errcode = '22023', message = 'All required mapping keys must be supplied';
  end if;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_mappings) as items(value)
  loop
    v_key := v_item->>'mapping_key';
    v_account_id := (v_item->>'account_id')::uuid;
    v_expected_type := case v_key
      when 'accounts_receivable' then 'asset'
      when 'accounts_payable' then 'liability'
      when 'customer_advances' then 'liability'
      when 'supplier_advances' then 'asset'
      when 'cash' then 'asset'
      when 'bank' then 'asset'
      when 'sales_revenue' then 'revenue'
      when 'supplier_cost_clearing' then 'asset'
      when 'vat_output' then 'liability'
      when 'vat_input' then 'asset'
      else null
    end;

    select a.account_type
    into v_actual_type
    from public.chart_of_accounts a
    where a.id = v_account_id and a.is_active
    for key share;

    if not found or v_actual_type is distinct from v_expected_type then
      raise exception using errcode = '23514', message = 'Each mapped account must exist, be active, and have the required account type';
    end if;

    insert into public.accounting_account_mappings(mapping_key, account_id, updated_by)
    values (v_key, v_account_id, auth.uid())
    on conflict (mapping_key) do update
      set account_id = excluded.account_id,
          updated_by = excluded.updated_by,
          updated_at = pg_catalog.now();

    v_count := v_count + 1;
  end loop;

  if v_count <> 10 then
    raise exception using errcode = '22023', message = 'Exactly 10 unique mappings are required';
  end if;

  update public.accounting_posting_profile
  set status = 'draft',
      revenue_recognition_reference = pg_catalog.btrim(p_revenue_recognition_reference),
      supplier_ap_recognition_reference = pg_catalog.btrim(p_supplier_ap_recognition_reference),
      supplier_cost_treatment_reference = pg_catalog.btrim(p_supplier_cost_treatment_reference),
      tax_policy_reference = pg_catalog.btrim(p_tax_policy_reference),
      approval_reference = null,
      approved_by = null,
      approved_at = null,
      updated_by = auth.uid(),
      updated_at = pg_catalog.now()
  where singleton;
end;
$$;