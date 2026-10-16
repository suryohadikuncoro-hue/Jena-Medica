-- Operational payment capture and allocation infrastructure.
-- Captures verified cash movements as receipts/disbursements and retains unapplied balances as advances.
-- Allocations are permitted only against issued customer invoices / posted supplier invoices.
-- No AR/AP recognition, tax calculation, bank reconciliation, or journal posting is performed here.

create sequence public.customer_payment_number_seq;
create sequence public.supplier_payment_number_seq;

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique check (payment_number like 'CR-%' and length(btrim(payment_number)) > 0),
  idempotency_key uuid not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  payment_date date not null,
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  amount numeric(20,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('bank_transfer', 'cash', 'check', 'card', 'other')),
  external_reference text,
  notes text,
  status text not null default 'recorded' check (status in ('recorded', 'void')),
  void_reason text,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint customer_payments_void_state_consistent check (
    (status = 'recorded' and void_reason is null and voided_by is null and voided_at is null) or
    (status = 'void' and nullif(btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  )
);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique check (payment_number like 'SP-%' and length(btrim(payment_number)) > 0),
  idempotency_key uuid not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  payment_date date not null,
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  amount numeric(20,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('bank_transfer', 'cash', 'check', 'card', 'other')),
  external_reference text,
  notes text,
  status text not null default 'recorded' check (status in ('recorded', 'void')),
  void_reason text,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint supplier_payments_void_state_consistent check (
    (status = 'recorded' and void_reason is null and voided_by is null and voided_at is null) or
    (status = 'void' and nullif(btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  )
);

create unique index customer_payments_reference_active_uq
  on public.customer_payments (customer_id, payment_date, pg_catalog.lower(pg_catalog.btrim(external_reference)))
  where status = 'recorded' and nullif(pg_catalog.btrim(external_reference), '') is not null;
create unique index supplier_payments_reference_active_uq
  on public.supplier_payments (supplier_id, payment_date, pg_catalog.lower(pg_catalog.btrim(external_reference)))
  where status = 'recorded' and nullif(pg_catalog.btrim(external_reference), '') is not null;
create index customer_payments_party_date_idx on public.customer_payments (customer_id, payment_date desc, created_at desc);
create index customer_payments_status_date_idx on public.customer_payments (status, payment_date desc);
create index supplier_payments_party_date_idx on public.supplier_payments (supplier_id, payment_date desc, created_at desc);
create index supplier_payments_status_date_idx on public.supplier_payments (status, payment_date desc);

create table public.customer_payment_allocation_batches (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.customer_payments(id) on delete restrict,
  idempotency_key uuid not null,
  request_payload jsonb not null check (pg_catalog.jsonb_typeof(request_payload) = 'array'),
  status text not null default 'active' check (status in ('active', 'void')),
  void_reason text,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (payment_id, idempotency_key),
  constraint customer_payment_allocation_batches_void_state_consistent check (
    (status = 'active' and void_reason is null and voided_by is null and voided_at is null) or
    (status = 'void' and nullif(pg_catalog.btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  )
);

create table public.customer_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.customer_payment_allocation_batches(id) on delete restrict,
  sales_invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  allocated_amount numeric(20,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),
  unique (batch_id, sales_invoice_id)
);

create table public.supplier_payment_allocation_batches (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.supplier_payments(id) on delete restrict,
  idempotency_key uuid not null,
  request_payload jsonb not null check (pg_catalog.jsonb_typeof(request_payload) = 'array'),
  status text not null default 'active' check (status in ('active', 'void')),
  void_reason text,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (payment_id, idempotency_key),
  constraint supplier_payment_allocation_batches_void_state_consistent check (
    (status = 'active' and void_reason is null and voided_by is null and voided_at is null) or
    (status = 'void' and nullif(pg_catalog.btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  )
);

create table public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.supplier_payment_allocation_batches(id) on delete restrict,
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete restrict,
  allocated_amount numeric(20,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),
  unique (batch_id, supplier_invoice_id)
);

create index customer_payment_allocation_batches_payment_idx on public.customer_payment_allocation_batches (payment_id, created_at desc);
create index customer_payment_allocations_invoice_idx on public.customer_payment_allocations (sales_invoice_id, batch_id);
create index customer_payment_allocations_batch_idx on public.customer_payment_allocations (batch_id);
create index supplier_payment_allocation_batches_payment_idx on public.supplier_payment_allocation_batches (payment_id, created_at desc);
create index supplier_payment_allocations_invoice_idx on public.supplier_payment_allocations (supplier_invoice_id, batch_id);
create index supplier_payment_allocations_batch_idx on public.supplier_payment_allocations (batch_id);

alter table public.customer_payments enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.customer_payment_allocation_batches enable row level security;
alter table public.customer_payment_allocations enable row level security;
alter table public.supplier_payment_allocation_batches enable row level security;
alter table public.supplier_payment_allocations enable row level security;
revoke all on public.customer_payments, public.supplier_payments,
  public.customer_payment_allocation_batches, public.customer_payment_allocations,
  public.supplier_payment_allocation_batches, public.supplier_payment_allocations from public, anon, authenticated;
grant select on public.customer_payments, public.supplier_payments,
  public.customer_payment_allocation_batches, public.customer_payment_allocations,
  public.supplier_payment_allocation_batches, public.supplier_payment_allocations to authenticated;

create policy customer_payments_read_role on public.customer_payments for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy supplier_payments_read_role on public.supplier_payments for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy customer_payment_allocation_batches_read_role on public.customer_payment_allocation_batches for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy customer_payment_allocations_read_role on public.customer_payment_allocations for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy supplier_payment_allocation_batches_read_role on public.supplier_payment_allocation_batches for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy supplier_payment_allocations_read_role on public.supplier_payment_allocations for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));

create function public.record_customer_payment(
  p_idempotency_key uuid, p_customer_id uuid, p_payment_date date, p_amount numeric, p_payment_method text,
  p_external_reference text, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_payment_number text;
  v_sequence bigint;
  v_existing public.customer_payments%rowtype;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Idempotency key is required'; end if;
  if p_customer_id is null or p_payment_date is null then
    raise exception using errcode = '22023', message = 'Customer and payment date are required';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN', 'Infinity', '-Infinity') or p_amount <> pg_catalog.round(p_amount, 2) then
    raise exception using errcode = '22023', message = 'Payment amount must be a finite positive number';
  end if;
  if p_payment_method is null or p_payment_method not in ('bank_transfer', 'cash', 'check', 'card', 'other') then
    raise exception using errcode = '22023', message = 'Payment method is invalid';
  end if;
  if p_external_reference is not null and pg_catalog.length(pg_catalog.btrim(p_external_reference)) > 200 then
    raise exception using errcode = '22023', message = 'Payment reference must be at most 200 characters';
  end if;
  select * into v_existing from public.customer_payments p where p.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.customer_id is distinct from p_customer_id or v_existing.payment_date is distinct from p_payment_date or
      v_existing.amount is distinct from p_amount or v_existing.payment_method is distinct from p_payment_method or
      v_existing.external_reference is distinct from nullif(pg_catalog.btrim(p_external_reference), '') or
      v_existing.notes is distinct from nullif(pg_catalog.btrim(p_notes), '') then
      raise exception using errcode = '23505', message = 'Idempotency key was already used with a different payment payload';
    end if;
    return v_existing.id;
  end if;
  perform 1 from public.customers c where c.id = p_customer_id for key share;
  if not found then raise exception using errcode = '23503', message = 'Customer was not found'; end if;

  v_sequence := pg_catalog.nextval('public.customer_payment_number_seq'::regclass);
  v_payment_number := 'CR-' || pg_catalog.to_char(p_payment_date, 'YYYYMM') || '-' ||
    pg_catalog.lpad(v_sequence::text, greatest(6, pg_catalog.length(v_sequence::text)), '0');
  insert into public.customer_payments (
    payment_number, idempotency_key, customer_id, payment_date, amount, payment_method, external_reference, notes, created_by
  ) values (
    v_payment_number, p_idempotency_key, p_customer_id, p_payment_date, p_amount, p_payment_method,
    nullif(pg_catalog.btrim(p_external_reference), ''), nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  ) returning id into v_payment_id;
  return v_payment_id;
end;
$$;
revoke all on function public.record_customer_payment(uuid, uuid, date, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.record_customer_payment(uuid, uuid, date, numeric, text, text, text) to authenticated;

create function public.record_supplier_payment(
  p_idempotency_key uuid, p_supplier_id uuid, p_payment_date date, p_amount numeric, p_payment_method text,
  p_external_reference text, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_payment_number text;
  v_sequence bigint;
  v_existing public.supplier_payments%rowtype;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Idempotency key is required'; end if;
  if p_supplier_id is null or p_payment_date is null then
    raise exception using errcode = '22023', message = 'Supplier and payment date are required';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN', 'Infinity', '-Infinity') or p_amount <> pg_catalog.round(p_amount, 2) then
    raise exception using errcode = '22023', message = 'Payment amount must be a finite positive number';
  end if;
  if p_payment_method is null or p_payment_method not in ('bank_transfer', 'cash', 'check', 'card', 'other') then
    raise exception using errcode = '22023', message = 'Payment method is invalid';
  end if;
  if p_external_reference is not null and pg_catalog.length(pg_catalog.btrim(p_external_reference)) > 200 then
    raise exception using errcode = '22023', message = 'Payment reference must be at most 200 characters';
  end if;
  select * into v_existing from public.supplier_payments p where p.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.supplier_id is distinct from p_supplier_id or v_existing.payment_date is distinct from p_payment_date or
      v_existing.amount is distinct from p_amount or v_existing.payment_method is distinct from p_payment_method or
      v_existing.external_reference is distinct from nullif(pg_catalog.btrim(p_external_reference), '') or
      v_existing.notes is distinct from nullif(pg_catalog.btrim(p_notes), '') then
      raise exception using errcode = '23505', message = 'Idempotency key was already used with a different payment payload';
    end if;
    return v_existing.id;
  end if;
  perform 1 from public.suppliers s where s.id = p_supplier_id for key share;
  if not found then raise exception using errcode = '23503', message = 'Supplier was not found'; end if;

  v_sequence := pg_catalog.nextval('public.supplier_payment_number_seq'::regclass);
  v_payment_number := 'SP-' || pg_catalog.to_char(p_payment_date, 'YYYYMM') || '-' ||
    pg_catalog.lpad(v_sequence::text, greatest(6, pg_catalog.length(v_sequence::text)), '0');
  insert into public.supplier_payments (
    payment_number, idempotency_key, supplier_id, payment_date, amount, payment_method, external_reference, notes, created_by
  ) values (
    v_payment_number, p_idempotency_key, p_supplier_id, p_payment_date, p_amount, p_payment_method,
    nullif(pg_catalog.btrim(p_external_reference), ''), nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  ) returning id into v_payment_id;
  return v_payment_id;
end;
$$;
revoke all on function public.record_supplier_payment(uuid, uuid, date, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.record_supplier_payment(uuid, uuid, date, numeric, text, text, text) to authenticated;

create function public.allocate_customer_payment(p_payment_id uuid, p_idempotency_key uuid, p_allocations jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.customer_payments%rowtype;
  v_invoice public.sales_invoices%rowtype;
  v_batch_id uuid;
  v_existing_payload jsonb;
  v_item record;
  v_invoice_id uuid;
  v_amount numeric;
  v_invoice_allocated numeric(20,2);
  v_payment_allocated numeric(20,2);
  v_batch_total numeric := 0;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_payment_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Payment and idempotency key are required';
  end if;
  if p_allocations is null or pg_catalog.jsonb_typeof(p_allocations) <> 'array' then
    raise exception using errcode = '22023', message = 'Allocations must be a JSON array';
  end if;
  if pg_catalog.jsonb_array_length(p_allocations) = 0 then
    raise exception using errcode = '22023', message = 'At least one invoice allocation is required';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_allocations) x(value) where pg_catalog.jsonb_typeof(x.value) <> 'object' or x.value->>'invoice_id' is null or x.value->>'amount' is null) then
    raise exception using errcode = '22023', message = 'Each allocation requires invoice_id and amount';
  end if;
  if exists (select x.value->>'invoice_id' from pg_catalog.jsonb_array_elements(p_allocations) x(value) group by x.value->>'invoice_id' having pg_catalog.count(*) > 1) then
    raise exception using errcode = '22023', message = 'An invoice may appear only once per allocation batch';
  end if;

  select * into v_payment from public.customer_payments p where p.id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Customer payment was not found'; end if;
  if v_payment.status <> 'recorded' then raise exception using errcode = '22023', message = 'Only recorded customer payments may be allocated'; end if;

  select b.id, b.request_payload into v_batch_id, v_existing_payload
  from public.customer_payment_allocation_batches b
  where b.payment_id = p_payment_id and b.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_payload <> p_allocations then
      raise exception using errcode = '23505', message = 'Idempotency key was already used with a different allocation payload';
    end if;
    return v_batch_id;
  end if;

  select coalesce(sum(a.allocated_amount), 0) into v_payment_allocated
  from public.customer_payment_allocations a
  join public.customer_payment_allocation_batches b on b.id = a.batch_id and b.status = 'active'
  where b.payment_id = p_payment_id;
  for v_item in select x.value from pg_catalog.jsonb_array_elements(p_allocations) x(value) order by x.value->>'invoice_id' loop
    v_invoice_id := (v_item.value->>'invoice_id')::uuid;
    v_amount := (v_item.value->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') or v_amount <> pg_catalog.round(v_amount, 2) then
      raise exception using errcode = '22023', message = 'Allocation amount must be a finite positive number';
    end if;
    v_batch_total := v_batch_total + v_amount;
    select * into v_invoice from public.sales_invoices i where i.id = v_invoice_id for update;
    if not found or v_invoice.status <> 'issued' then
      raise exception using errcode = '22023', message = 'Allocations are allowed only to issued customer invoices';
    end if;
    if v_invoice.customer_id <> v_payment.customer_id or v_invoice.currency_code <> v_payment.currency_code then
      raise exception using errcode = '23514', message = 'Invoice customer or currency does not match the payment';
    end if;
    select coalesce(sum(a.allocated_amount), 0) into v_invoice_allocated
    from public.customer_payment_allocations a
    join public.customer_payment_allocation_batches b on b.id = a.batch_id and b.status = 'active'
    join public.customer_payments p on p.id = b.payment_id and p.status = 'recorded'
    where a.sales_invoice_id = v_invoice_id;
    if v_invoice_allocated + v_amount > v_invoice.total_amount then
      raise exception using errcode = '23514', message = 'Allocation would exceed the issued invoice outstanding balance';
    end if;
  end loop;
  if v_payment_allocated + v_batch_total > v_payment.amount then
    raise exception using errcode = '23514', message = 'Total allocations would exceed the available payment balance';
  end if;

  insert into public.customer_payment_allocation_batches (payment_id, idempotency_key, request_payload, created_by)
  values (p_payment_id, p_idempotency_key, p_allocations, auth.uid()) returning id into v_batch_id;
  for v_item in select x.value from pg_catalog.jsonb_array_elements(p_allocations) x(value) order by x.value->>'invoice_id' loop
    insert into public.customer_payment_allocations (batch_id, sales_invoice_id, allocated_amount)
    values (v_batch_id, (v_item.value->>'invoice_id')::uuid, (v_item.value->>'amount')::numeric);
  end loop;
  return v_batch_id;
end;
$$;
revoke all on function public.allocate_customer_payment(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.allocate_customer_payment(uuid, uuid, jsonb) to authenticated;

create function public.allocate_supplier_payment(p_payment_id uuid, p_idempotency_key uuid, p_allocations jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.supplier_payments%rowtype;
  v_invoice public.supplier_invoices%rowtype;
  v_batch_id uuid;
  v_existing_payload jsonb;
  v_item record;
  v_invoice_id uuid;
  v_amount numeric;
  v_invoice_allocated numeric(20,2);
  v_payment_allocated numeric(20,2);
  v_batch_total numeric := 0;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_payment_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Payment and idempotency key are required';
  end if;
  if p_allocations is null or pg_catalog.jsonb_typeof(p_allocations) <> 'array' then
    raise exception using errcode = '22023', message = 'Allocations must be a JSON array';
  end if;
  if pg_catalog.jsonb_array_length(p_allocations) = 0 then
    raise exception using errcode = '22023', message = 'At least one invoice allocation is required';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_allocations) x(value) where pg_catalog.jsonb_typeof(x.value) <> 'object' or x.value->>'invoice_id' is null or x.value->>'amount' is null) then
    raise exception using errcode = '22023', message = 'Each allocation requires invoice_id and amount';
  end if;
  if exists (select x.value->>'invoice_id' from pg_catalog.jsonb_array_elements(p_allocations) x(value) group by x.value->>'invoice_id' having pg_catalog.count(*) > 1) then
    raise exception using errcode = '22023', message = 'An invoice may appear only once per allocation batch';
  end if;

  select * into v_payment from public.supplier_payments p where p.id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Supplier payment was not found'; end if;
  if v_payment.status <> 'recorded' then raise exception using errcode = '22023', message = 'Only recorded supplier payments may be allocated'; end if;

  select b.id, b.request_payload into v_batch_id, v_existing_payload
  from public.supplier_payment_allocation_batches b
  where b.payment_id = p_payment_id and b.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_payload <> p_allocations then
      raise exception using errcode = '23505', message = 'Idempotency key was already used with a different allocation payload';
    end if;
    return v_batch_id;
  end if;

  select coalesce(sum(a.allocated_amount), 0) into v_payment_allocated
  from public.supplier_payment_allocations a
  join public.supplier_payment_allocation_batches b on b.id = a.batch_id and b.status = 'active'
  where b.payment_id = p_payment_id;
  for v_item in select x.value from pg_catalog.jsonb_array_elements(p_allocations) x(value) order by x.value->>'invoice_id' loop
    v_invoice_id := (v_item.value->>'invoice_id')::uuid;
    v_amount := (v_item.value->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') or v_amount <> pg_catalog.round(v_amount, 2) then
      raise exception using errcode = '22023', message = 'Allocation amount must be a finite positive number';
    end if;
    v_batch_total := v_batch_total + v_amount;
    select * into v_invoice from public.supplier_invoices i where i.id = v_invoice_id for update;
    if not found or v_invoice.status <> 'posted' then
      raise exception using errcode = '22023', message = 'Allocations are allowed only to posted supplier invoices';
    end if;
    if v_invoice.supplier_id <> v_payment.supplier_id then
      raise exception using errcode = '23514', message = 'Invoice supplier does not match the payment';
    end if;
    select coalesce(sum(a.allocated_amount), 0) into v_invoice_allocated
    from public.supplier_payment_allocations a
    join public.supplier_payment_allocation_batches b on b.id = a.batch_id and b.status = 'active'
    join public.supplier_payments p on p.id = b.payment_id and p.status = 'recorded'
    where a.supplier_invoice_id = v_invoice_id;
    if v_invoice_allocated + v_amount > v_invoice.invoice_total_reported then
      raise exception using errcode = '23514', message = 'Allocation would exceed the posted supplier invoice outstanding balance';
    end if;
  end loop;
  if v_payment_allocated + v_batch_total > v_payment.amount then
    raise exception using errcode = '23514', message = 'Total allocations would exceed the available payment balance';
  end if;

  insert into public.supplier_payment_allocation_batches (payment_id, idempotency_key, request_payload, created_by)
  values (p_payment_id, p_idempotency_key, p_allocations, auth.uid()) returning id into v_batch_id;
  for v_item in select x.value from pg_catalog.jsonb_array_elements(p_allocations) x(value) order by x.value->>'invoice_id' loop
    insert into public.supplier_payment_allocations (batch_id, supplier_invoice_id, allocated_amount)
    values (v_batch_id, (v_item.value->>'invoice_id')::uuid, (v_item.value->>'amount')::numeric);
  end loop;
  return v_batch_id;
end;
$$;
revoke all on function public.allocate_supplier_payment(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.allocate_supplier_payment(uuid, uuid, jsonb) to authenticated;

create function public.void_customer_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 then raise exception using errcode = '22023', message = 'Void reason must contain at least 3 characters'; end if;
  select p.status into v_status from public.customer_payments p where p.id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Customer payment was not found'; end if;
  if v_status <> 'recorded' then raise exception using errcode = '22023', message = 'Only recorded customer payments can be voided'; end if;
  update public.customer_payments set status = 'void', void_reason = pg_catalog.btrim(p_reason), voided_by = auth.uid(), voided_at = pg_catalog.now() where id = p_payment_id;
  update public.customer_payment_allocation_batches
  set status = 'void', void_reason = 'Parent payment void: ' || pg_catalog.btrim(p_reason), voided_by = auth.uid(), voided_at = pg_catalog.now()
  where payment_id = p_payment_id and status = 'active';
end;
$$;
revoke all on function public.void_customer_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.void_customer_payment(uuid, text) to authenticated;

create function public.void_supplier_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 then raise exception using errcode = '22023', message = 'Void reason must contain at least 3 characters'; end if;
  select p.status into v_status from public.supplier_payments p where p.id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Supplier payment was not found'; end if;
  if v_status <> 'recorded' then raise exception using errcode = '22023', message = 'Only recorded supplier payments can be voided'; end if;
  update public.supplier_payments set status = 'void', void_reason = pg_catalog.btrim(p_reason), voided_by = auth.uid(), voided_at = pg_catalog.now() where id = p_payment_id;
  update public.supplier_payment_allocation_batches
  set status = 'void', void_reason = 'Parent payment void: ' || pg_catalog.btrim(p_reason), voided_by = auth.uid(), voided_at = pg_catalog.now()
  where payment_id = p_payment_id and status = 'active';
end;
$$;
revoke all on function public.void_supplier_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.void_supplier_payment(uuid, text) to authenticated;

create function public.void_customer_payment_allocation_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_invoice_id uuid;
  v_status text;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 then raise exception using errcode = '22023', message = 'Void reason must contain at least 3 characters'; end if;
  select b.payment_id into v_payment_id from public.customer_payment_allocation_batches b where b.id = p_batch_id;
  if not found then raise exception using errcode = 'P0002', message = 'Customer allocation batch was not found'; end if;
  perform 1 from public.customer_payments p where p.id = v_payment_id for update;
  select b.status into v_status from public.customer_payment_allocation_batches b where b.id = p_batch_id for update;
  if v_status <> 'active' then raise exception using errcode = '22023', message = 'Only active allocation batches can be voided'; end if;
  for v_invoice_id in select a.sales_invoice_id from public.customer_payment_allocations a where a.batch_id = p_batch_id order by a.sales_invoice_id loop
    perform 1 from public.sales_invoices i where i.id = v_invoice_id for update;
  end loop;
  update public.customer_payment_allocation_batches set status = 'void', void_reason = pg_catalog.btrim(p_reason), voided_by = auth.uid(), voided_at = pg_catalog.now() where id = p_batch_id;
end;
$$;
revoke all on function public.void_customer_payment_allocation_batch(uuid, text) from public, anon, authenticated;
grant execute on function public.void_customer_payment_allocation_batch(uuid, text) to authenticated;

create function public.void_supplier_payment_allocation_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_invoice_id uuid;
  v_status text;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then raise exception using errcode = '42501', message = 'Owner/Admin role required'; end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 then raise exception using errcode = '22023', message = 'Void reason must contain at least 3 characters'; end if;
  select b.payment_id into v_payment_id from public.supplier_payment_allocation_batches b where b.id = p_batch_id;
  if not found then raise exception using errcode = 'P0002', message = 'Supplier allocation batch was not found'; end if;
  perform 1 from public.supplier_payments p where p.id = v_payment_id for update;
  select b.status into v_status from public.supplier_payment_allocation_batches b where b.id = p_batch_id for update;
  if v_status <> 'active' then raise exception using errcode = '22023', message = 'Only active allocation batches can be voided'; end if;
  for v_invoice_id in select a.supplier_invoice_id from public.supplier_payment_allocations a where a.batch_id = p_batch_id order by a.supplier_invoice_id loop
    perform 1 from public.supplier_invoices i where i.id = v_invoice_id for update;
  end loop;
  update public.supplier_payment_allocation_batches set status = 'void', void_reason = pg_catalog.btrim(p_reason), voided_by = auth.uid(), voided_at = pg_catalog.now() where id = p_batch_id;
end;
$$;
revoke all on function public.void_supplier_payment_allocation_batch(uuid, text) from public, anon, authenticated;
grant execute on function public.void_supplier_payment_allocation_batch(uuid, text) to authenticated;

comment on table public.customer_payments is 'Verified customer cash receipts; unallocated balances are customer advances. This table is not an AR or cash ledger.';
comment on table public.supplier_payments is 'Verified supplier cash disbursements; unallocated balances are supplier advances. This table is not an AP or bank ledger.';
comment on table public.customer_payment_allocations is 'Immutable allocation rows, created only by an RPC when the referenced customer invoice is issued.';
comment on table public.supplier_payment_allocations is 'Immutable allocation rows, created only by an RPC when the referenced supplier invoice is posted.';
