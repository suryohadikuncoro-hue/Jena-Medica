-- D-13/D-14: private supplier invoice attachments and auditable supplier approval metadata.
-- This migration is additive. It does not change Production until explicitly deployed.
begin;

create table if not exists public.supplier_invoice_attachments (
  id uuid primary key default gen_random_uuid(),
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete restrict,
  storage_path text not null unique check (length(btrim(storage_path)) > 0),
  original_file_name text not null check (length(btrim(original_file_name)) > 0),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  uploaded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists supplier_invoice_attachments_invoice_idx
  on public.supplier_invoice_attachments (supplier_invoice_id, created_at desc);

alter table public.supplier_invoice_attachments enable row level security;
revoke all on public.supplier_invoice_attachments from public, anon, authenticated;
grant select, insert on public.supplier_invoice_attachments to authenticated;

drop policy if exists supplier_invoice_attachments_select_business on public.supplier_invoice_attachments;
create policy supplier_invoice_attachments_select_business
  on public.supplier_invoice_attachments for select to authenticated
  using (app_private.has_business_role(array['owner', 'admin', 'viewer']));

drop policy if exists supplier_invoice_attachments_insert_writers on public.supplier_invoice_attachments;
create policy supplier_invoice_attachments_insert_writers
  on public.supplier_invoice_attachments for insert to authenticated
  with check (
    app_private.has_business_role(array['owner', 'admin'])
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.supplier_invoices si
      where si.id = supplier_invoice_id and si.status <> 'void'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-invoices',
  'supplier-invoices',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[];

drop policy if exists supplier_invoice_files_select_business on storage.objects;
create policy supplier_invoice_files_select_business
  on storage.objects for select to authenticated
  using (
    bucket_id = 'supplier-invoices'
    and app_private.has_business_role(array['owner', 'admin', 'viewer'])
  );

drop policy if exists supplier_invoice_files_insert_owner_admin on storage.objects;
create policy supplier_invoice_files_insert_owner_admin
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'supplier-invoices'
    and app_private.has_business_role(array['owner', 'admin'])
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
