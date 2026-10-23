-- Require an explicit inclusive/exclusive decision for supplier invoices and reconcile
-- the invoice lines against printed subtotal and total before recognizing AP.
begin;

revoke all on function public.post_supplier_invoice_to_ap(uuid, text, text) from public, anon, authenticated;

create function public.post_supplier_invoice_to_ap(
  p_supplier_invoice_id uuid,
  p_input_tax_treatment text,
  p_tax_review_reference text,
  p_price_mode text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.supplier_invoices%rowtype;
  v_id uuid;
  v_ap uuid;
  v_cost uuid;
  v_vat uuid;
  v_tax numeric(20,2);
  v_cost_amount numeric(20,2);
  v_expected_total numeric(20,2);
  v_line_subtotal numeric(20,2);
  v_lines jsonb;
begin
  if not app_private.has_business_role(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Owner/Admin role required';
  end if;
  select * into v_invoice from public.supplier_invoices where id = p_supplier_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Supplier invoice not found'; end if;
  if v_invoice.status = 'posted' then
    select id into v_id from public.journal_entries where source_type = 'supplier_invoice' and source_id = v_invoice.id;
    if found then return v_id; end if;
  end if;
  if v_invoice.status <> 'draft' then
    raise exception using errcode = '22023', message = 'Only a draft supplier invoice can be posted';
  end if;
  if v_invoice.tax_status = 'unverified'
     or p_input_tax_treatment is null
     or p_input_tax_treatment not in ('recoverable', 'nonrecoverable', 'not_applicable')
     or nullif(pg_catalog.btrim(p_tax_review_reference), '') is null then
    raise exception using errcode = '22023', message = 'Supplier tax status, input-tax treatment and approval reference must be verified';
  end if;
  if p_price_mode is null or (v_invoice.tax_status = 'taxed' and p_price_mode not in ('exclusive', 'inclusive'))
     or (v_invoice.tax_status = 'non_taxed' and p_price_mode <> 'not_applicable') then
    raise exception using errcode = '22023', message = 'Explicit inclusive/exclusive price mode must match the supplier invoice tax status';
  end if;
  if v_invoice.tax_status = 'non_taxed' and (v_invoice.tax_amount_reported <> 0 or p_input_tax_treatment <> 'not_applicable') then
    raise exception using errcode = '23514', message = 'Non-taxed supplier invoice must have zero tax and not-applicable input tax';
  end if;
  if v_invoice.tax_status = 'taxed' and p_input_tax_treatment = 'not_applicable' then
    raise exception using errcode = '23514', message = 'Taxed supplier invoice requires a recoverable/nonrecoverable input tax decision';
  end if;
  if p_input_tax_treatment = 'recoverable' and v_invoice.tax_amount_reported <= 0 then
    raise exception using errcode = '23514', message = 'Recoverable input tax amount must be greater than zero';
  end if;

  select coalesce(sum(line_total_reported), 0)
  into v_line_subtotal
  from public.supplier_invoice_lines
  where supplier_invoice_id = v_invoice.id;
  if pg_catalog.round(v_line_subtotal, 2) <> v_invoice.subtotal_reported then
    raise exception using errcode = '23514', message = 'Sum of printed line totals does not match the printed subtotal; correct the draft before posting';
  end if;

  v_expected_total := v_invoice.subtotal_reported - v_invoice.discount_amount_reported + v_invoice.other_charges_reported;
  if p_price_mode <> 'inclusive' then
    v_expected_total := v_expected_total + v_invoice.tax_amount_reported;
  end if;
  if pg_catalog.round(v_expected_total, 2) <> v_invoice.invoice_total_reported then
    raise exception using errcode = '23514', message = 'Printed header amounts do not reconcile; correct the draft before posting';
  end if;

  perform app_private.assert_accounting_posting_ready(v_invoice.invoice_date);
  select account_id into v_ap from public.accounting_account_mappings where mapping_key = 'accounts_payable';
  select account_id into v_cost from public.accounting_account_mappings where mapping_key = 'supplier_cost_clearing';
  select account_id into v_vat from public.accounting_account_mappings where mapping_key = 'vat_input';
  v_tax := case when p_input_tax_treatment = 'recoverable' then v_invoice.tax_amount_reported else 0 end;
  v_cost_amount := v_invoice.invoice_total_reported - v_tax;
  v_lines := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('account_id', v_cost, 'debit', v_cost_amount, 'credit', 0, 'description', 'Biaya supplier dalam akun clearing; belum direklasifikasi ke HPP'),
    pg_catalog.jsonb_build_object('account_id', v_ap, 'debit', 0, 'credit', v_invoice.invoice_total_reported, 'description', 'Hutang supplier')
  );
  if v_tax > 0 then
    v_lines := v_lines || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('account_id', v_vat, 'debit', v_tax, 'credit', 0, 'description', 'PPN masukan yang diputuskan dapat dikreditkan')
    );
  end if;
  v_id := app_private.post_balanced_journal(
    'supplier_invoice', v_invoice.id, v_invoice.invoice_date,
    'Posting AP faktur ' || v_invoice.supplier_invoice_number, pg_catalog.gen_random_uuid(), v_lines
  );
  update public.supplier_invoices
  set status = 'posted', price_mode = p_price_mode,
      input_tax_treatment = p_input_tax_treatment,
      input_tax_review_reference = pg_catalog.btrim(p_tax_review_reference),
      posted_by = auth.uid(), posted_at = pg_catalog.now()
  where id = v_invoice.id;
  return v_id;
end $$;
revoke all on function public.post_supplier_invoice_to_ap(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.post_supplier_invoice_to_ap(uuid, text, text, text) to authenticated;

commit;
