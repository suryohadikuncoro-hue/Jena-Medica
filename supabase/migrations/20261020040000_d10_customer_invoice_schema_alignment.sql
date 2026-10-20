-- D-10: align the invoice schema with the application contract.
-- Additive only: preserves existing invoices and all payment records.
-- This migration does not enable invoice issuance or accounting posting by itself.

begin;

alter table public.sales_invoices
  add column if not exists tax_amount numeric(20,2) not null default 0
    check (tax_amount >= 0),
  add column if not exists tax_status text not null default 'not_applicable',
  add column if not exists issued_invoice_number text,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references auth.users(id) on delete restrict;

alter table public.sales_invoices
  drop constraint if exists sales_invoices_status_check,
  drop constraint if exists sales_invoices_void_state_consistent;

alter table public.sales_invoices
  add constraint sales_invoices_status_check
    check (status in ('draft', 'issued', 'void')),
  add constraint sales_invoices_tax_status_check
    check (tax_status in ('not_applicable', 'pending_review', 'taxable', 'exempt')),
  add constraint sales_invoices_issue_state_consistent
    check (
      (status = 'draft' and issued_at is null and issued_by is null and issued_invoice_number is null)
      or
      (status = 'issued' and issued_at is not null and issued_by is not null
        and nullif(pg_catalog.btrim(issued_invoice_number), '') is not null)
      or
      (status = 'void' and issued_at is null and issued_by is null and issued_invoice_number is null)
    ),
  add constraint sales_invoices_void_state_consistent
    check (
      (status <> 'void' and void_reason is null and voided_by is null and voided_at is null)
      or
      (status = 'void' and nullif(pg_catalog.btrim(void_reason), '') is not null
        and voided_by is not null and voided_at is not null)
    );

create unique index if not exists sales_invoices_issued_number_uq
  on public.sales_invoices (issued_invoice_number)
  where status = 'issued';

comment on column public.sales_invoices.tax_status is
  'Tax handling state for the commercial invoice; not a tax invoice/e-Faktur and does not determine company PKP status.';
comment on column public.sales_invoices.issued_invoice_number is
  'Commercial invoice number assigned only by the approved issue workflow.';
comment on column public.sales_invoices.issued_at is
  'Timestamp set only by the approved invoice issuance workflow.';

notify pgrst, 'reload schema';
commit;
