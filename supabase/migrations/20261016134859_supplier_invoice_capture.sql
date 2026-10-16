-- Capture-only supplier invoices. No AP, payment, VAT calculation, inventory or journal posting.
create table public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_invoice_number text not null check (length(pg_catalog.btrim(supplier_invoice_number)) > 0),
  invoice_date date not null,
  due_date date,
  tax_status text not null check (tax_status in ('taxed', 'non_taxed', 'unverified')),
  price_mode text not null check (price_mode in ('exclusive', 'inclusive', 'not_applicable', 'unknown')),
  tax_rate_reported numeric(7,4) check (tax_rate_reported is null or tax_rate_reported between 0 and 100),
  discount_mode text not null default 'none' check (discount_mode in ('none', 'amount', 'percent')),
  discount_value_reported numeric(20,2) not null default 0 check (discount_value_reported >= 0),
  subtotal_reported numeric(20,2) not null check (subtotal_reported >= 0),
  discount_amount_reported numeric(20,2) not null default 0 check (discount_amount_reported >= 0),
  tax_amount_reported numeric(20,2) not null default 0 check (tax_amount_reported >= 0),
  other_charges_reported numeric(20,2) not null default 0 check (other_charges_reported >= 0),
  invoice_total_reported numeric(20,2) not null check (invoice_total_reported >= 0),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'void')),
  void_reason text,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint supplier_invoices_due_after_date check (due_date is null or due_date >= invoice_date),
  constraint supplier_invoices_discount_percent_valid check (discount_mode <> 'percent' or discount_value_reported <= 100),
  constraint supplier_invoices_no_discount_zero check (discount_mode <> 'none' or discount_value_reported = 0),
  constraint supplier_invoices_tax_mode_consistent check (
    (tax_status = 'taxed' and price_mode in ('exclusive', 'inclusive')) or
    (tax_status = 'non_taxed' and price_mode = 'not_applicable' and tax_amount_reported = 0) or
    tax_status = 'unverified'
  ),
  constraint supplier_invoices_void_state_consistent check (
    (status = 'draft' and void_reason is null and voided_by is null and voided_at is null) or
    (status = 'void' and nullif(pg_catalog.btrim(void_reason), '') is not null and voided_by is not null and voided_at is not null)
  )
);

create unique index supplier_invoices_supplier_number_active_uq
  on public.supplier_invoices (supplier_id, pg_catalog.lower(pg_catalog.btrim(supplier_invoice_number)))
  where status <> 'void';
create index supplier_invoices_supplier_idx on public.supplier_invoices (supplier_id);
create index supplier_invoices_invoice_date_idx on public.supplier_invoices (invoice_date desc);
create index supplier_invoices_created_by_idx on public.supplier_invoices (created_by);
create index supplier_invoices_voided_by_idx on public.supplier_invoices (voided_by);

create table public.supplier_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(20,4) not null check (quantity > 0),
  unit_price_reported numeric(20,2) not null check (unit_price_reported >= 0),
  line_discount_reported numeric(20,2) not null default 0 check (line_discount_reported >= 0),
  line_total_reported numeric(20,2) not null check (line_total_reported >= 0),
  created_at timestamptz not null default now(),
  constraint supplier_invoice_lines_number_unique unique (supplier_invoice_id, line_number),
  constraint supplier_invoice_lines_po_line_once unique (supplier_invoice_id, purchase_order_line_id)
);
create index supplier_invoice_lines_po_line_idx on public.supplier_invoice_lines (purchase_order_line_id);

alter table public.supplier_invoices enable row level security;
alter table public.supplier_invoice_lines enable row level security;
revoke all on public.supplier_invoices, public.supplier_invoice_lines from public, anon, authenticated;
grant select on public.supplier_invoices, public.supplier_invoice_lines to authenticated;

create policy supplier_invoices_read_role on public.supplier_invoices for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));
create policy supplier_invoice_lines_read_role on public.supplier_invoice_lines for select to authenticated
  using ((select app_private.has_business_role(array['owner', 'admin', 'viewer'])));

create function public.create_supplier_invoice(
  p_supplier_id uuid,
  p_supplier_invoice_number text,
  p_invoice_date date,
  p_due_date date,
  p_tax_status text,
  p_price_mode text,
  p_tax_rate_reported numeric,
  p_discount_mode text,
  p_discount_value_reported numeric,
  p_subtotal_reported numeric,
  p_discount_amount_reported numeric,
  p_tax_amount_reported numeric,
  p_other_charges_reported numeric,
  p_invoice_total_reported numeric,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier public.suppliers%rowtype;
  v_po_supplier_id uuid;
  v_po_product_code text;
  v_po_product_name text;
  v_po_unit text;
  v_invoice_id uuid;
  v_line jsonb;
  v_po_line_id uuid;
  v_quantity numeric(20,4);
  v_unit_price numeric(20,2);
  v_line_discount numeric(20,2);
  v_line_total numeric(20,2);
  v_line_number integer := 0;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_supplier_id is null or p_invoice_date is null or p_supplier_invoice_number is null or pg_catalog.length(pg_catalog.btrim(p_supplier_invoice_number)) = 0 then
    raise exception using errcode = '22023', message = 'Supplier, supplier invoice number and invoice date are required';
  end if;
  if p_due_date is not null and p_due_date < p_invoice_date then
    raise exception using errcode = '22023', message = 'Due date cannot be before invoice date';
  end if;
  if p_tax_status not in ('taxed', 'non_taxed', 'unverified') or p_price_mode not in ('exclusive', 'inclusive', 'not_applicable', 'unknown') then
    raise exception using errcode = '22023', message = 'Tax status or price mode is invalid';
  end if;
  if p_tax_status = 'taxed' and p_price_mode not in ('exclusive', 'inclusive') then
    raise exception using errcode = '22023', message = 'Taxed invoices must specify inclusive or exclusive mode';
  end if;
  if p_tax_status = 'non_taxed' and (p_price_mode <> 'not_applicable' or coalesce(p_tax_amount_reported, 0) <> 0) then
    raise exception using errcode = '22023', message = 'Non-taxed invoices must use not-applicable price mode and report zero tax';
  end if;
  if p_discount_mode not in ('none', 'amount', 'percent') then
    raise exception using errcode = '22023', message = 'Discount mode is invalid';
  end if;
  if p_tax_rate_reported is not null and (p_tax_rate_reported < 0 or p_tax_rate_reported > 100) then
    raise exception using errcode = '22023', message = 'Reported tax rate must be between 0 and 100';
  end if;
  if p_discount_value_reported is null or p_discount_value_reported < 0 or (p_discount_mode = 'percent' and p_discount_value_reported > 100) then
    raise exception using errcode = '22023', message = 'Reported discount is invalid';
  end if;
  if p_subtotal_reported is null or p_subtotal_reported < 0 or p_discount_amount_reported is null or p_discount_amount_reported < 0 or p_tax_amount_reported is null or p_tax_amount_reported < 0 or p_other_charges_reported is null or p_other_charges_reported < 0 or p_invoice_total_reported is null or p_invoice_total_reported < 0 then
    raise exception using errcode = '22023', message = 'Reported invoice amounts must be zero or greater';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array' or pg_catalog.jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'At least one PO-matched invoice line is required';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_lines) as item(value)
    group by item.value->>'purchase_order_line_id' having pg_catalog.count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A PO line may appear only once per supplier invoice';
  end if;

  select * into v_supplier from public.suppliers s where s.id = p_supplier_id and s.is_active for key share;
  if not found then raise exception using errcode = '23503', message = 'Active supplier not found'; end if;

  insert into public.supplier_invoices (
    supplier_id, supplier_invoice_number, invoice_date, due_date, tax_status, price_mode,
    tax_rate_reported, discount_mode, discount_value_reported, subtotal_reported,
    discount_amount_reported, tax_amount_reported, other_charges_reported,
    invoice_total_reported, notes, created_by
  ) values (
    p_supplier_id, pg_catalog.btrim(p_supplier_invoice_number), p_invoice_date, p_due_date,
    p_tax_status, p_price_mode, p_tax_rate_reported, p_discount_mode, p_discount_value_reported,
    p_subtotal_reported, p_discount_amount_reported, p_tax_amount_reported, p_other_charges_reported,
    p_invoice_total_reported, nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
  ) returning id into v_invoice_id;

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as lines(value) loop
    v_line_number := v_line_number + 1;
    if pg_catalog.jsonb_typeof(v_line) <> 'object' or v_line->>'purchase_order_line_id' is null or v_line->>'quantity' is null or v_line->>'unit_price_reported' is null or v_line->>'line_total_reported' is null then
      raise exception using errcode = '22023', message = 'Each invoice line requires PO line, quantity, reported unit price and reported line total';
    end if;
    v_po_line_id := (v_line->>'purchase_order_line_id')::uuid;
    select pol.product_code_snapshot, pol.product_name_snapshot, pol.unit_snapshot, po.supplier_id
    into v_po_product_code, v_po_product_name, v_po_unit, v_po_supplier_id
    from public.purchase_order_lines pol
    join public.purchase_orders po on po.id = pol.purchase_order_id
    where pol.id = v_po_line_id and po.status <> 'cancelled'
    for key share of pol, po;
    if not found or v_po_supplier_id <> p_supplier_id then
      raise exception using errcode = '23503', message = 'Every invoice line must match a non-cancelled PO line for the selected supplier';
    end if;
    v_quantity := (v_line->>'quantity')::numeric;
    v_unit_price := (v_line->>'unit_price_reported')::numeric;
    v_line_discount := coalesce((v_line->>'line_discount_reported')::numeric, 0);
    v_line_total := (v_line->>'line_total_reported')::numeric;
    if v_quantity <= 0 or v_unit_price < 0 or v_line_discount < 0 or v_line_total < 0 then
      raise exception using errcode = '22023', message = 'Reported invoice line values are invalid';
    end if;
    insert into public.supplier_invoice_lines (
      supplier_invoice_id, line_number, purchase_order_line_id, product_code_snapshot,
      product_name_snapshot, unit_snapshot, quantity, unit_price_reported,
      line_discount_reported, line_total_reported
    ) values (
      v_invoice_id, v_line_number, v_po_line_id, v_po_product_code,
      v_po_product_name, v_po_unit, v_quantity,
      v_unit_price, v_line_discount, v_line_total
    );
  end loop;
  return v_invoice_id;
end;
$$;
revoke all on function public.create_supplier_invoice(uuid, text, date, date, text, text, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_supplier_invoice(uuid, text, date, date, text, text, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb) to authenticated;

create function public.void_supplier_invoice(p_supplier_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 then
    raise exception using errcode = '22023', message = 'Void reason must contain at least 3 characters';
  end if;
  select si.status into v_status from public.supplier_invoices si where si.id = p_supplier_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Supplier invoice not found'; end if;
  if v_status <> 'draft' then raise exception using errcode = '22023', message = 'Only draft supplier invoices can be voided'; end if;
  update public.supplier_invoices
  set status = 'void', void_reason = pg_catalog.btrim(p_reason), voided_by = auth.uid(), voided_at = pg_catalog.now()
  where id = p_supplier_invoice_id;
end;
$$;
revoke all on function public.void_supplier_invoice(uuid, text) from public, anon, authenticated;
grant execute on function public.void_supplier_invoice(uuid, text) to authenticated;
