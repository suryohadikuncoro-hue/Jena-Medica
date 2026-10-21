-- D-10 hardening: avoid failing automatic draft creation for future-dated sales orders.
-- The invoice date must not precede the source SO order_date.
-- This migration changes only the trigger function; it does not backfill existing SOs.

begin;

create or replace function app_private.create_draft_customer_invoice_on_so_confirmation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_lines jsonb;
  v_invoice_date date;
begin
  if old.status is distinct from 'confirmed' and new.status='confirmed' then
    if not exists (
      select 1 from public.sales_invoices i where i.sales_order_id=new.id
    ) then
      select jsonb_agg(
        jsonb_build_object('sales_order_line_id',l.id,'quantity',l.quantity)
        order by l.line_number
      )
      into v_lines
      from public.sales_order_lines l
      where l.sales_order_id=new.id;

      if v_lines is not null and jsonb_array_length(v_lines)>0 then
        -- create_customer_invoice rejects invoice dates earlier than the SO date.
        v_invoice_date := greatest(current_date, new.order_date);
        perform public.create_customer_invoice(
          new.id,
          v_invoice_date,
          'Draf dibuat otomatis saat pesanan dikonfirmasi; tinjau kuantitas sebelum diterbitkan.',
          v_lines
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.create_draft_customer_invoice_on_so_confirmation()
  from public, anon, authenticated;

comment on function app_private.create_draft_customer_invoice_on_so_confirmation() is
  'Creates an initial draft invoice on SO transition to confirmed, using an invoice date not earlier than the SO date; does not issue or post accounting.';

notify pgrst, 'reload schema';
commit;
