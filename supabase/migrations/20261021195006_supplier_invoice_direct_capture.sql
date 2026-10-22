alter table public.supplier_invoice_lines alter column purchase_order_line_id drop not null;
alter table public.supplier_invoice_lines
  add column if not exists product_code_input text,
  add column if not exists product_name_input text,
  add column if not exists unit_input text;
update public.supplier_invoice_lines
set product_code_input = coalesce(product_code_input, product_code_snapshot),
    product_name_input = coalesce(product_name_input, product_name_snapshot),
    unit_input = coalesce(unit_input, unit_snapshot);
alter table public.supplier_invoice_lines
  alter column product_name_input set not null,
  alter column unit_input set not null;

alter table public.supplier_invoices drop constraint if exists supplier_invoices_tax_mode_consistent;
alter table public.supplier_invoices add constraint supplier_invoices_tax_mode_consistent check (
  (tax_status = 'taxed' and price_mode in ('exclusive', 'inclusive', 'unknown')) or
  (tax_status = 'non_taxed' and price_mode = 'not_applicable' and tax_amount_reported = 0) or
  (tax_status = 'unverified' and price_mode = 'unknown')
);

create or replace function public.create_supplier_invoice(
  p_supplier_id uuid, p_supplier_invoice_number text, p_invoice_date date, p_due_date date,
  p_tax_status text, p_price_mode text, p_tax_rate_reported numeric, p_discount_mode text,
  p_discount_value_reported numeric, p_subtotal_reported numeric, p_discount_amount_reported numeric,
  p_tax_amount_reported numeric, p_other_charges_reported numeric, p_invoice_total_reported numeric,
  p_notes text, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_supplier public.suppliers%rowtype; v_invoice_id uuid; v_line jsonb; v_po_line_id uuid;
  v_code text; v_name text; v_unit text; v_quantity numeric(20,4); v_unit_price numeric(20,2);
  v_line_discount numeric(20,2); v_line_total numeric(20,2); v_line_number integer := 0; v_price_mode text;
begin
  if not app_private.has_business_role(array['owner','admin']) then
    raise exception using errcode='42501', message='Owner/Admin role required';
  end if;
  if p_supplier_id is null or p_invoice_date is null or nullif(pg_catalog.btrim(p_supplier_invoice_number),'') is null then
    raise exception using errcode='22023', message='Supplier, invoice number and date are required';
  end if;
  if p_due_date is not null and p_due_date < p_invoice_date then raise exception using errcode='22023', message='Due date cannot be before invoice date'; end if;
  if p_tax_status not in ('taxed','non_taxed','unverified') then raise exception using errcode='22023', message='Tax status is invalid'; end if;
  v_price_mode := case when p_tax_status='non_taxed' then 'not_applicable' when p_tax_status='taxed' then 'unknown' else 'unknown' end;
  if p_discount_mode not in ('none','amount','percent') then raise exception using errcode='22023', message='Discount mode is invalid'; end if;
  if p_tax_rate_reported is not null and (p_tax_rate_reported < 0 or p_tax_rate_reported > 100) then raise exception using errcode='22023', message='Reported tax rate must be between 0 and 100'; end if;
  if p_discount_value_reported is null or p_discount_value_reported < 0 or (p_discount_mode='percent' and p_discount_value_reported > 100) then raise exception using errcode='22023', message='Reported discount is invalid'; end if;
  if p_subtotal_reported is null or p_subtotal_reported < 0 or p_discount_amount_reported is null or p_discount_amount_reported < 0 or p_tax_amount_reported is null or p_tax_amount_reported < 0 or p_other_charges_reported is null or p_other_charges_reported < 0 or p_invoice_total_reported is null or p_invoice_total_reported < 0 then raise exception using errcode='22023', message='Reported invoice amounts must be zero or greater'; end if;
  if p_tax_status='non_taxed' and coalesce(p_tax_amount_reported,0) <> 0 then raise exception using errcode='22023', message='Non-taxed invoices must report zero tax'; end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines)<>'array' or pg_catalog.jsonb_array_length(p_lines)=0 then raise exception using errcode='22023', message='At least one invoice item is required'; end if;
  select * into v_supplier from public.suppliers s where s.id=p_supplier_id and s.is_active for key share;
  if not found then raise exception using errcode='23503', message='Active supplier not found'; end if;
  insert into public.supplier_invoices(supplier_id,supplier_invoice_number,invoice_date,due_date,tax_status,price_mode,tax_rate_reported,discount_mode,discount_value_reported,subtotal_reported,discount_amount_reported,tax_amount_reported,other_charges_reported,invoice_total_reported,notes,created_by)
  values(p_supplier_id,pg_catalog.btrim(p_supplier_invoice_number),p_invoice_date,p_due_date,p_tax_status,v_price_mode,p_tax_rate_reported,p_discount_mode,p_discount_value_reported,p_subtotal_reported,p_discount_amount_reported,p_tax_amount_reported,p_other_charges_reported,p_invoice_total_reported,nullif(pg_catalog.btrim(p_notes),''),auth.uid()) returning id into v_invoice_id;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as lines(value) loop
    v_line_number := v_line_number + 1;
    v_po_line_id := nullif(v_line->>'purchase_order_line_id','')::uuid;
    v_code := nullif(pg_catalog.btrim(v_line->>'product_code'),'');
    v_name := nullif(pg_catalog.btrim(v_line->>'product_name'),'');
    v_unit := nullif(pg_catalog.btrim(v_line->>'unit'),'');
    if v_po_line_id is not null then
      select pol.product_code_snapshot,pol.product_name_snapshot,pol.unit_snapshot into v_code,v_name,v_unit
      from public.purchase_order_lines pol join public.purchase_orders po on po.id=pol.purchase_order_id
      where pol.id=v_po_line_id and po.supplier_id=p_supplier_id and po.status<>'cancelled'
      for key share of pol,po;
      if not found then raise exception using errcode='23503', message='PO reference does not belong to selected supplier or is cancelled'; end if;
    end if;
    if v_name is null or v_unit is null then raise exception using errcode='22023', message='Each invoice item requires product name and unit'; end if;
    v_quantity := (v_line->>'quantity')::numeric; v_unit_price := (v_line->>'unit_price_reported')::numeric;
    v_line_discount := coalesce((v_line->>'line_discount_reported')::numeric,0); v_line_total := (v_line->>'line_total_reported')::numeric;
    if v_quantity<=0 or v_unit_price<0 or v_line_discount<0 or v_line_total<0 then raise exception using errcode='22023', message='Reported invoice line values are invalid'; end if;
    insert into public.supplier_invoice_lines(supplier_invoice_id,line_number,purchase_order_line_id,product_code_snapshot,product_name_snapshot,unit_snapshot,product_code_input,product_name_input,unit_input,quantity,unit_price_reported,line_discount_reported,line_total_reported)
    values(v_invoice_id,v_line_number,v_po_line_id,coalesce(v_code,''),v_name,v_unit,v_code,v_name,v_unit,v_quantity,v_unit_price,v_line_discount,v_line_total);
  end loop;
  return v_invoice_id;
end; $$;
revoke all on function public.create_supplier_invoice(uuid,text,date,date,text,text,numeric,text,numeric,numeric,numeric,numeric,numeric,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_supplier_invoice(uuid,text,date,date,text,text,numeric,text,numeric,numeric,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;