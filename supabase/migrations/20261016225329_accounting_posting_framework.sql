-- Configurable accounting framework. No chart of accounts, mappings, periods, or approvals are seeded.
-- Posting is unavailable until an Owner/Admin records approved policies, account mappings, and an open period.
-- Customer tax amounts are entered from an approved tax decision; this migration does not calculate PPN.

create sequence public.journal_entry_number_seq;

create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null check (length(pg_catalog.btrim(account_code)) > 0),
  account_name text not null check (length(pg_catalog.btrim(account_name)) > 0),
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  description text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index chart_of_accounts_code_ci_uq on public.chart_of_accounts (pg_catalog.lower(pg_catalog.btrim(account_code)));
create index chart_of_accounts_type_active_idx on public.chart_of_accounts (account_type, is_active, account_code);

create table public.accounting_posting_profile (
  singleton boolean primary key default true check (singleton),
  status text not null default 'draft' check (status in ('draft', 'approved', 'revoked')),
  revenue_recognition_reference text,
  supplier_ap_recognition_reference text,
  supplier_cost_treatment_reference text,
  tax_policy_reference text,
  approval_reference text,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint accounting_posting_profile_approval_state check (
    (status = 'approved' and approved_by is not null and approved_at is not null and nullif(pg_catalog.btrim(approval_reference), '') is not null)
    or (status in ('draft', 'revoked') and approved_by is null and approved_at is null)
  )
);
insert into public.accounting_posting_profile(singleton) values (true);

create table public.accounting_account_mappings (
  mapping_key text primary key check (mapping_key in (
    'accounts_receivable', 'accounts_payable', 'customer_advances', 'supplier_advances',
    'cash', 'bank', 'sales_revenue', 'supplier_cost_clearing', 'vat_output', 'vat_input'
  )),
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  updated_at timestamptz not null default now()
);
create index accounting_account_mappings_account_idx on public.accounting_account_mappings (account_id);

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  opened_by uuid references auth.users(id) on delete restrict,
  opened_at timestamptz,
  closed_by uuid references auth.users(id) on delete restrict,
  closed_at timestamptz,
  close_reason text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint accounting_periods_dates check (period_end >= period_start),
  constraint accounting_periods_state check (
    (status = 'draft' and opened_by is null and opened_at is null and closed_by is null and closed_at is null and close_reason is null)
    or (status = 'open' and opened_by is not null and opened_at is not null and closed_by is null and closed_at is null and close_reason is null)
    or (status = 'closed' and opened_by is not null and opened_at is not null and closed_by is not null and closed_at is not null and nullif(pg_catalog.btrim(close_reason), '') is not null)
  ),
  unique (period_start, period_end)
);
create index accounting_periods_status_range_idx on public.accounting_periods (status, period_start, period_end);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text not null unique,
  idempotency_key uuid not null unique,
  request_hash text not null,
  source_type text not null check (source_type in (
    'customer_invoice', 'supplier_invoice', 'customer_payment', 'supplier_payment',
    'customer_allocation', 'supplier_allocation', 'reversal'
  )),
  source_id uuid not null,
  entry_date date not null,
  memo text not null check (length(pg_catalog.btrim(memo)) > 0),
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  total_debit numeric(20,2) not null check (total_debit > 0),
  total_credit numeric(20,2) not null check (total_credit > 0 and total_credit = total_debit),
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  reversal_of_id uuid unique references public.journal_entries(id) on delete restrict,
  reversal_reason text,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (source_type, source_id),
  constraint journal_entries_reversal_state check (
    (status = 'posted' and reversal_reason is null and reversed_by is null and reversed_at is null)
    or (status = 'reversed' and reversal_reason is not null and reversed_by is not null and reversed_at is not null)
  )
);
create index journal_entries_date_number_idx on public.journal_entries (entry_date desc, entry_number desc);
create index journal_entries_source_idx on public.journal_entries (source_type, source_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  description text not null check (length(pg_catalog.btrim(description)) > 0),
  debit numeric(20,2) not null default 0 check (debit >= 0),
  credit numeric(20,2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  constraint journal_lines_one_side_only check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  unique (journal_entry_id, line_number)
);
create index journal_lines_account_entry_idx on public.journal_lines (account_id, journal_entry_id);

-- Invoice posting metadata is separate from draft capture. Customer tax is manually approved and never calculated here.
alter table public.sales_invoices
  add column issued_invoice_number text,
  add column tax_status text not null default 'unreviewed',
  add column tax_code_snapshot text,
  add column tax_base_amount numeric(20,2),
  add column tax_rate_reported numeric(7,4),
  add column tax_amount numeric(20,2) not null default 0,
  add column tax_approval_reference text,
  add column issued_by uuid references auth.users(id) on delete restrict,
  add column issued_at timestamptz;
alter table public.sales_invoices drop constraint if exists sales_invoices_status_check;
alter table public.sales_invoices drop constraint if exists sales_invoices_void_state_consistent;
alter table public.sales_invoices drop constraint if exists sales_invoices_amounts_balance;
alter table public.sales_invoices
  add constraint sales_invoices_status_check check (status in ('draft', 'issued', 'void')),
  add constraint sales_invoices_amounts_balance check (total_amount = subtotal_amount + tax_amount),
  add constraint sales_invoices_tax_values check (
    tax_amount >= 0 and (tax_base_amount is null or tax_base_amount >= 0)
    and (tax_rate_reported is null or tax_rate_reported between 0 and 100)
    and tax_status in ('unreviewed', 'taxed', 'non_taxed', 'exempt', 'zero_rated')
    and (tax_status not in ('non_taxed', 'exempt', 'zero_rated') or tax_amount = 0)
  ),
  add constraint sales_invoices_issue_state check (
    (status = 'draft' and issued_invoice_number is null and issued_by is null and issued_at is null)
    or (status = 'issued' and nullif(pg_catalog.btrim(issued_invoice_number), '') is not null and issued_by is not null and issued_at is not null and tax_status <> 'unreviewed' and nullif(pg_catalog.btrim(tax_approval_reference), '') is not null)
    or (status = 'void' and issued_invoice_number is null and issued_by is null and issued_at is null and nullif(pg_catalog.btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  );
create unique index sales_invoices_issued_number_ci_uq on public.sales_invoices (pg_catalog.lower(pg_catalog.btrim(issued_invoice_number))) where issued_invoice_number is not null;

alter table public.customer_payment_allocation_batches add column allocation_date date not null default current_date;
alter table public.supplier_payment_allocation_batches add column allocation_date date not null default current_date;

alter table public.supplier_invoices
  add column input_tax_treatment text not null default 'unreviewed',
  add column input_tax_review_reference text,
  add column posted_by uuid references auth.users(id) on delete restrict,
  add column posted_at timestamptz;
alter table public.supplier_invoices drop constraint if exists supplier_invoices_status_check;
alter table public.supplier_invoices drop constraint if exists supplier_invoices_void_state_consistent;
alter table public.supplier_invoices
  add constraint supplier_invoices_status_check check (status in ('draft', 'posted', 'void')),
  add constraint supplier_invoices_input_tax_treatment check (input_tax_treatment in ('unreviewed', 'recoverable', 'nonrecoverable', 'not_applicable')),
  add constraint supplier_invoices_post_state check (
    (status = 'draft' and posted_by is null and posted_at is null and void_reason is null and voided_by is null and voided_at is null)
    or (status = 'posted' and posted_by is not null and posted_at is not null and void_reason is null and voided_by is null and voided_at is null and input_tax_treatment <> 'unreviewed' and nullif(pg_catalog.btrim(input_tax_review_reference), '') is not null)
    or (status = 'void' and posted_by is null and posted_at is null and input_tax_treatment = 'unreviewed' and nullif(pg_catalog.btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  );

alter table public.chart_of_accounts enable row level security;
alter table public.accounting_posting_profile enable row level security;
alter table public.accounting_account_mappings enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
revoke all on public.chart_of_accounts, public.accounting_posting_profile, public.accounting_account_mappings,
  public.accounting_periods, public.journal_entries, public.journal_lines from public, anon, authenticated;
grant select on public.chart_of_accounts, public.accounting_posting_profile, public.accounting_account_mappings,
  public.accounting_periods, public.journal_entries, public.journal_lines to authenticated;

create policy chart_of_accounts_read_role on public.chart_of_accounts for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy accounting_posting_profile_read_role on public.accounting_posting_profile for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy accounting_account_mappings_read_role on public.accounting_account_mappings for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy accounting_periods_read_role on public.accounting_periods for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy journal_entries_read_role on public.journal_entries for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy journal_lines_read_role on public.journal_lines for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));

create function public.create_accounting_account(p_account_code text, p_account_name text, p_account_type text, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if p_account_code is null or pg_catalog.length(pg_catalog.btrim(p_account_code)) = 0 or p_account_name is null or pg_catalog.length(pg_catalog.btrim(p_account_name)) = 0 then
    raise exception using errcode = '22023', message = 'Account code and name are required';
  end if;
  if p_account_type not in ('asset', 'liability', 'equity', 'revenue', 'expense') then raise exception using errcode = '22023', message = 'Invalid account type'; end if;
  insert into public.chart_of_accounts(account_code, account_name, account_type, description, created_by)
  values (pg_catalog.btrim(p_account_code), pg_catalog.btrim(p_account_name), p_account_type, nullif(pg_catalog.btrim(p_description), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_accounting_account(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_accounting_account(text, text, text, text) to authenticated;

create function public.set_accounting_account_active(p_account_id uuid, p_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if p_account_id is null or p_is_active is null then raise exception using errcode = '22023', message = 'Account and active state are required'; end if;
  if not p_is_active and exists (select 1 from public.accounting_account_mappings m where m.account_id = p_account_id) then
    raise exception using errcode = '23514', message = 'Remove this account from all posting mappings before deactivating it';
  end if;
  update public.chart_of_accounts set is_active = p_is_active, updated_at = pg_catalog.now() where id = p_account_id;
  if not found then raise exception using errcode = 'P0002', message = 'Account not found'; end if;
end $$;
revoke all on function public.set_accounting_account_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_accounting_account_active(uuid, boolean) to authenticated;

create function public.save_accounting_configuration(
  p_mappings jsonb,
  p_revenue_recognition_reference text,
  p_supplier_ap_recognition_reference text,
  p_supplier_cost_treatment_reference text,
  p_tax_policy_reference text
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_key text; v_account_id uuid; v_expected_type text; v_actual_type text; v_count integer := 0;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if p_mappings is null or pg_catalog.jsonb_typeof(p_mappings) <> 'array' or pg_catalog.jsonb_array_length(p_mappings) <> 10 then
    raise exception using errcode = '22023', message = 'Exactly 10 approved account mappings are required';
  end if;
  if nullif(pg_catalog.btrim(p_revenue_recognition_reference), '') is null or nullif(pg_catalog.btrim(p_supplier_ap_recognition_reference), '') is null
    or nullif(pg_catalog.btrim(p_supplier_cost_treatment_reference), '') is null or nullif(pg_catalog.btrim(p_tax_policy_reference), '') is null then
    raise exception using errcode = '22023', message = 'Revenue, AP, cost, and tax policy references are required';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_mappings) x(value) where pg_catalog.jsonb_typeof(x.value) <> 'object' or x.value->>'mapping_key' is null or x.value->>'account_id' is null)
    or exists (select 1 from pg_catalog.jsonb_array_elements(p_mappings) x(value) group by x.value->>'mapping_key' having pg_catalog.count(*) <> 1) then
    raise exception using errcode = '22023', message = 'Mapping payload is invalid or contains duplicate keys';
  end if;
  if exists (
    select needed.mapping_key from (values
      ('accounts_receivable','asset'),('accounts_payable','liability'),('customer_advances','liability'),('supplier_advances','asset'),
      ('cash','asset'),('bank','asset'),('sales_revenue','revenue'),('supplier_cost_clearing','asset'),('vat_output','liability'),('vat_input','asset')
    ) as needed(mapping_key, expected_type)
    left join pg_catalog.jsonb_array_elements(p_mappings) x(value) on x.value->>'mapping_key' = needed.mapping_key
    where x.value is null
  ) then raise exception using errcode = '22023', message = 'All required mapping keys must be supplied'; end if;
  delete from public.accounting_account_mappings;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_mappings) as items(value) loop
    v_key := v_item->>'mapping_key';
    v_account_id := (v_item->>'account_id')::uuid;
    v_expected_type := case v_key
      when 'accounts_receivable' then 'asset' when 'accounts_payable' then 'liability'
      when 'customer_advances' then 'liability' when 'supplier_advances' then 'asset'
      when 'cash' then 'asset' when 'bank' then 'asset' when 'sales_revenue' then 'revenue'
      when 'supplier_cost_clearing' then 'asset' when 'vat_output' then 'liability' when 'vat_input' then 'asset'
      else null end;
    select a.account_type into v_actual_type from public.chart_of_accounts a where a.id = v_account_id and a.is_active for key share;
    if not found or v_actual_type is distinct from v_expected_type then raise exception using errcode = '23514', message = 'Each mapped account must exist, be active, and have the required account type'; end if;
    insert into public.accounting_account_mappings(mapping_key, account_id, updated_by) values (v_key, v_account_id, auth.uid());
    v_count := v_count + 1;
  end loop;
  if v_count <> 10 then raise exception using errcode = '22023', message = 'Exactly 10 unique mappings are required'; end if;
  update public.accounting_posting_profile set status = 'draft', revenue_recognition_reference = pg_catalog.btrim(p_revenue_recognition_reference),
    supplier_ap_recognition_reference = pg_catalog.btrim(p_supplier_ap_recognition_reference), supplier_cost_treatment_reference = pg_catalog.btrim(p_supplier_cost_treatment_reference),
    tax_policy_reference = pg_catalog.btrim(p_tax_policy_reference), approval_reference = null, approved_by = null, approved_at = null,
    updated_by = auth.uid(), updated_at = pg_catalog.now() where singleton;
end $$;
revoke all on function public.save_accounting_configuration(jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_accounting_configuration(jsonb, text, text, text, text) to authenticated;

create function public.approve_accounting_configuration(p_approval_reference text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if nullif(pg_catalog.btrim(p_approval_reference), '') is null then raise exception using errcode = '22023', message = 'Approval reference is required'; end if;
  if (select pg_catalog.count(*) from public.accounting_account_mappings) <> 10 then raise exception using errcode = '23514', message = 'Complete all 10 account mappings before approval'; end if;
  if exists (select 1 from public.accounting_account_mappings m join public.chart_of_accounts a on a.id = m.account_id where not a.is_active) then
    raise exception using errcode = '23514', message = 'Inactive account mappings cannot be approved';
  end if;
  update public.accounting_posting_profile set status = 'approved', approval_reference = pg_catalog.btrim(p_approval_reference), approved_by = auth.uid(), approved_at = pg_catalog.now(), updated_by = auth.uid(), updated_at = pg_catalog.now()
  where singleton and nullif(pg_catalog.btrim(revenue_recognition_reference), '') is not null
    and nullif(pg_catalog.btrim(supplier_ap_recognition_reference), '') is not null
    and nullif(pg_catalog.btrim(supplier_cost_treatment_reference), '') is not null
    and nullif(pg_catalog.btrim(tax_policy_reference), '') is not null;
  if not found then raise exception using errcode = '23514', message = 'Save all accounting policy references before approval'; end if;
end $$;
revoke all on function public.approve_accounting_configuration(text) from public, anon, authenticated;
grant execute on function public.approve_accounting_configuration(text) to authenticated;

create function public.revoke_accounting_configuration(p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then raise exception using errcode = '22023', message = 'Revocation reason is required'; end if;
  update public.accounting_posting_profile set status = 'revoked', approval_reference = 'Revoked: ' || pg_catalog.btrim(p_reason), approved_by = null, approved_at = null, updated_by = auth.uid(), updated_at = pg_catalog.now() where singleton;
end $$;
revoke all on function public.revoke_accounting_configuration(text) from public, anon, authenticated;
grant execute on function public.revoke_accounting_configuration(text) to authenticated;

create function public.create_and_open_accounting_period(p_period_start date, p_period_end date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if (select status from public.accounting_posting_profile where singleton) <> 'approved' then raise exception using errcode = '55000', message = 'Accounting configuration must be approved before opening a posting period'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then raise exception using errcode = '22023', message = 'Period start and end dates are invalid'; end if;
  if exists (select 1 from public.accounting_periods p where p.period_start <= p_period_end and p.period_end >= p_period_start) then raise exception using errcode = '23505', message = 'Accounting periods may not overlap'; end if;
  insert into public.accounting_periods(period_start, period_end, status, opened_by, opened_at, created_by)
  values (p_period_start, p_period_end, 'open', auth.uid(), pg_catalog.now(), auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_and_open_accounting_period(date, date) from public, anon, authenticated;
grant execute on function public.create_and_open_accounting_period(date, date) to authenticated;

create function public.close_accounting_period(p_period_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_period public.accounting_periods%rowtype;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then raise exception using errcode = '22023', message = 'Close reason is required'; end if;
  select * into v_period from public.accounting_periods where id = p_period_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Accounting period not found'; end if;
  if v_period.status <> 'open' then raise exception using errcode = '22023', message = 'Only an open period can be closed'; end if;
  if exists (select 1 from public.journal_entries j where j.entry_date between v_period.period_start and v_period.period_end and j.total_debit <> j.total_credit) then
    raise exception using errcode = '23514', message = 'Unbalanced journal entries prevent period close';
  end if;
  if exists (select 1 from public.sales_invoices i where i.status='draft' and i.invoice_date between v_period.period_start and v_period.period_end)
    or exists (select 1 from public.supplier_invoices i where i.status='draft' and i.invoice_date between v_period.period_start and v_period.period_end)
    or exists (select 1 from public.customer_payments p where p.status='recorded' and p.payment_date between v_period.period_start and v_period.period_end and not exists(select 1 from public.journal_entries j where j.source_type='customer_payment' and j.source_id=p.id))
    or exists (select 1 from public.supplier_payments p where p.status='recorded' and p.payment_date between v_period.period_start and v_period.period_end and not exists(select 1 from public.journal_entries j where j.source_type='supplier_payment' and j.source_id=p.id))
    or exists (select 1 from public.customer_payment_allocation_batches b where b.status='active' and b.allocation_date between v_period.period_start and v_period.period_end and not exists(select 1 from public.journal_entries j where j.source_type='customer_allocation' and j.source_id=b.id))
    or exists (select 1 from public.supplier_payment_allocation_batches b where b.status='active' and b.allocation_date between v_period.period_start and v_period.period_end and not exists(select 1 from public.journal_entries j where j.source_type='supplier_allocation' and j.source_id=b.id)) then
    raise exception using errcode = '23514', message = 'Pending AP/AR, payment, or allocation sources prevent period close';
  end if;
  update public.accounting_periods set status = 'closed', closed_by = auth.uid(), closed_at = pg_catalog.now(), close_reason = pg_catalog.btrim(p_reason) where id = p_period_id;
end $$;
revoke all on function public.close_accounting_period(uuid, text) from public, anon, authenticated;
grant execute on function public.close_accounting_period(uuid, text) to authenticated;

create function app_private.assert_accounting_posting_ready(p_entry_date date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if (select status from public.accounting_posting_profile where singleton) <> 'approved' then raise exception using errcode = '55000', message = 'Accounting posting is locked: approved configuration and policy references are required'; end if;
  if p_entry_date is null or not exists (select 1 from public.accounting_periods p where p.status = 'open' and p_entry_date between p.period_start and p.period_end) then
    raise exception using errcode = '55000', message = 'No open accounting period covers the posting date';
  end if;
  if (select pg_catalog.count(*) from public.accounting_account_mappings m join public.chart_of_accounts a on a.id = m.account_id where a.is_active) <> 10 then
    raise exception using errcode = '55000', message = 'All mapped accounts must remain active';
  end if;
end $$;
revoke all on function app_private.assert_accounting_posting_ready(date) from public, anon, authenticated;

create function app_private.post_balanced_journal(
  p_source_type text, p_source_id uuid, p_entry_date date, p_memo text, p_idempotency_key uuid, p_lines jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.journal_entries%rowtype; v_hash text; v_id uuid; v_number text; v_seq bigint;
  v_item jsonb; v_account uuid; v_debit numeric(20,2); v_credit numeric(20,2); v_desc text;
  v_debits numeric(20,2) := 0; v_credits numeric(20,2) := 0; v_line_no integer := 0;
begin
  perform app_private.assert_accounting_posting_ready(p_entry_date);
  if p_source_type not in ('customer_invoice','supplier_invoice','customer_payment','supplier_payment','customer_allocation','supplier_allocation','reversal')
    or p_source_id is null or p_idempotency_key is null or nullif(pg_catalog.btrim(p_memo), '') is null then
    raise exception using errcode = '22023', message = 'Journal source, idempotency key and memo are required';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array' or pg_catalog.jsonb_array_length(p_lines) < 2 then
    raise exception using errcode = '22023', message = 'At least two journal lines are required';
  end if;
  v_hash := pg_catalog.md5(p_source_type || ':' || p_source_id::text || ':' || p_entry_date::text || ':' || p_memo || ':' || p_lines::text);
  select * into v_existing from public.journal_entries where source_type = p_source_type and source_id = p_source_id;
  if found then
    if v_existing.idempotency_key = p_idempotency_key and v_existing.request_hash = v_hash then return v_existing.id; end if;
    raise exception using errcode = '23505', message = 'This source already has a journal with a different payload';
  end if;
  if exists (select 1 from public.journal_entries where idempotency_key = p_idempotency_key) then
    raise exception using errcode = '23505', message = 'Idempotency key was already used for another journal';
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_lines) as items(value) loop
    v_line_no := v_line_no + 1;
    if pg_catalog.jsonb_typeof(v_item) <> 'object' or v_item->>'account_id' is null or v_item->>'debit' is null or v_item->>'credit' is null or nullif(pg_catalog.btrim(v_item->>'description'), '') is null then
      raise exception using errcode = '22023', message = 'Each journal line requires account, debit, credit and description';
    end if;
    v_account := (v_item->>'account_id')::uuid; v_debit := (v_item->>'debit')::numeric; v_credit := (v_item->>'credit')::numeric; v_desc := pg_catalog.btrim(v_item->>'description');
    if v_debit < 0 or v_credit < 0 or v_debit::text in ('NaN','Infinity','-Infinity') or v_credit::text in ('NaN','Infinity','-Infinity')
      or v_debit <> pg_catalog.round(v_debit,2) or v_credit <> pg_catalog.round(v_credit,2) or not ((v_debit > 0 and v_credit = 0) or (v_credit > 0 and v_debit = 0)) then
      raise exception using errcode = '22023', message = 'Journal amounts must be finite, nonnegative, two-decimal, and on exactly one side';
    end if;
    if not exists (select 1 from public.chart_of_accounts a where a.id = v_account and a.is_active) then raise exception using errcode = '23503', message = 'Journal account is missing or inactive'; end if;
    v_debits := v_debits + v_debit; v_credits := v_credits + v_credit;
  end loop;
  if v_debits <= 0 or v_debits <> v_credits then raise exception using errcode = '23514', message = 'Journal must balance and have a positive total'; end if;
  v_seq := pg_catalog.nextval('public.journal_entry_number_seq'::regclass);
  v_number := 'JRN-' || pg_catalog.to_char(p_entry_date, 'YYYYMM') || '-' || pg_catalog.lpad(v_seq::text, greatest(6, pg_catalog.length(v_seq::text)), '0');
  insert into public.journal_entries(entry_number,idempotency_key,request_hash,source_type,source_id,entry_date,memo,total_debit,total_credit,created_by)
    values (v_number,p_idempotency_key,v_hash,p_source_type,p_source_id,p_entry_date,pg_catalog.btrim(p_memo),v_debits,v_credits,auth.uid()) returning id into v_id;
  v_line_no := 0;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_lines) as items(value) loop
    v_line_no := v_line_no + 1;
    insert into public.journal_lines(journal_entry_id,line_number,account_id,description,debit,credit)
    values (v_id,v_line_no,(v_item->>'account_id')::uuid,pg_catalog.btrim(v_item->>'description'),(v_item->>'debit')::numeric,(v_item->>'credit')::numeric);
  end loop;
  return v_id;
end $$;
revoke all on function app_private.post_balanced_journal(text, uuid, date, text, uuid, jsonb) from public, anon, authenticated;

create function public.post_customer_invoice_to_ar(
  p_customer_invoice_id uuid, p_issued_invoice_number text, p_tax_status text, p_tax_code text,
  p_tax_base_amount numeric, p_tax_rate numeric, p_tax_amount numeric, p_tax_approval_reference text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invoice public.sales_invoices%rowtype; v_id uuid; v_ar uuid; v_revenue uuid; v_vat uuid; v_lines jsonb; v_key uuid;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  select * into v_invoice from public.sales_invoices where id = p_customer_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Customer invoice not found'; end if;
  if v_invoice.status = 'issued' then select id into v_id from public.journal_entries where source_type='customer_invoice' and source_id=v_invoice.id; if found then return v_id; end if; end if;
  if v_invoice.status <> 'draft' then raise exception using errcode = '22023', message = 'Only a draft customer invoice can be issued and posted'; end if;
  if nullif(pg_catalog.btrim(p_issued_invoice_number), '') is null or p_tax_status not in ('taxed','non_taxed','exempt','zero_rated')
    or p_tax_base_amount is null or p_tax_base_amount < 0 or p_tax_base_amount <> pg_catalog.round(p_tax_base_amount,2) or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 or p_tax_rate <> pg_catalog.round(p_tax_rate,4)
    or p_tax_amount is null or p_tax_amount < 0 or p_tax_amount::text in ('NaN','Infinity','-Infinity') or p_tax_amount <> pg_catalog.round(p_tax_amount,2)
    or p_tax_status is null or nullif(pg_catalog.btrim(p_tax_approval_reference), '') is null then
    raise exception using errcode = '22023', message = 'Invoice number and approved tax decision values/reference are required';
  end if;
  if p_tax_status in ('non_taxed','exempt','zero_rated') and p_tax_amount <> 0 then raise exception using errcode = '22023', message = 'Non-taxable/exempt/zero-rated treatment must have zero tax amount'; end if;
  if p_tax_status = 'taxed' and (nullif(pg_catalog.btrim(p_tax_code), '') is null or p_tax_rate <= 0 or p_tax_amount <= 0) then raise exception using errcode = '22023', message = 'Tax code, positive rate, and positive tax amount are required for taxed invoices'; end if;
  if p_tax_amount + v_invoice.subtotal_amount > 99999999999999999.99 then raise exception using errcode = '22003', message = 'Invoice total exceeds supported precision'; end if;
  perform app_private.assert_accounting_posting_ready(v_invoice.invoice_date);
  select account_id into v_ar from public.accounting_account_mappings where mapping_key='accounts_receivable';
  select account_id into v_revenue from public.accounting_account_mappings where mapping_key='sales_revenue';
  select account_id into v_vat from public.accounting_account_mappings where mapping_key='vat_output';
  v_lines := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('account_id',v_ar,'debit',v_invoice.subtotal_amount+p_tax_amount,'credit',0,'description','Piutang invoice pelanggan'),
    pg_catalog.jsonb_build_object('account_id',v_revenue,'debit',0,'credit',v_invoice.subtotal_amount,'description','Pendapatan penjualan')
  );
  if p_tax_amount > 0 then v_lines := v_lines || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('account_id',v_vat,'debit',0,'credit',p_tax_amount,'description','PPN keluaran sesuai keputusan pajak yang disetujui')); end if;
  v_key := pg_catalog.gen_random_uuid();
  v_id := app_private.post_balanced_journal('customer_invoice',v_invoice.id,v_invoice.invoice_date,'Posting AR '||pg_catalog.btrim(p_issued_invoice_number),v_key,v_lines);
  update public.sales_invoices set status='issued', issued_invoice_number=pg_catalog.btrim(p_issued_invoice_number), tax_status=p_tax_status,
    tax_code_snapshot=nullif(pg_catalog.btrim(p_tax_code),''), tax_base_amount=p_tax_base_amount, tax_rate_reported=p_tax_rate,
    tax_amount=p_tax_amount, tax_approval_reference=pg_catalog.btrim(p_tax_approval_reference), total_amount=subtotal_amount+p_tax_amount,
    issued_by=auth.uid(), issued_at=pg_catalog.now() where id=v_invoice.id;
  return v_id;
end $$;
revoke all on function public.post_customer_invoice_to_ar(uuid,text,text,text,numeric,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.post_customer_invoice_to_ar(uuid,text,text,text,numeric,numeric,numeric,text) to authenticated;

create function public.post_supplier_invoice_to_ap(p_supplier_invoice_id uuid, p_input_tax_treatment text, p_tax_review_reference text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invoice public.supplier_invoices%rowtype; v_id uuid; v_ap uuid; v_cost uuid; v_vat uuid; v_tax numeric(20,2); v_cost_amount numeric(20,2); v_expected_total numeric(20,2); v_lines jsonb;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  select * into v_invoice from public.supplier_invoices where id=p_supplier_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Supplier invoice not found'; end if;
  if v_invoice.status='posted' then select id into v_id from public.journal_entries where source_type='supplier_invoice' and source_id=v_invoice.id; if found then return v_id; end if; end if;
  if v_invoice.status <> 'draft' then raise exception using errcode = '22023', message = 'Only a draft supplier invoice can be posted'; end if;
  if v_invoice.tax_status='unverified' or p_input_tax_treatment is null or p_input_tax_treatment not in ('recoverable','nonrecoverable','not_applicable') or nullif(pg_catalog.btrim(p_tax_review_reference),'') is null then
    raise exception using errcode = '22023', message = 'Supplier tax status, input-tax treatment and approval reference must be verified';
  end if;
  v_expected_total := v_invoice.subtotal_reported-v_invoice.discount_amount_reported+v_invoice.other_charges_reported;
  if v_invoice.price_mode <> 'inclusive' then v_expected_total := v_expected_total+v_invoice.tax_amount_reported; end if;
  if pg_catalog.round(v_expected_total,2) <> v_invoice.invoice_total_reported then
    raise exception using errcode = '23514', message = 'Supplier invoice header amounts do not reconcile for the selected inclusive/exclusive mode';
  end if;
  if v_invoice.tax_status='non_taxed' and (v_invoice.tax_amount_reported <> 0 or p_input_tax_treatment <> 'not_applicable') then raise exception using errcode = '23514', message = 'Non-taxed supplier invoice must have zero tax and not-applicable input tax'; end if;
  if v_invoice.tax_status='taxed' and p_input_tax_treatment='not_applicable' then raise exception using errcode = '23514', message = 'Taxed supplier invoice requires a recoverable/nonrecoverable input tax decision'; end if;
  if p_input_tax_treatment='recoverable' and v_invoice.tax_amount_reported <= 0 then raise exception using errcode = '23514', message = 'Recoverable input tax amount must be greater than zero'; end if;
  perform app_private.assert_accounting_posting_ready(v_invoice.invoice_date);
  select account_id into v_ap from public.accounting_account_mappings where mapping_key='accounts_payable';
  select account_id into v_cost from public.accounting_account_mappings where mapping_key='supplier_cost_clearing';
  select account_id into v_vat from public.accounting_account_mappings where mapping_key='vat_input';
  v_tax := case when p_input_tax_treatment='recoverable' then v_invoice.tax_amount_reported else 0 end;
  v_cost_amount := v_invoice.invoice_total_reported-v_tax;
  v_lines := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('account_id',v_cost,'debit',v_cost_amount,'credit',0,'description','Biaya supplier dalam akun clearing; belum direklasifikasi ke HPP'),
    pg_catalog.jsonb_build_object('account_id',v_ap,'debit',0,'credit',v_invoice.invoice_total_reported,'description','Hutang supplier')
  );
  if v_tax > 0 then v_lines := v_lines || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('account_id',v_vat,'debit',v_tax,'credit',0,'description','PPN masukan yang diputuskan dapat dikreditkan')); end if;
  v_id := app_private.post_balanced_journal('supplier_invoice',v_invoice.id,v_invoice.invoice_date,'Posting AP faktur '||v_invoice.supplier_invoice_number,pg_catalog.gen_random_uuid(),v_lines);
  update public.supplier_invoices set status='posted', input_tax_treatment=p_input_tax_treatment, input_tax_review_reference=pg_catalog.btrim(p_tax_review_reference), posted_by=auth.uid(), posted_at=pg_catalog.now() where id=v_invoice.id;
  return v_id;
end $$;
revoke all on function public.post_supplier_invoice_to_ap(uuid,text,text) from public, anon, authenticated;
grant execute on function public.post_supplier_invoice_to_ap(uuid,text,text) to authenticated;

create function public.post_customer_payment_journal(p_payment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_payment public.customer_payments%rowtype; v_id uuid; v_cash uuid; v_advance uuid; v_lines jsonb;
begin
  if not app_private.has_business_role(array['owner','admin']) then raise exception using errcode='42501', message='Owner/Admin role required'; end if;
  select * into v_payment from public.customer_payments where id=p_payment_id for key share;
  if not found or v_payment.status <> 'recorded' then raise exception using errcode='22023', message='Only a recorded customer payment can be posted'; end if;
  select id into v_id from public.journal_entries where source_type='customer_payment' and source_id=v_payment.id; if found then return v_id; end if;
  perform app_private.assert_accounting_posting_ready(v_payment.payment_date);
  select account_id into v_cash from public.accounting_account_mappings where mapping_key=case when v_payment.payment_method='cash' then 'cash' when v_payment.payment_method='bank_transfer' then 'bank' else null end;
  if v_cash is null then raise exception using errcode='55000', message='Map cash/bank for this payment method before posting'; end if;
  select account_id into v_advance from public.accounting_account_mappings where mapping_key='customer_advances';
  v_lines:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('account_id',v_cash,'debit',v_payment.amount,'credit',0,'description','Dana diterima pelanggan'),pg_catalog.jsonb_build_object('account_id',v_advance,'debit',0,'credit',v_payment.amount,'description','Uang muka/penerimaan belum dialokasikan'));
  v_id:=app_private.post_balanced_journal('customer_payment',v_payment.id,v_payment.payment_date,'Penerimaan pelanggan '||v_payment.payment_number,pg_catalog.gen_random_uuid(),v_lines);
  return v_id;
end $$;
revoke all on function public.post_customer_payment_journal(uuid) from public, anon, authenticated;
grant execute on function public.post_customer_payment_journal(uuid) to authenticated;

create function public.post_supplier_payment_journal(p_payment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_payment public.supplier_payments%rowtype; v_id uuid; v_cash uuid; v_advance uuid; v_lines jsonb;
begin
  if not app_private.has_business_role(array['owner','admin']) then raise exception using errcode='42501', message='Owner/Admin role required'; end if;
  select * into v_payment from public.supplier_payments where id=p_payment_id for key share;
  if not found or v_payment.status <> 'recorded' then raise exception using errcode='22023', message='Only a recorded supplier payment can be posted'; end if;
  select id into v_id from public.journal_entries where source_type='supplier_payment' and source_id=v_payment.id; if found then return v_id; end if;
  perform app_private.assert_accounting_posting_ready(v_payment.payment_date);
  select account_id into v_cash from public.accounting_account_mappings where mapping_key=case when v_payment.payment_method='cash' then 'cash' when v_payment.payment_method='bank_transfer' then 'bank' else null end;
  if v_cash is null then raise exception using errcode='55000', message='Map cash/bank for this payment method before posting'; end if;
  select account_id into v_advance from public.accounting_account_mappings where mapping_key='supplier_advances';
  v_lines:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('account_id',v_advance,'debit',v_payment.amount,'credit',0,'description','Uang muka supplier/pembayaran belum dialokasikan'),pg_catalog.jsonb_build_object('account_id',v_cash,'debit',0,'credit',v_payment.amount,'description','Dana dibayarkan supplier'));
  v_id:=app_private.post_balanced_journal('supplier_payment',v_payment.id,v_payment.payment_date,'Pembayaran supplier '||v_payment.payment_number,pg_catalog.gen_random_uuid(),v_lines);
  return v_id;
end $$;
revoke all on function public.post_supplier_payment_journal(uuid) from public, anon, authenticated;
grant execute on function public.post_supplier_payment_journal(uuid) to authenticated;

create function public.post_customer_allocation_journal(p_batch_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_batch public.customer_payment_allocation_batches%rowtype; v_payment public.customer_payments%rowtype; v_id uuid; v_ar uuid; v_advance uuid; v_total numeric(20,2); v_date date; v_lines jsonb;
begin
  if not app_private.has_business_role(array['owner','admin']) then raise exception using errcode='42501', message='Owner/Admin role required'; end if;
  select * into v_batch from public.customer_payment_allocation_batches where id=p_batch_id for key share;
  if not found or v_batch.status <> 'active' then raise exception using errcode='22023', message='Only an active customer allocation batch can be posted'; end if;
  select * into v_payment from public.customer_payments where id=v_batch.payment_id and status='recorded' for key share;
  if not found then raise exception using errcode='22023', message='Recorded customer payment not found'; end if;
  select id into v_id from public.journal_entries where source_type='customer_allocation' and source_id=v_batch.id; if found then return v_id; end if;
  if not exists(select 1 from public.journal_entries where source_type='customer_payment' and source_id=v_payment.id) then raise exception using errcode='55000', message='Post the customer payment receipt journal before its allocation'; end if;
  if exists(select 1 from public.customer_payment_allocations a join public.sales_invoices i on i.id=a.sales_invoice_id where a.batch_id=v_batch.id and (i.status<>'issued' or not exists(select 1 from public.journal_entries j where j.source_type='customer_invoice' and j.source_id=i.id))) then raise exception using errcode='55000', message='Every allocated invoice must be issued and have a posted AR journal'; end if;
  select coalesce(sum(a.allocated_amount),0) into v_total from public.customer_payment_allocations a where a.batch_id=v_batch.id;
  if v_total <= 0 then raise exception using errcode='23514', message='Allocation batch has no positive amount'; end if;
  v_date := v_batch.allocation_date; perform app_private.assert_accounting_posting_ready(v_date);
  select account_id into v_ar from public.accounting_account_mappings where mapping_key='accounts_receivable';
  select account_id into v_advance from public.accounting_account_mappings where mapping_key='customer_advances';
  v_lines:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('account_id',v_advance,'debit',v_total,'credit',0,'description','Pemakaian uang muka pelanggan untuk alokasi'),pg_catalog.jsonb_build_object('account_id',v_ar,'debit',0,'credit',v_total,'description','Pengurangan piutang sesuai alokasi'));
  v_id:=app_private.post_balanced_journal('customer_allocation',v_batch.id,v_date,'Alokasi penerimaan '||v_payment.payment_number,pg_catalog.gen_random_uuid(),v_lines);
  return v_id;
end $$;
revoke all on function public.post_customer_allocation_journal(uuid) from public, anon, authenticated;
grant execute on function public.post_customer_allocation_journal(uuid) to authenticated;

create function public.post_supplier_allocation_journal(p_batch_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_batch public.supplier_payment_allocation_batches%rowtype; v_payment public.supplier_payments%rowtype; v_id uuid; v_ap uuid; v_advance uuid; v_total numeric(20,2); v_date date; v_lines jsonb;
begin
  if not app_private.has_business_role(array['owner','admin']) then raise exception using errcode='42501', message='Owner/Admin role required'; end if;
  select * into v_batch from public.supplier_payment_allocation_batches where id=p_batch_id for key share;
  if not found or v_batch.status <> 'active' then raise exception using errcode='22023', message='Only an active supplier allocation batch can be posted'; end if;
  select * into v_payment from public.supplier_payments where id=v_batch.payment_id and status='recorded' for key share;
  if not found then raise exception using errcode='22023', message='Recorded supplier payment not found'; end if;
  select id into v_id from public.journal_entries where source_type='supplier_allocation' and source_id=v_batch.id; if found then return v_id; end if;
  if not exists(select 1 from public.journal_entries where source_type='supplier_payment' and source_id=v_payment.id) then raise exception using errcode='55000', message='Post the supplier payment journal before its allocation'; end if;
  if exists(select 1 from public.supplier_payment_allocations a join public.supplier_invoices i on i.id=a.supplier_invoice_id where a.batch_id=v_batch.id and (i.status<>'posted' or not exists(select 1 from public.journal_entries j where j.source_type='supplier_invoice' and j.source_id=i.id))) then raise exception using errcode='55000', message='Every allocated supplier invoice must have a posted AP journal'; end if;
  select coalesce(sum(a.allocated_amount),0) into v_total from public.supplier_payment_allocations a where a.batch_id=v_batch.id;
  if v_total <= 0 then raise exception using errcode='23514', message='Allocation batch has no positive amount'; end if;
  v_date := v_batch.allocation_date; perform app_private.assert_accounting_posting_ready(v_date);
  select account_id into v_ap from public.accounting_account_mappings where mapping_key='accounts_payable';
  select account_id into v_advance from public.accounting_account_mappings where mapping_key='supplier_advances';
  v_lines:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('account_id',v_ap,'debit',v_total,'credit',0,'description','Pengurangan hutang supplier sesuai alokasi'),pg_catalog.jsonb_build_object('account_id',v_advance,'debit',0,'credit',v_total,'description','Pemakaian uang muka supplier'));
  v_id:=app_private.post_balanced_journal('supplier_allocation',v_batch.id,v_date,'Alokasi pembayaran '||v_payment.payment_number,pg_catalog.gen_random_uuid(),v_lines);
  return v_id;
end $$;
revoke all on function public.post_supplier_allocation_journal(uuid) from public, anon, authenticated;
grant execute on function public.post_supplier_allocation_journal(uuid) to authenticated;

create function app_private.guard_posted_source_void()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_source_type text; v_source_id uuid;
begin
  if old.status is distinct from new.status and new.status = 'void' then
    if tg_table_name = 'customer_payments' then v_source_type := 'customer_payment'; v_source_id := old.id;
    elsif tg_table_name = 'supplier_payments' then v_source_type := 'supplier_payment'; v_source_id := old.id;
    elsif tg_table_name = 'customer_payment_allocation_batches' then v_source_type := 'customer_allocation'; v_source_id := old.id;
    elsif tg_table_name = 'supplier_payment_allocation_batches' then v_source_type := 'supplier_allocation'; v_source_id := old.id;
    end if;
    if exists (select 1 from public.journal_entries j where j.source_type = v_source_type and j.source_id = v_source_id and j.status = 'posted') then
      raise exception using errcode = '55000', message = 'Reverse the posted journal before voiding this payment or allocation';
    end if;
  end if;
  return new;
end $$;
revoke all on function app_private.guard_posted_source_void() from public, anon, authenticated;
create trigger customer_payments_posted_void_guard before update of status on public.customer_payments for each row execute function app_private.guard_posted_source_void();
create trigger supplier_payments_posted_void_guard before update of status on public.supplier_payments for each row execute function app_private.guard_posted_source_void();
create trigger customer_allocation_posted_void_guard before update of status on public.customer_payment_allocation_batches for each row execute function app_private.guard_posted_source_void();
create trigger supplier_allocation_posted_void_guard before update of status on public.supplier_payment_allocation_batches for each row execute function app_private.guard_posted_source_void();

create function public.reverse_accounting_journal(p_journal_entry_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_entry public.journal_entries%rowtype; v_reversal uuid; v_lines jsonb; v_key uuid;
begin
  if not app_private.has_business_role(array['owner','admin']) then raise exception using errcode='42501', message='Owner/Admin role required'; end if;
  if nullif(pg_catalog.btrim(p_reason),'') is null then raise exception using errcode='22023', message='Reversal reason is required'; end if;
  select * into v_entry from public.journal_entries where id=p_journal_entry_id for update;
  if not found then raise exception using errcode='P0002', message='Journal entry not found'; end if;
  if v_entry.status <> 'posted' then raise exception using errcode='22023', message='Only an unreversed journal entry can be reversed'; end if;
  if v_entry.source_type in ('customer_invoice','supplier_invoice') then raise exception using errcode='55000', message='Invoice reversal requires a credit-note/source-document workflow; journal-only reversal is blocked'; end if;
  if v_entry.source_type='reversal' then raise exception using errcode='55000', message='A reversal journal cannot itself be reversed'; end if;
  if v_entry.source_type='customer_payment' and exists(select 1 from public.customer_payment_allocation_batches b where b.payment_id=v_entry.source_id and b.status='active') then raise exception using errcode='55000', message='Void or reverse active allocations before reversing the receipt'; end if;
  if v_entry.source_type='supplier_payment' and exists(select 1 from public.supplier_payment_allocation_batches b where b.payment_id=v_entry.source_id and b.status='active') then raise exception using errcode='55000', message='Void or reverse active allocations before reversing the disbursement'; end if;
  v_lines := (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('account_id',l.account_id,'debit',l.credit,'credit',l.debit,'description','Pembalikan: '||l.description) order by l.line_number) from public.journal_lines l where l.journal_entry_id=v_entry.id);
  v_key := pg_catalog.gen_random_uuid();
  v_reversal := app_private.post_balanced_journal('reversal',v_entry.id,current_date,'Pembalikan '||v_entry.entry_number||': '||pg_catalog.btrim(p_reason),v_key,v_lines);
  update public.journal_entries set reversal_of_id=v_entry.id where id=v_reversal;
  update public.journal_entries set status='reversed', reversal_reason=pg_catalog.btrim(p_reason), reversed_by=auth.uid(), reversed_at=pg_catalog.now() where id=v_entry.id;
  if v_entry.source_type='customer_payment' then update public.customer_payments set status='void', void_reason=pg_catalog.btrim(p_reason), voided_by=auth.uid(), voided_at=pg_catalog.now() where id=v_entry.source_id and status='recorded';
  elsif v_entry.source_type='supplier_payment' then update public.supplier_payments set status='void', void_reason=pg_catalog.btrim(p_reason), voided_by=auth.uid(), voided_at=pg_catalog.now() where id=v_entry.source_id and status='recorded';
  elsif v_entry.source_type='customer_allocation' then update public.customer_payment_allocation_batches set status='void', void_reason=pg_catalog.btrim(p_reason), voided_by=auth.uid(), voided_at=pg_catalog.now() where id=v_entry.source_id and status='active';
  elsif v_entry.source_type='supplier_allocation' then update public.supplier_payment_allocation_batches set status='void', void_reason=pg_catalog.btrim(p_reason), voided_by=auth.uid(), voided_at=pg_catalog.now() where id=v_entry.source_id and status='active';
  end if;
  return v_reversal;
end $$;
revoke all on function public.reverse_accounting_journal(uuid,text) from public, anon, authenticated;
grant execute on function public.reverse_accounting_journal(uuid,text) to authenticated;

comment on table public.chart_of_accounts is 'User-configured COA. No account codes are seeded; chart setup requires accounting review.';
comment on table public.accounting_posting_profile is 'Singleton policy approval gate. Default draft status blocks all journal posting.';
comment on table public.accounting_periods is 'Posting periods; journal entries require exactly one open period for the entry date.';
comment on table public.journal_entries is 'Immutable balanced journal headers created only by guarded SECURITY DEFINER posting functions.';
comment on function public.post_customer_invoice_to_ar(uuid,text,text,text,numeric,numeric,numeric,text) is 'Issues the commercial invoice and posts AR/revenue/output VAT in one transaction; tax is manually supplied from an approved decision and not calculated here.';
comment on function public.post_supplier_invoice_to_ap(uuid,text,text) is 'Posts AP and supplier cost clearing; input VAT creditability must be explicitly reviewed. HPP reclassification is not performed.';