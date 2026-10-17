-- Billing trigger decision:
-- Create one draft invoice for each shipment when its delivery is recorded.
-- Partial shipments are billed separately as each shipment is accepted.
-- This never issues a legal tax invoice and never posts accounting entries.
-- Existing delivered shipments are intentionally not backfilled by this migration.

create function app_private.create_draft_customer_invoice_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from 'delivered' and new.status = 'delivered' then
    perform public.create_customer_invoice(
      new.id,
      new.delivered_at,
      'Draft dibuat otomatis saat shipment dicatat diterima pelanggan.'
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.create_draft_customer_invoice_on_delivery() from public, anon, authenticated;

create trigger shipments_create_customer_invoice_on_delivery
  after update of status on public.shipments
  for each row
  when (old.status is distinct from 'delivered' and new.status = 'delivered')
  execute function app_private.create_draft_customer_invoice_on_delivery();

comment on function app_private.create_draft_customer_invoice_on_delivery() is
  'Atomically creates one draft customer invoice when a direct shipment is recorded delivered; partial deliveries produce separate drafts.';
