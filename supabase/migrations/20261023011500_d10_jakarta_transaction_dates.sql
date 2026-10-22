-- D-10 hardening: business transaction dates follow Asia/Jakarta.
-- Supabase sessions may use UTC; current_date must not shift an SO/invoice to the prior day for WIB users.

begin;

create or replace function app_private.create_draft_customer_invoice_on_so_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines jsonb;
  v_invoice_date date;
begin
  if old.status is distinct from 'confirmed' and new.status = 'confirmed' then
    if not exists (
      select 1 from public.sales_invoices i where i.sales_order_id = new.id
    ) then
      select jsonb_agg(
        jsonb_build_object('sales_order_line_id', l.id, 'quantity', l.quantity)
        order by l.line_number
      )
      into v_lines
      from public.sales_order_lines l
      where l.sales_order_id = new.id;

      if v_lines is not null and jsonb_array_length(v_lines) > 0 then
        v_invoice_date := greatest((timezone('Asia/Jakarta', now()))::date, new.order_date);
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
  'Creates an initial draft customer invoice on SO confirmation using Asia/Jakarta business date; does not issue or post accounting.';

notify pgrst, 'reload schema';
commit;
