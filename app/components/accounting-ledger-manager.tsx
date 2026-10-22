"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/error-message";

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
type Account = { id: string; account_code: string; account_name: string; account_type: AccountType; is_active: boolean };
type Mapping = { mapping_key: string; account_id: string };
type Profile = {
  status: "draft" | "approved" | "revoked";
  revenue_recognition_reference: string | null;
  supplier_ap_recognition_reference: string | null;
  supplier_cost_treatment_reference: string | null;
  tax_policy_reference: string | null;
  approval_reference: string | null;
  approved_at: string | null;
};
type Period = { id: string; period_start: string; period_end: string; status: "draft" | "open" | "closed" };
type Journal = { id: string; entry_number: string; source_type: string; source_id: string; entry_date: string; memo: string; total_debit: number | string; status: "posted" | "reversed"; reversal_of_id: string | null };
type JournalLine = { id: string; journal_entry_id: string; line_number: number; account_id: string; description: string; debit: number | string; credit: number | string };
type CustomerInvoiceSource = { id: string; invoice_number: string; customer_name_snapshot: string; invoice_date: string; subtotal_amount: number | string };
type SupplierInvoiceSource = { id: string; supplier_invoice_number: string; invoice_date: string; invoice_total_reported: number | string; tax_status: string };
type PaymentSource = { id: string; payment_number: string; payment_date: string; amount: number | string; payment_method: string };
type AllocationSource = { id: string; payment_id: string; allocation_date: string; created_at: string };

const mappingSpecs = [
  ["accounts_receivable", "Piutang usaha (AR)", "asset"],
  ["accounts_payable", "Hutang usaha (AP)", "liability"],
  ["customer_advances", "Uang muka pelanggan", "liability"],
  ["supplier_advances", "Uang muka supplier", "asset"],
  ["cash", "Kas", "asset"],
  ["bank", "Bank", "asset"],
  ["sales_revenue", "Pendapatan penjualan", "revenue"],
  ["supplier_cost_clearing", "Clearing biaya supplier (belum HPP)", "asset"],
  ["vat_output", "PPN keluaran", "liability"],
  ["vat_input", "PPN masukan", "asset"],
] as const;
const money = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const dateLabel = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
function formatSaveConfigurationError(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause !== "object" || cause === null) return "Konfigurasi tidak dapat disimpan.";

  const error = cause as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const message = typeof error.message === "string" && error.message.trim()
    ? error.message.trim()
    : "Konfigurasi tidak dapat disimpan.";
  const metadata = [
    typeof error.code === "string" && error.code ? `Kode: ${error.code}` : "",
    typeof error.details === "string" && error.details ? `Detail: ${error.details}` : "",
    typeof error.hint === "string" && error.hint ? `Petunjuk: ${error.hint}` : "",
  ].filter(Boolean);

  return [message, ...metadata].join("\n");
}
async function readPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

export function AccountingLedgerManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [salesDrafts, setSalesDrafts] = useState<CustomerInvoiceSource[]>([]);
  const [supplierDrafts, setSupplierDrafts] = useState<SupplierInvoiceSource[]>([]);
  const [customerPayments, setCustomerPayments] = useState<PaymentSource[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<PaymentSource[]>([]);
  const [customerBatches, setCustomerBatches] = useState<AllocationSource[]>([]);
  const [supplierBatches, setSupplierBatches] = useState<AllocationSource[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accountDraft, setAccountDraft] = useState({ code: "", name: "", type: "asset" as AccountType, description: "" });
  const [policy, setPolicy] = useState({ revenue: "", ap: "", cost: "", tax: "", approval: "" });
  const [periodDraft, setPeriodDraft] = useState({ start: "", end: "" });
  const [closeTarget, setCloseTarget] = useState<Period | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const configured = isSupabaseConfigured();
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError(""); setSchemaReady(false);
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(""); throw new Error("Masuk untuk melihat COA dan jurnal."); }
      const businessRole = String(session.user.app_metadata?.business_role ?? "");
      setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) throw new Error("Akun ini belum memiliki role bisnis yang valid.");
      const [accountResult, mappingResult, profileResult, periodResult, journalResult, salesRows, supplierRows, customerPaymentRows, supplierPaymentRows, customerBatchRows, supplierBatchRows] = await Promise.all([
        supabase.from("chart_of_accounts").select("id,account_code,account_name,account_type,is_active").order("account_code").limit(2000),
        supabase.from("accounting_account_mappings").select("mapping_key,account_id").limit(20),
        supabase.from("accounting_posting_profile").select("status,revenue_recognition_reference,supplier_ap_recognition_reference,supplier_cost_treatment_reference,tax_policy_reference,approval_reference,approved_at").eq("singleton", true).maybeSingle(),
        supabase.from("accounting_periods").select("id,period_start,period_end,status").order("period_start", { ascending: false }).limit(500),
        supabase.from("journal_entries").select("id,entry_number,source_type,source_id,entry_date,memo,total_debit,status,reversal_of_id").order("entry_date", { ascending: false }).order("entry_number", { ascending: false }).limit(300),
        readPages<CustomerInvoiceSource>((from, to) => supabase.from("sales_invoices").select("id,invoice_number,customer_name_snapshot,invoice_date,subtotal_amount").eq("status", "draft").order("invoice_date").range(from, to)),
        readPages<SupplierInvoiceSource>((from, to) => supabase.from("supplier_invoices").select("id,supplier_invoice_number,invoice_date,invoice_total_reported,tax_status").eq("status", "draft").order("invoice_date").range(from, to)),
        readPages<PaymentSource>((from, to) => supabase.from("customer_payments").select("id,payment_number,payment_date,amount,payment_method").eq("status", "recorded").order("payment_date", { ascending: false }).range(from, to)),
        readPages<PaymentSource>((from, to) => supabase.from("supplier_payments").select("id,payment_number,payment_date,amount,payment_method").eq("status", "recorded").order("payment_date", { ascending: false }).range(from, to)),
        readPages<AllocationSource>((from, to) => supabase.from("customer_payment_allocation_batches").select("id,payment_id,allocation_date,created_at").eq("status", "active").order("created_at", { ascending: false }).range(from, to)),
        readPages<AllocationSource>((from, to) => supabase.from("supplier_payment_allocation_batches").select("id,payment_id,allocation_date,created_at").eq("status", "active").order("created_at", { ascending: false }).range(from, to)),
      ]);
      for (const result of [accountResult, mappingResult, profileResult, periodResult, journalResult]) if (result.error) throw result.error;
      const journalRows = (journalResult.data ?? []) as Journal[];
      const journalLinesRows: JournalLine[] = [];
      const journalIds = journalRows.map(row => row.id);
      for (let offset = 0; offset < journalIds.length; offset += 100) {
        const ids = journalIds.slice(offset, offset + 100);
        journalLinesRows.push(...await readPages<JournalLine>((from, to) => supabase.from("journal_lines").select("id,journal_entry_id,line_number,account_id,description,debit,credit").in("journal_entry_id", ids).order("line_number").range(from, to)));
      }
      const nextProfile = profileResult.data as Profile | null;
      setAccounts((accountResult.data ?? []) as Account[]);
      setMappings(Object.fromEntries(((mappingResult.data ?? []) as Mapping[]).map(row => [row.mapping_key, row.account_id])));
      setProfile(nextProfile);
      setPolicy({ revenue: nextProfile?.revenue_recognition_reference ?? "", ap: nextProfile?.supplier_ap_recognition_reference ?? "", cost: nextProfile?.supplier_cost_treatment_reference ?? "", tax: nextProfile?.tax_policy_reference ?? "", approval: nextProfile?.approval_reference ?? "" });
      setPeriods((periodResult.data ?? []) as Period[]);
      setJournals(journalRows);
      setJournalLines(journalLinesRows);
      setSalesDrafts(salesRows);
      setSupplierDrafts(supplierRows);
      setCustomerPayments(customerPaymentRows);
      setSupplierPayments(supplierPaymentRows);
      setCustomerBatches(customerBatchRows);
      setSupplierBatches(supplierBatchRows);
      setSchemaReady(true);
    } catch (cause) {
      const detail = friendlyErrorMessage(cause, "Gagal memuat accounting setup.");
      setError(/chart_of_accounts|accounting_posting_profile|accounting_periods|journal_entries|schema cache|does not exist/i.test(detail)
        ? "Migration accounting belum diterapkan pada Supabase. UI tidak dapat membaca posting sources; belum ada perubahan yang disimpan."
        : detail);
    } finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  const accountById = useMemo(() => new Map(accounts.map(item => [item.id, item])), [accounts]);
  const linesByJournal = useMemo(() => {
    const grouped = new Map<string, JournalLine[]>();
    for (const line of journalLines) grouped.set(line.journal_entry_id, [...(grouped.get(line.journal_entry_id) ?? []), line]);
    return grouped;
  }, [journalLines]);
  const activePeriods = periods.filter(item => item.status === "open");
  const mappedCount = mappingSpecs.filter(([key]) => Boolean(mappings[key])).length;
  const postedSources = new Set(journals.map(journal => `${journal.source_type}:${journal.source_id}`));
  const dateIsOpen = (date: string) => periods.some(period => period.status === "open" && date >= period.period_start && date <= period.period_end);
  const postGateReady = profile?.status === "approved";

  async function postCustomerInvoice(event: FormEvent<HTMLFormElement>, invoiceId: string) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const number = String(form.get("issued_invoice_number") ?? "").trim();
      const taxStatus = String(form.get("tax_status") ?? "");
      const taxCode = String(form.get("tax_code") ?? "").trim();
      const taxBase = Number(form.get("tax_base_amount"));
      const taxRate = Number(form.get("tax_rate"));
      const taxAmount = Number(form.get("tax_amount"));
      const reference = String(form.get("tax_reference") ?? "").trim();
      if (!number || !reference || ![taxBase, taxRate, taxAmount].every(Number.isFinite) || taxBase < 0 || taxRate < 0 || taxRate > 100 || taxAmount < 0 || Math.abs(taxAmount * 100 - Math.round(taxAmount * 100)) > 1e-8) throw new Error("Nomor invoice, referensi keputusan pajak, dan nilai pajak yang valid wajib diisi.");
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("post_customer_invoice_to_ar", { p_customer_invoice_id: invoiceId, p_issued_invoice_number: number, p_tax_status: taxStatus, p_tax_code: taxCode || null, p_tax_base_amount: taxBase, p_tax_rate: taxRate, p_tax_amount: taxAmount, p_tax_approval_reference: reference });
      if (rpcError) throw rpcError;
      setNotice("Invoice diterbitkan sebagai invoice komersial dan jurnal AR tersimpan. Ini bukan penerbitan e-Faktur; nilai PPN dimasukkan manual dari keputusan yang disetujui."); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Posting AR gagal.")); }
    finally { setSaving(false); }
  }

  async function postSupplierInvoice(event: FormEvent<HTMLFormElement>, invoiceId: string) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const treatment = String(form.get("input_tax_treatment") ?? "");
      const reference = String(form.get("tax_reference") ?? "").trim();
      if (!reference) throw new Error("Referensi review pajak supplier wajib diisi.");
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("post_supplier_invoice_to_ap", { p_supplier_invoice_id: invoiceId, p_input_tax_treatment: treatment, p_tax_review_reference: reference });
      if (rpcError) throw rpcError;
      setNotice("Faktur supplier diposting ke AP; biaya masuk akun clearing, belum direklasifikasi ke HPP."); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Posting AP gagal.")); }
    finally { setSaving(false); }
  }

  async function postSource(functionName: string, id: string, successMessage: string) {
    setError(""); setNotice(""); setSaving(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc(functionName, functionName.includes("allocation") ? { p_batch_id: id } : { p_payment_id: id });
      if (rpcError) throw rpcError;
      setNotice(successMessage); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Posting jurnal gagal.")); }
    finally { setSaving(false); }
  }

  async function reverseJournal(journal: Journal) {
    const reason = window.prompt(`Alasan membalik jurnal ${journal.entry_number}?`);
    if (!reason?.trim()) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("reverse_accounting_journal", { p_journal_entry_id: journal.id, p_reason: reason.trim() });
      if (rpcError) throw rpcError;
      setNotice("Jurnal dibalik pada periode yang sedang terbuka dan transaksi pembayaran/alokasi terkait dinonaktifkan."); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Jurnal tidak dapat dibalik.")); }
    finally { setSaving(false); }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("create_accounting_account", {
        p_account_code: accountDraft.code.trim(), p_account_name: accountDraft.name.trim(), p_account_type: accountDraft.type, p_description: accountDraft.description.trim() || null,
      });
      if (rpcError) throw rpcError;
      setAccountDraft({ code: "", name: "", type: "asset", description: "" });
      setNotice("Akun COA tersimpan. Akun belum dipetakan atau disetujui untuk posting."); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Akun tidak dapat disimpan.")); }
    finally { setSaving(false); }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (mappingSpecs.some(([key]) => !mappings[key])) throw new Error("Pilih akun untuk seluruh 10 mapping sebelum menyimpan.");
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("save_accounting_configuration", {
        p_mappings: mappingSpecs.map(([mapping_key]) => ({ mapping_key, account_id: mappings[mapping_key] })),
        p_revenue_recognition_reference: policy.revenue.trim(), p_supplier_ap_recognition_reference: policy.ap.trim(),
        p_supplier_cost_treatment_reference: policy.cost.trim(), p_tax_policy_reference: policy.tax.trim(),
      });
      if (rpcError) throw rpcError;
      setNotice("Konfigurasi disimpan sebagai draft. Posting tetap terkunci sampai referensi dan persetujuan eksplisit dicatat."); await load();
    } catch (cause) { setError(formatSaveConfigurationError(cause)); }
    finally { setSaving(false); }
  }

  async function approveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("approve_accounting_configuration", { p_approval_reference: policy.approval.trim() });
      if (rpcError) throw rpcError;
      setNotice("Konfigurasi akuntansi disetujui. Posting tetap memerlukan periode terbuka dan dokumen yang memenuhi validasi."); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Persetujuan tidak dapat disimpan.")); }
    finally { setSaving(false); }
  }

  async function openPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("create_and_open_accounting_period", { p_period_start: periodDraft.start, p_period_end: periodDraft.end });
      if (rpcError) throw rpcError;
      setPeriodDraft({ start: "", end: "" }); setNotice("Periode dibuka. Hanya tanggal dalam periode ini yang dapat diposting."); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Periode tidak dapat dibuka.")); }
    finally { setSaving(false); }
  }

  async function closePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!closeTarget) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("close_accounting_period", { p_period_id: closeTarget.id, p_reason: closeReason.trim() });
      if (rpcError) throw rpcError;
      setCloseTarget(null); setCloseReason(""); setNotice("Periode ditutup; tanggalnya tidak lagi menerima posting."); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Periode tidak dapat ditutup.")); }
    finally { setSaving(false); }
  }

  return <section className="space-y-5">
    <div className="demo-banner"><strong>Posting dikunci secara default.</strong> Tidak ada COA, mapping, atau periode contoh. Posting AP/AR/jurnal hanya tersedia setelah mapping akun dan referensi kebijakan disimpan serta disetujui Owner/Admin. PPN diinput dari keputusan yang disetujui; aplikasi tidak menghitung tarif atau DPP.</div>
    {error && <p role="alert" className="whitespace-pre-wrap rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <a className="ml-2 underline" href="/login">Masuk</a>}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {loading ? <div className="card card-pad text-sm text-[var(--muted)]">Memuat konfigurasi ledger…</div> : schemaReady && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Status konfigurasi" value={profile?.status === "approved" ? "Disetujui" : profile?.status === "revoked" ? "Dicabut" : "Draft / terkunci"} detail={profile?.approved_at ? `Disetujui ${new Date(profile.approved_at).toLocaleString("id-ID")}` : "Belum ada jurnal yang diizinkan"} />
        <Kpi label="Mapping akun" value={`${mappedCount}/10`} detail="Tidak ada akun default" />
        <Kpi label="Periode terbuka" value={String(activePeriods.length)} detail={activePeriods.length ? `${dateLabel(activePeriods[0].period_start)}–${dateLabel(activePeriods[0].period_end)}` : "Belum ada"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <div className="card card-pad">
          <h3 className="font-semibold">Bagan akun</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Masukkan akun resmi perusahaan sesuai COA yang disetujui. Akun yang dipetakan tidak dapat dinonaktifkan sampai mapping dilepas.</p>
          {canWrite && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={saveAccount}>
            <label className="field-label">Kode akun<input required maxLength={40} className="field-input" value={accountDraft.code} onChange={event => setAccountDraft(value => ({ ...value, code: event.target.value }))} /></label>
            <label className="field-label">Jenis akun<select className="field-input" value={accountDraft.type} onChange={event => setAccountDraft(value => ({ ...value, type: event.target.value as AccountType }))}>{([["asset","Aset"],["liability","Liabilitas"],["equity","Ekuitas"],["revenue","Pendapatan"],["expense","Beban"]] as const).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field-label sm:col-span-2">Nama akun<input required maxLength={160} className="field-input" value={accountDraft.name} onChange={event => setAccountDraft(value => ({ ...value, name: event.target.value }))} /></label>
            <label className="field-label sm:col-span-2">Catatan (opsional)<input maxLength={500} className="field-input" value={accountDraft.description} onChange={event => setAccountDraft(value => ({ ...value, description: event.target.value }))} /></label>
            <div className="sm:col-span-2 flex justify-end"><button className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Tambah akun"}</button></div>
          </form>}
          <div className="mt-4 max-h-72 space-y-2 overflow-auto">{accounts.length ? accounts.map(account => <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-muted)] p-2 text-xs"><span><strong className="font-mono">{account.account_code}</strong> · {account.account_name}</span><span className="status-pill">{account.account_type}{!account.is_active ? " · nonaktif" : ""}</span></div>) : <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-xs text-[var(--muted)]">Belum ada akun COA yang dimasukkan.</p>}</div>
        </div>

        <div className="card card-pad">
          <h3 className="font-semibold">Mapping dan kebijakan posting</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Mapping menjelaskan akun kontrol untuk setiap jurnal. Referensi harus menunjuk keputusan pemilik/akuntan; mengisi form tidak membuat angka default.</p>
          <form className="mt-4 space-y-4" onSubmit={saveConfiguration}>
            <div className="grid gap-3 sm:grid-cols-2">{mappingSpecs.map(([key,label,type]) => <label key={key} className="field-label">{label}<select required disabled={!canWrite || saving} className="field-input" value={mappings[key] ?? ""} onChange={event => setMappings(current => ({ ...current, [key]: event.target.value }))}><option value="">Pilih akun {type}…</option>{accounts.filter(account => account.is_active && account.account_type === type).map(account => <option key={account.id} value={account.id}>{account.account_code} · {account.account_name}</option>)}</select></label>)}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PolicyField label="Referensi pengakuan pendapatan" value={policy.revenue} onChange={value => setPolicy(current => ({ ...current, revenue: value }))} disabled={!canWrite || saving} />
              <PolicyField label="Referensi pengakuan AP" value={policy.ap} onChange={value => setPolicy(current => ({ ...current, ap: value }))} disabled={!canWrite || saving} />
              <PolicyField label="Referensi perlakuan biaya supplier / clearing" value={policy.cost} onChange={value => setPolicy(current => ({ ...current, cost: value }))} disabled={!canWrite || saving} />
              <PolicyField label="Referensi kebijakan pajak/PPN" value={policy.tax} onChange={value => setPolicy(current => ({ ...current, tax: value }))} disabled={!canWrite || saving} />
            </div>
            {canWrite && <div className="flex justify-end"><button className="tab-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan konfigurasi sebagai draft"}</button></div>}
          </form>
          {canWrite && <form className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3" onSubmit={approveConfiguration}>
            <label className="field-label text-amber-950">Referensi persetujuan Owner/Akuntan<input required maxLength={500} className="field-input mt-1" value={policy.approval} onChange={event => setPolicy(current => ({ ...current, approval: event.target.value }))} placeholder="Contoh: memo kebijakan / berita acara persetujuan" /></label>
            <p className="mt-2 text-xs leading-5 text-amber-900">Menyetujui konfigurasi membuka gate posting bila periode terbuka dan data sumber tervalidasi. Pastikan referensi benar-benar berasal dari keputusan yang disetujui; tidak ada akun atau perlakuan pajak bawaan.</p>
            <div className="mt-3 flex justify-end"><button type="submit" className="primary-button" disabled={saving || mappedCount !== 10 || !canWrite}>{saving ? "Memproses…" : profile?.status === "approved" ? "Perbarui persetujuan" : "Setujui konfigurasi"}</button></div>
          </form>}
        </div>
      </div>

      <section className="card card-pad">
        <div className="mb-4"><h3 className="font-semibold">Antrean posting AP/AR dan jurnal alokasi</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Posting hanya tersedia bila profil disetujui dan tanggal sumber berada pada periode terbuka. Invoice pelanggan meminta nilai pajak/PPN manual dari keputusan yang disetujui; aplikasi tidak menghitung tarif atau DPP.</p></div>
        {!postGateReady && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Posting terkunci: lengkapi mapping COA, simpan referensi kebijakan, lalu catat persetujuan eksplisit.</p>}
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h4 className="text-sm font-semibold">Invoice pelanggan — issue & post AR ({salesDrafts.length})</h4><div className="mt-2 space-y-2">{salesDrafts.length ? salesDrafts.map(invoice => <details key={invoice.id} className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer text-xs"><strong>{invoice.invoice_number}</strong> · {invoice.customer_name_snapshot} · {dateLabel(invoice.invoice_date)} · {money(invoice.subtotal_amount)}</summary><form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={event => void postCustomerInvoice(event, invoice.id)}><label className="field-label sm:col-span-2">Nomor invoice komersial<input required maxLength={120} name="issued_invoice_number" className="field-input" placeholder="Nomor yang disetujui perusahaan" /></label><label className="field-label">Perlakuan pajak<select required name="tax_status" className="field-input"><option value="">Pilih…</option><option value="taxed">Kena pajak</option><option value="non_taxed">Tidak dikenai</option><option value="exempt">Dikecualikan</option><option value="zero_rated">Tarif 0%</option></select></label><label className="field-label">Kode pajak<input name="tax_code" maxLength={80} className="field-input" placeholder="Kode/klasifikasi resmi" /></label><label className="field-label">DPP sesuai keputusan<input required name="tax_base_amount" type="number" min="0" step="0.01" className="field-input" defaultValue={invoice.subtotal_amount} /></label><label className="field-label">Tarif dilaporkan (%)<input required name="tax_rate" type="number" min="0" max="100" step="0.0001" className="field-input" defaultValue="0" /></label><label className="field-label">Nominal PPN disetujui<input required name="tax_amount" type="number" min="0" step="0.01" className="field-input" defaultValue="0" /></label><label className="field-label">Referensi keputusan pajak<input required name="tax_reference" maxLength={500} className="field-input" placeholder="Memo/otorisasi akuntan" /></label><div className="sm:col-span-2 flex items-center justify-between gap-2"><span className="text-[11px] text-[var(--muted)]">{dateIsOpen(invoice.invoice_date) ? "Tanggal masuk periode terbuka" : "Buka periode yang mencakup tanggal invoice"}</span><button className="primary-button" disabled={saving || !canWrite || !postGateReady || !dateIsOpen(invoice.invoice_date)}>{saving ? "Memproses…" : "Terbitkan & posting AR"}</button></div></form></details>) : <p className="text-xs text-[var(--muted)]">Tidak ada draft invoice pelanggan.</p>}</div></div>
          <div><h4 className="text-sm font-semibold">Faktur supplier — post AP ({supplierDrafts.length})</h4><div className="mt-2 space-y-2">{supplierDrafts.length ? supplierDrafts.map(invoice => <details key={invoice.id} className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer text-xs"><strong>{invoice.supplier_invoice_number}</strong> · {dateLabel(invoice.invoice_date)} · {money(invoice.invoice_total_reported)} · pajak {invoice.tax_status}</summary><form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={event => void postSupplierInvoice(event, invoice.id)}><label className="field-label">Perlakuan PPN masukan<select required name="input_tax_treatment" className="field-input"><option value="">Pilih keputusan…</option><option value="recoverable">Dapat dikreditkan</option><option value="nonrecoverable">Tidak dapat dikreditkan</option><option value="not_applicable">Tidak berlaku</option></select></label><label className="field-label">Referensi review pajak<input required name="tax_reference" maxLength={500} className="field-input" placeholder="Memo/otorisasi akuntan" /></label><div className="sm:col-span-2 flex items-center justify-between gap-2"><span className="text-[11px] text-[var(--muted)]">Debit clearing biaya supplier; HPP belum diakui.</span><button className="primary-button" disabled={saving || !canWrite || !postGateReady || !dateIsOpen(invoice.invoice_date)}>{saving ? "Memproses…" : "Post ke AP"}</button></div></form></details>) : <p className="text-xs text-[var(--muted)]">Tidak ada draft faktur supplier.</p>}</div></div>
          <div><h4 className="text-sm font-semibold">Penerimaan pelanggan — jurnal kas/uang muka</h4><div className="mt-2 space-y-2">{customerPayments.filter(payment => !postedSources.has(`customer_payment:${payment.id}`)).length ? customerPayments.filter(payment => !postedSources.has(`customer_payment:${payment.id}`)).map(payment => <SourcePost key={payment.id} label={`${payment.payment_number} · ${dateLabel(payment.payment_date)} · ${money(payment.amount)}`} ready={postGateReady && dateIsOpen(payment.payment_date)} saving={saving} onPost={() => void postSource("post_customer_payment_journal", payment.id, "Jurnal penerimaan pelanggan tersimpan: debit kas/bank, kredit uang muka pelanggan.")} />) : <p className="text-xs text-[var(--muted)]">Tidak ada penerimaan yang menunggu jurnal.</p>}</div></div>
          <div><h4 className="text-sm font-semibold">Pembayaran supplier — jurnal kas/uang muka</h4><div className="mt-2 space-y-2">{supplierPayments.filter(payment => !postedSources.has(`supplier_payment:${payment.id}`)).length ? supplierPayments.filter(payment => !postedSources.has(`supplier_payment:${payment.id}`)).map(payment => <SourcePost key={payment.id} label={`${payment.payment_number} · ${dateLabel(payment.payment_date)} · ${money(payment.amount)}`} ready={postGateReady && dateIsOpen(payment.payment_date)} saving={saving} onPost={() => void postSource("post_supplier_payment_journal", payment.id, "Jurnal pembayaran supplier tersimpan: debit uang muka supplier, kredit kas/bank.")} />) : <p className="text-xs text-[var(--muted)]">Tidak ada pembayaran yang menunggu jurnal.</p>}</div></div>
          <div><h4 className="text-sm font-semibold">Alokasi penerimaan pelanggan</h4><div className="mt-2 space-y-2">{customerBatches.filter(batch => !postedSources.has(`customer_allocation:${batch.id}`)).length ? customerBatches.filter(batch => !postedSources.has(`customer_allocation:${batch.id}`)).map(batch => <SourcePost key={batch.id} label={`Batch ${batch.id.slice(0,8)} · ${dateLabel(batch.allocation_date)}`} ready={postGateReady && dateIsOpen(batch.allocation_date)} saving={saving} onPost={() => void postSource("post_customer_allocation_journal", batch.id, "Jurnal alokasi pelanggan tersimpan: debit uang muka, kredit piutang.")} />) : <p className="text-xs text-[var(--muted)]">Tidak ada batch yang menunggu jurnal.</p>}</div></div>
          <div><h4 className="text-sm font-semibold">Alokasi pembayaran supplier</h4><div className="mt-2 space-y-2">{supplierBatches.filter(batch => !postedSources.has(`supplier_allocation:${batch.id}`)).length ? supplierBatches.filter(batch => !postedSources.has(`supplier_allocation:${batch.id}`)).map(batch => <SourcePost key={batch.id} label={`Batch ${batch.id.slice(0,8)} · ${dateLabel(batch.allocation_date)}`} ready={postGateReady && dateIsOpen(batch.allocation_date)} saving={saving} onPost={() => void postSource("post_supplier_allocation_journal", batch.id, "Jurnal alokasi supplier tersimpan: debit hutang, kredit uang muka.")} />) : <p className="text-xs text-[var(--muted)]">Tidak ada batch yang menunggu jurnal.</p>}</div></div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]">
        <div className="card card-pad"><h3 className="font-semibold">Periode posting</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Periode tidak boleh tumpang tindih. Menutup periode menolak posting berikutnya pada rentang tanggal tersebut.</p>
          {canWrite && <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={openPeriod}><label className="field-label">Mulai<input required type="date" className="field-input" value={periodDraft.start} onChange={event => setPeriodDraft(value => ({ ...value, start: event.target.value }))} /></label><label className="field-label">Sampai<input required type="date" min={periodDraft.start} className="field-input" value={periodDraft.end} onChange={event => setPeriodDraft(value => ({ ...value, end: event.target.value }))} /></label><button className="primary-button sm:col-span-2" disabled={saving || profile?.status !== "approved"}>{saving ? "Memproses…" : "Buka periode"}</button></form>}
          <div className="mt-4 space-y-2">{periods.length ? periods.map(period => <div key={period.id} className="rounded-lg bg-[var(--surface-muted)] p-3"><div className="flex items-center justify-between gap-2 text-xs"><strong>{dateLabel(period.period_start)} — {dateLabel(period.period_end)}</strong><span className="status-pill">{period.status}</span></div>{period.status === "open" && canWrite && <button type="button" className="mt-2 text-xs font-semibold text-amber-800 underline" onClick={() => { setCloseTarget(period); setCloseReason(""); }}>Tutup periode</button>}</div>) : <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-xs text-[var(--muted)]">Belum ada periode posting.</p>}</div>
        </div>

        <div className="card card-pad"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Jurnal umum</h3><p className="mt-1 text-xs text-[var(--muted)]">{journals.length} jurnal terakhir · urut terbaru</p></div><button type="button" className="tab-button" onClick={() => void load()} disabled={loading}>Muat ulang</button></div>
          {journals.length ? <div className="space-y-2">{journals.map(journal => <details key={journal.id} className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer text-xs"><span className="font-mono font-semibold">{journal.entry_number}</span><span className="mx-2">·</span>{journal.entry_date}<span className="mx-2">·</span>{journal.source_type}<span className="mx-2">·</span>{money(journal.total_debit)}<span className="ml-2 status-pill">{journal.status}</span><p className="mt-1 text-[var(--muted)]">{journal.memo}</p></summary><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted)]"><th className="py-2">Akun</th><th>Deskripsi</th><th className="text-right">Debit</th><th className="text-right">Kredit</th></tr></thead><tbody>{(linesByJournal.get(journal.id) ?? []).map(line => <tr key={line.id} className="border-b border-[var(--border)]"><td className="py-2 pr-2 font-mono">{accountById.get(line.account_id)?.account_code ?? "—"} · {accountById.get(line.account_id)?.account_name ?? "Akun"}</td><td className="py-2 pr-2">{line.description}</td><td className="py-2 text-right">{Number(line.debit) ? money(line.debit) : "—"}</td><td className="py-2 text-right">{Number(line.credit) ? money(line.credit) : "—"}</td></tr>)}</tbody></table></div>{journal.reversal_of_id && <p className="mt-2 text-xs text-[var(--muted)]">Pembalikan untuk {journal.reversal_of_id}</p>}{canWrite && journal.status === "posted" && !["customer_invoice","supplier_invoice","reversal"].includes(journal.source_type) && <button type="button" className="mt-2 text-xs font-semibold text-amber-800 underline" disabled={saving || !activePeriods.length} onClick={() => void reverseJournal(journal)}>Balik jurnal</button>}</details>)}</div> : <p className="rounded-lg border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--muted)]">Belum ada jurnal. Tidak ada angka demo atau saldo yang direka.</p>}
        </div>
      </div>
    </>}
    {closeTarget && <form className="card card-pad border border-amber-300" onSubmit={closePeriod}><h3 className="font-semibold">Tutup periode {dateLabel(closeTarget.period_start)}—{dateLabel(closeTarget.period_end)}</h3><p className="mt-1 text-xs text-[var(--muted)]">Periode yang ditutup tidak dapat menerima posting lagi. Pastikan rekonsiliasi telah dilakukan di luar workflow ini.</p><label className="field-label mt-3">Alasan / referensi tutup<input required minLength={3} maxLength={500} className="field-input" value={closeReason} onChange={event => setCloseReason(event.target.value)} /></label><div className="mt-3 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => setCloseTarget(null)}>Batal</button><button className="primary-button" disabled={saving || closeReason.trim().length < 3}>{saving ? "Menutup…" : "Konfirmasi tutup"}</button></div></form>}
    {!canWrite && schemaReady && <p className="text-xs text-[var(--muted)]">Viewer dapat membaca COA, kebijakan, periode, dan jurnal; hanya Owner/Admin yang dapat mengubah konfigurasi.</p>}
  </section>;
}

function SourcePost({ label, ready, saving, onPost }: { label: string; ready: boolean; saving: boolean; onPost: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-2 text-xs"><span>{label}</span><button type="button" className="tab-button" disabled={!ready || saving} onClick={onPost}>{saving ? "Memproses…" : ready ? "Post jurnal" : "Gate tertutup"}</button></div>;
}
function PolicyField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="field-label">{label}<input required maxLength={500} className="field-input" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} placeholder="ID atau nama dokumen kebijakan" /></label>;
}
function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-lg font-bold">{value}</p><p className="mt-1 text-[11px] text-[var(--muted-soft)]">{detail}</p></article>;
}
