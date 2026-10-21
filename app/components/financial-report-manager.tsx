"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
type Account = { id: string; account_code: string; account_name: string; account_type: AccountType; is_active: boolean };
type Mapping = { mapping_key: string; account_id: string };
type Period = { id: string; period_start: string; period_end: string; status: "draft" | "open" | "closed" };
type Entry = { id: string; entry_number: string; source_type: string; source_id: string; entry_date: string; memo: string; total_debit: number | string; status: "posted" | "reversed"; reversal_of_id: string | null };
type Line = { id: string; journal_entry_id: string; line_number: number; account_id: string; description: string; debit: number | string; credit: number | string };
type Profile = { status: "draft" | "approved" | "revoked"; approved_at: string | null };
type CustomerInvoice = { id: string; invoice_number: string; issued_invoice_number: string | null; customer_name_snapshot: string; invoice_date: string; due_date: string | null; total_amount: number | string; tax_status: string; tax_code_snapshot: string | null; tax_base_amount: number | string | null; tax_rate_reported: number | string | null; tax_amount: number | string; tax_approval_reference: string | null; status: string };
type SupplierInvoice = { id: string; supplier_id: string; supplier_invoice_number: string; invoice_date: string; due_date: string | null; invoice_total_reported: number | string; tax_amount_reported: number | string; tax_status: string; tax_rate_reported: number | string | null; input_tax_treatment: string; input_tax_review_reference: string | null; status: string };
type Supplier = { id: string; code: string; legal_name: string };
type AllocationBatch = { id: string; status: "active"; allocation_date: string };
type CustomerAllocation = { batch_id: string; sales_invoice_id: string; allocated_amount: number | string };
type SupplierAllocation = { batch_id: string; supplier_invoice_id: string; allocated_amount: number | string };
type Data = { accounts: Account[]; mappings: Mapping[]; periods: Period[]; entries: Entry[]; lines: Line[]; profile: Profile | null; role: string; customerInvoices: CustomerInvoice[]; supplierInvoices: SupplierInvoice[]; suppliers: Supplier[]; customerBatches: AllocationBatch[]; supplierBatches: AllocationBatch[]; customerAllocations: CustomerAllocation[]; supplierAllocations: SupplierAllocation[] };
export type FinancialReportTab = "Ikhtisar" | "Laba rugi" | "Neraca" | "Buku Besar" | "Tutup Buku" | "PPN" | "Hutang & piutang";

const emptyData: Data = { accounts: [], mappings: [], periods: [], entries: [], lines: [], profile: null, role: "", customerInvoices: [], supplierInvoices: [], suppliers: [], customerBatches: [], supplierBatches: [], customerAllocations: [], supplierAllocations: [] };
const cash = (value: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value || 0)}`;
const normalBalance = (type: AccountType, debit: number, credit: number) => type === "asset" || type === "expense" ? debit - credit : credit - debit;
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dateText = (value: string) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
const accountTypeText: Record<AccountType, string> = { asset: "Aset", liability: "Liabilitas", equity: "Ekuitas", revenue: "Pendapatan", expense: "Beban" };
function overdueDays(asOf: string, dueDate: string | null) {
  if (!dueDate) return null;
  const [ay, am, ad] = asOf.slice(0, 10).split("-").map(Number);
  const [dy, dm, dd] = dueDate.slice(0, 10).split("-").map(Number);
  return Math.floor((Date.UTC(ay, am - 1, ad) - Date.UTC(dy, dm - 1, dd)) / 86400000);
}
function agingLabel(days: number | null) {
  if (days === null) return "Tanpa jatuh tempo";
  if (days <= 0) return "Belum jatuh tempo";
  if (days <= 30) return "Lewat 1–30 hari";
  if (days <= 60) return "Lewat 31–60 hari";
  if (days <= 90) return "Lewat 61–90 hari";
  return "Lewat >90 hari";
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

function errorText(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") return cause.message;
  return "Data laporan tidak dapat dimuat.";
}
function downloadCsv(headers: string[], rows: string[][]) {
  const csvCell = (value: string) => {
    const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const body = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `jena-medica-${headers[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${localToday()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FinancialReportManager({ tab }: { tab: FinancialReportTab }) {
  const [data, setData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(localToday);
  const [asOfDate, setAsOfDate] = useState(localToday);
  const [accountId, setAccountId] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      if (!isSupabaseConfigured()) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Masuk untuk melihat laporan keuangan.");
        const role = String(session.user.app_metadata?.business_role ?? "");
        if (!["owner", "admin", "viewer"].includes(role)) throw new Error("Akun ini belum memiliki role bisnis yang valid.");

        const [accountRows, mappingRows, profileResult, periodRows, entryRows, customerInvoices, supplierInvoices, suppliers, customerBatches, supplierBatches, customerAllocations, supplierAllocations] = await Promise.all([
          readPages<Account>((start, end) => supabase.from("chart_of_accounts").select("id,account_code,account_name,account_type,is_active").order("account_code").range(start, end)),
          readPages<Mapping>((start, end) => supabase.from("accounting_account_mappings").select("mapping_key,account_id").range(start, end)),
          supabase.from("accounting_posting_profile").select("status,approved_at").eq("singleton", true).maybeSingle(),
          readPages<Period>((start, end) => supabase.from("accounting_periods").select("id,period_start,period_end,status").order("period_start", { ascending: false }).range(start, end)),
          readPages<Entry>((start, end) => supabase.from("journal_entries").select("id,entry_number,source_type,source_id,entry_date,memo,total_debit,status,reversal_of_id").in("status", ["posted", "reversed"]).order("entry_date").order("entry_number").range(start, end)),
          readPages<CustomerInvoice>((start, end) => supabase.from("sales_invoices").select("id,invoice_number,issued_invoice_number,customer_name_snapshot,invoice_date,due_date,total_amount,tax_status,tax_code_snapshot,tax_base_amount,tax_rate_reported,tax_amount,tax_approval_reference,status").eq("status", "issued").order("invoice_date").range(start, end)),
          readPages<SupplierInvoice>((start, end) => supabase.from("supplier_invoices").select("id,supplier_id,supplier_invoice_number,invoice_date,due_date,invoice_total_reported,tax_amount_reported,tax_status,tax_rate_reported,input_tax_treatment,input_tax_review_reference,status").eq("status", "posted").order("invoice_date").range(start, end)),
          readPages<Supplier>((start, end) => supabase.from("suppliers").select("id,code,legal_name").order("legal_name").range(start, end)),
          readPages<AllocationBatch>((start, end) => supabase.from("customer_payment_allocation_batches").select("id,status,allocation_date").eq("status", "active").range(start, end)),
          readPages<AllocationBatch>((start, end) => supabase.from("supplier_payment_allocation_batches").select("id,status,allocation_date").eq("status", "active").range(start, end)),
          readPages<CustomerAllocation>((start, end) => supabase.from("customer_payment_allocations").select("batch_id,sales_invoice_id,allocated_amount").range(start, end)),
          readPages<SupplierAllocation>((start, end) => supabase.from("supplier_payment_allocations").select("batch_id,supplier_invoice_id,allocated_amount").range(start, end)),
        ]);
        if (profileResult.error) throw new Error(profileResult.error.message);
        const postedIds = entryRows.filter(entry => entry.status === "posted").map(entry => entry.id);
        const lineRows: Line[] = [];
        for (let offset = 0; offset < postedIds.length; offset += 100) {
          const ids = postedIds.slice(offset, offset + 100);
          lineRows.push(...await readPages<Line>((start, end) => supabase.from("journal_lines").select("id,journal_entry_id,line_number,account_id,description,debit,credit").in("journal_entry_id", ids).order("line_number").range(start, end)));
        }
        const orderedPeriods = periodRows.slice().sort((a, b) => a.period_start.localeCompare(b.period_start));
        const openPeriod = orderedPeriods.find(period => period.status === "open");
        const firstEntry = entryRows.find(entry => entry.status === "posted")?.entry_date ?? localToday();
        if (active) {
          setData({ accounts: accountRows, mappings: mappingRows, periods: orderedPeriods, entries: entryRows, lines: lineRows, profile: profileResult.data as Profile | null, role, customerInvoices, supplierInvoices, suppliers, customerBatches, supplierBatches, customerAllocations, supplierAllocations });
          setFromDate(openPeriod?.period_start ?? firstEntry.slice(0, 10));
          setToDate(localToday()); setAsOfDate(localToday());
        }
      } catch (cause) { if (active) setError(errorText(cause)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const accountById = useMemo(() => new Map(data.accounts.map(account => [account.id, account])), [data.accounts]);
  const entryById = useMemo(() => new Map(data.entries.map(entry => [entry.id, entry])), [data.entries]);
  const mappingByKey = useMemo(() => new Map(data.mappings.map(mapping => [mapping.mapping_key, mapping.account_id])), [data.mappings]);
  const activeEntries = useMemo(() => data.entries.filter(entry => entry.status === "posted"), [data.entries]);
  const postedSources = useMemo(() => new Set(activeEntries.map(entry => `${entry.source_type}:${entry.source_id}`)), [activeEntries]);
  const customerBatchById = useMemo(() => new Map(data.customerBatches.map(batch => [batch.id, batch])), [data.customerBatches]);
  const supplierBatchById = useMemo(() => new Map(data.supplierBatches.map(batch => [batch.id, batch])), [data.supplierBatches]);
  const supplierById = useMemo(() => new Map(data.suppliers.map(supplier => [supplier.id, supplier])), [data.suppliers]);
  const filteredEntries = useMemo(() => activeEntries.filter(entry => (!fromDate || entry.entry_date >= fromDate) && (!toDate || entry.entry_date <= toDate)), [activeEntries, fromDate, toDate]);
  const filteredIds = useMemo(() => new Set(filteredEntries.map(entry => entry.id)), [filteredEntries]);
  const filteredLines = useMemo(() => data.lines.filter(line => filteredIds.has(line.journal_entry_id)), [data.lines, filteredIds]);
  const asOfIds = useMemo(() => new Set(activeEntries.filter(entry => entry.entry_date <= asOfDate).map(entry => entry.id)), [activeEntries, asOfDate]);
  const asOfLines = useMemo(() => data.lines.filter(line => asOfIds.has(line.journal_entry_id)), [data.lines, asOfIds]);

  const reportBalances = useMemo(() => {
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of asOfLines) {
      const sum = totals.get(line.account_id) ?? { debit: 0, credit: 0 };
      sum.debit += Number(line.debit); sum.credit += Number(line.credit); totals.set(line.account_id, sum);
    }
    return data.accounts.map(account => {
      const sum = totals.get(account.id) ?? { debit: 0, credit: 0 };
      return { account, ...sum, balance: normalBalance(account.account_type, sum.debit, sum.credit) };
    });
  }, [asOfLines, data.accounts]);
  const pnl = useMemo(() => {
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of filteredLines) {
      const account = accountById.get(line.account_id);
      if (!account || !["revenue", "expense"].includes(account.account_type)) continue;
      const sum = totals.get(account.id) ?? { debit: 0, credit: 0 };
      sum.debit += Number(line.debit); sum.credit += Number(line.credit); totals.set(account.id, sum);
    }
    const rows = [...totals.entries()].map(([id, sum]) => {
      const account = accountById.get(id)!;
      return { account, balance: normalBalance(account.account_type, sum.debit, sum.credit) };
    }).sort((a, b) => a.account.account_code.localeCompare(b.account.account_code));
    const revenue = rows.filter(row => row.account.account_type === "revenue").reduce((sum, row) => sum + row.balance, 0);
    const expenses = rows.filter(row => row.account.account_type === "expense").reduce((sum, row) => sum + row.balance, 0);
    return { rows, revenue, expenses, net: revenue - expenses };
  }, [filteredLines, accountById]);
  const balanceSheet = useMemo(() => {
    const assets = reportBalances.filter(row => row.account.account_type === "asset" && Math.abs(row.balance) >= 0.005);
    const liabilities = reportBalances.filter(row => row.account.account_type === "liability" && Math.abs(row.balance) >= 0.005);
    const equity = reportBalances.filter(row => row.account.account_type === "equity" && Math.abs(row.balance) >= 0.005);
    const pnlToDate = reportBalances.filter(row => ["revenue", "expense"].includes(row.account.account_type)).reduce((sum, row) => sum + row.balance, 0);
    const assetTotal = assets.reduce((sum, row) => sum + row.balance, 0);
    const liabilityTotal = liabilities.reduce((sum, row) => sum + row.balance, 0);
    const equityTotal = equity.reduce((sum, row) => sum + row.balance, 0) + pnlToDate;
    return { assets, liabilities, equity, pnlToDate, assetTotal, liabilityTotal, equityTotal, difference: assetTotal - liabilityTotal - equityTotal };
  }, [reportBalances]);
  const currentPeriod = data.periods.find(period => period.status === "open");
  const reportEntryCount = tab === "Neraca" || tab === "Hutang & piutang" ? activeEntries.filter(entry => entry.entry_date <= asOfDate).length : filteredEntries.length;
  const arAccount = mappingByKey.get("accounts_receivable");
  const apAccount = mappingByKey.get("accounts_payable");
  const vatOutputAccount = mappingByKey.get("vat_output");
  const vatInputAccount = mappingByKey.get("vat_input");
  const arBalance = reportBalances.find(row => row.account.id === arAccount)?.balance ?? 0;
  const apBalance = reportBalances.find(row => row.account.id === apAccount)?.balance ?? 0;
  const vatOutput = filteredLines.filter(line => line.account_id === vatOutputAccount).reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);
  const vatInput = filteredLines.filter(line => line.account_id === vatInputAccount).reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
  const validCustomerTaxDocs = data.customerInvoices.filter(invoice => invoice.invoice_date >= fromDate && invoice.invoice_date <= toDate && postedSources.has(`customer_invoice:${invoice.id}`));
  const validSupplierTaxDocs = data.supplierInvoices.filter(invoice => invoice.invoice_date >= fromDate && invoice.invoice_date <= toDate && postedSources.has(`supplier_invoice:${invoice.id}`));
  const documentVatOutput = validCustomerTaxDocs.reduce((sum, invoice) => sum + Number(invoice.tax_amount), 0);
  const documentVatInput = validSupplierTaxDocs.filter(invoice => invoice.input_tax_treatment === "recoverable").reduce((sum, invoice) => sum + Number(invoice.tax_amount_reported), 0);
  const customerOutstanding = data.customerInvoices.filter(invoice => invoice.invoice_date <= asOfDate && postedSources.has(`customer_invoice:${invoice.id}`)).map(invoice => {
    const allocated = data.customerAllocations.filter(row => row.sales_invoice_id === invoice.id).reduce((sum, row) => {
      const batch = customerBatchById.get(row.batch_id);
      return batch && batch.allocation_date <= asOfDate && postedSources.has(`customer_allocation:${batch.id}`) ? sum + Number(row.allocated_amount) : sum;
    }, 0);
    const balance = Number(invoice.total_amount) - allocated;
    return { invoice, balance, overdue: overdueDays(asOfDate, invoice.due_date) };
  }).filter(row => row.balance > 0.005).sort((a, b) => (a.invoice.due_date ?? "9999-12-31").localeCompare(b.invoice.due_date ?? "9999-12-31"));
  const supplierOutstanding = data.supplierInvoices.filter(invoice => invoice.invoice_date <= asOfDate && postedSources.has(`supplier_invoice:${invoice.id}`)).map(invoice => {
    const allocated = data.supplierAllocations.filter(row => row.supplier_invoice_id === invoice.id).reduce((sum, row) => {
      const batch = supplierBatchById.get(row.batch_id);
      return batch && batch.allocation_date <= asOfDate && postedSources.has(`supplier_allocation:${batch.id}`) ? sum + Number(row.allocated_amount) : sum;
    }, 0);
    const balance = Number(invoice.invoice_total_reported) - allocated;
    return { invoice, balance, overdue: overdueDays(asOfDate, invoice.due_date) };
  }).filter(row => row.balance > 0.005).sort((a, b) => (a.invoice.due_date ?? "9999-12-31").localeCompare(b.invoice.due_date ?? "9999-12-31"));
  const documentArBalance = customerOutstanding.reduce((sum, row) => sum + row.balance, 0);
  const documentApBalance = supplierOutstanding.reduce((sum, row) => sum + row.balance, 0);
  const ledgerLines = useMemo(() => {
    const selected = data.lines.filter(line => line.account_id === accountId || accountId === "all");
    const joined = selected.map(line => ({ line, entry: entryById.get(line.journal_entry_id), account: accountById.get(line.account_id) })).filter((row): row is { line: Line; entry: Entry; account: Account } => Boolean(row.entry && row.account && row.entry.status === "posted" && (!fromDate || row.entry.entry_date >= fromDate) && (!toDate || row.entry.entry_date <= toDate))).sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date) || a.entry.entry_number.localeCompare(b.entry.entry_number) || a.line.line_number - b.line.line_number);
    const openingBalance = accountId === "all" ? 0 : data.lines.filter(line => line.account_id === accountId).reduce((sum, line) => {
        const entry = entryById.get(line.journal_entry_id); const account = accountById.get(line.account_id);
        return entry && account && entry.status === "posted" && fromDate && entry.entry_date < fromDate ? sum + normalBalance(account.account_type, Number(line.debit), Number(line.credit)) : sum;
      }, 0);
    return joined.reduce<{ rows: (typeof joined[number] & { running: number })[]; balance: number }>((state, row) => {
      const balance = state.balance + normalBalance(row.account.account_type, Number(row.line.debit), Number(row.line.credit));
      return { rows: [...state.rows, { ...row, running: balance }], balance };
    }, { rows: [], balance: openingBalance }).rows;
  }, [data.lines, accountId, entryById, accountById, fromDate, toDate]);

  if (loading) return <div className="mt-5 card card-pad text-sm text-[var(--muted)]">Memuat laporan dari jurnal posted…</div>;
  if (error) return <div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</div>;

  return <div className="mt-5 space-y-4">
    {tab !== "Neraca" && tab !== "Tutup Buku" && tab !== "Hutang & piutang" && <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <label className="field-label">Dari tanggal<input className="field-input mt-1" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label>
      <label className="field-label">Sampai tanggal<input className="field-input mt-1" type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label>
      <span className="text-xs text-[var(--muted)]">Sumber: jurnal berstatus posted dalam rentang tanggal.</span>
    </div>}
    {fromDate && toDate && fromDate > toDate && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Tanggal awal harus sama dengan atau sebelum tanggal akhir.</p>}

    {tab === "Ikhtisar" && <Overview data={data} currentPeriod={currentPeriod} pnl={pnl} balanceSheet={balanceSheet} postedCount={filteredEntries.length} />}
    {tab === "Laba rugi" && <section className="card card-pad space-y-4">
      <div><h3 className="font-semibold">Laporan laba rugi</h3><p className="mt-1 text-xs text-[var(--muted)]">Periode {dateText(fromDate)}–{dateText(toDate)} · hanya akun pendapatan dan beban dari jurnal posted.</p></div>
      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Pendapatan" value={cash(pnl.revenue)} /><Metric label="Beban tercatat" value={cash(pnl.expenses)} /><Metric label="Laba / (rugi)" value={cash(pnl.net)} /></div>
      <ReportTable headers={["Kode akun", "Nama akun", "Klasifikasi", "Saldo periode"]} rows={pnl.rows.map(row => [row.account.account_code, row.account.account_name, accountTypeText[row.account.account_type], cash(row.balance)])} empty="Belum ada jurnal pendapatan atau beban pada rentang ini." />
      <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--muted)]">Biaya supplier di akun clearing (akun aset) tidak dihitung sebagai HPP. HPP belum direklasifikasi otomatis; jangan anggap angka laba sebagai laporan final sebelum kebijakan HPP diselesaikan.</p>
    </section>}
    {tab === "Neraca" && <section className="card card-pad space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Neraca</h3><p className="mt-1 text-xs text-[var(--muted)]">Saldo kumulatif jurnal posted sampai tanggal yang dipilih; tanpa saldo awal.</p></div><label className="field-label">Per tanggal<input className="field-input mt-1" type="date" value={asOfDate} onChange={event => setAsOfDate(event.target.value)} /></label></div>
      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Total aset" value={cash(balanceSheet.assetTotal)} /><Metric label="Total kewajiban" value={cash(balanceSheet.liabilityTotal)} /><Metric label="Ekuitas termasuk laba kumulatif" value={cash(balanceSheet.equityTotal)} /></div>
      <div className="grid gap-4 lg:grid-cols-2"><BalanceGroup title="Aset" rows={balanceSheet.assets} /><div className="space-y-4"><BalanceGroup title="Liabilitas" rows={balanceSheet.liabilities} /><BalanceGroup title="Ekuitas" rows={balanceSheet.equity} extra={balanceSheet.pnlToDate ? ["Laba / (rugi) kumulatif sejak jurnal awal", balanceSheet.pnlToDate] as const : undefined} /></div></div>
      <p className={`rounded-lg p-3 text-xs ${Math.abs(balanceSheet.difference) < 0.01 ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>{Math.abs(balanceSheet.difference) < 0.01 ? "Seimbang: aset = liabilitas + ekuitas." : `Belum seimbang: selisih ${cash(balanceSheet.difference)}. Periksa jurnal dan saldo awal; jangan gunakan laporan ini sebagai laporan final.`}</p>
    </section>}
    {tab === "Buku Besar" && <section className="card card-pad space-y-4">
      <div><h3 className="font-semibold">Buku besar</h3><p className="mt-1 text-xs text-[var(--muted)]">Mutasi per akun dari jurnal posted, diurutkan kronologis. Saldo berjalan ditampilkan bila satu akun dipilih.</p></div>
      <label className="field-label max-w-xl">Akun<select className="field-input mt-1" value={accountId} onChange={event => setAccountId(event.target.value)}><option value="all">Semua akun</option>{data.accounts.map(account => <option key={account.id} value={account.id}>{account.account_code} · {account.account_name}</option>)}</select></label>
      <ReportTable headers={["Tanggal", "No. jurnal", "Akun", "Keterangan", "Debit", "Kredit", ...(accountId === "all" ? [] : ["Saldo berjalan"])]} rows={ledgerLines.map(row => [dateText(row.entry.entry_date), row.entry.entry_number, `${row.account.account_code} · ${row.account.account_name}`, row.line.description, cash(Number(row.line.debit)), cash(Number(row.line.credit)), ...(accountId === "all" ? [] : [cash(row.running)])])} empty="Tidak ada mutasi posted untuk akun dan rentang tanggal ini." />
    </section>}
    {tab === "PPN" && <section className="card card-pad space-y-4">
      <div><h3 className="font-semibold">Ringkasan dan dokumen PPN</h3><p className="mt-1 text-xs text-[var(--muted)]">Mutasi ledger posted {dateText(fromDate)}–{dateText(toDate)} dibandingkan dokumen pajak yang sudah diterbitkan/diposting.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="PPN keluaran · ledger" value={cash(vatOutput)} /><Metric label="PPN keluaran · dokumen" value={cash(documentVatOutput)} /><Metric label="PPN masukan recoverable · ledger" value={cash(vatInput)} /><Metric label="PPN masukan recoverable · dokumen" value={cash(documentVatInput)} /></div>
      {Math.abs(vatOutput - documentVatOutput) >= 0.01 || Math.abs(vatInput - documentVatInput) >= 0.01 ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Jumlah dokumen dan akun kontrol berbeda. Periksa tanggal dokumen/jurnal, reversal, dan klasifikasi pajak sebelum menggunakan angka.</p> : null}
      <h4 className="font-medium">PPN keluaran · invoice pelanggan</h4>
      <ReportTable headers={["Tanggal", "Invoice", "Pelanggan", "Perlakuan", "Kode pajak", "DPP tercatat", "Tarif", "PPN", "Referensi"]} rows={validCustomerTaxDocs.map(invoice => [dateText(invoice.invoice_date), invoice.issued_invoice_number ?? invoice.invoice_number, invoice.customer_name_snapshot, invoice.tax_status, invoice.tax_code_snapshot ?? "—", invoice.tax_base_amount === null ? "—" : cash(Number(invoice.tax_base_amount)), invoice.tax_rate_reported === null ? "—" : `${Number(invoice.tax_rate_reported)}%`, cash(Number(invoice.tax_amount)), invoice.tax_approval_reference ?? "—"])} empty="Tidak ada invoice pelanggan bertanggal dalam rentang ini yang memiliki jurnal posted." />
      <h4 className="font-medium">PPN masukan · faktur supplier</h4>
      <ReportTable headers={["Tanggal", "Faktur", "Supplier", "Status pajak", "Perlakuan input", "Tarif dokumen", "PPN dokumen", "Dikreditkan", "Referensi review"]} rows={validSupplierTaxDocs.map(invoice => [dateText(invoice.invoice_date), invoice.supplier_invoice_number, supplierById.get(invoice.supplier_id)?.legal_name ?? invoice.supplier_id.slice(0, 8), invoice.tax_status, invoice.input_tax_treatment, invoice.tax_rate_reported === null ? "—" : `${Number(invoice.tax_rate_reported)}%`, cash(Number(invoice.tax_amount_reported)), invoice.input_tax_treatment === "recoverable" ? cash(Number(invoice.tax_amount_reported)) : cash(0), invoice.input_tax_review_reference ?? "—"])} empty="Tidak ada faktur supplier bertanggal dalam rentang ini yang memiliki jurnal posted." />
      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Ini laporan buku internal, bukan SPT atau e-Faktur. Tarif/DPP tidak dihitung otomatis. DPP supplier tidak direka dari total faktur; klasifikasi dan referensi tetap mengikuti dokumen serta keputusan pajak yang disetujui.</p>
    </section>}
    {tab === "Hutang & piutang" && <section className="card card-pad space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Umur piutang dan hutang terbuka</h3><p className="mt-1 text-xs text-[var(--muted)]">Invoice diterbitkan/diposting, dikurangi alokasi aktif yang jurnalnya sudah posted, per tanggal laporan.</p></div><label className="field-label">Per tanggal<input className="field-input mt-1" type="date" value={asOfDate} onChange={event => setAsOfDate(event.target.value)} /></label></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Piutang terbuka · dokumen" value={cash(documentArBalance)} /><Metric label="Saldo kontrol AR · ledger" value={cash(arBalance)} /><Metric label="Hutang terbuka · dokumen" value={cash(documentApBalance)} /><Metric label="Saldo kontrol AP · ledger" value={cash(apBalance)} /></div>
      {Math.abs(documentArBalance - arBalance) >= 0.01 || Math.abs(documentApBalance - apBalance) >= 0.01 ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Subledger faktur dan akun kontrol berbeda. Periksa alokasi, advance, reversal, dan akun mapping sebelum rekonsiliasi.</p> : null}
      <h4 className="font-medium">Piutang pelanggan</h4>
      <ReportTable headers={["Tanggal", "Pelanggan", "Invoice", "Jatuh tempo", "Umur", "Sisa piutang"]} rows={customerOutstanding.map(row => [dateText(row.invoice.invoice_date), row.invoice.customer_name_snapshot, row.invoice.issued_invoice_number ?? row.invoice.invoice_number, dateText(row.invoice.due_date ?? ""), agingLabel(row.overdue), cash(row.balance)])} empty="Tidak ada invoice pelanggan dengan saldo terbuka dan jurnal AR posted pada tanggal ini." />
      <h4 className="font-medium">Hutang supplier</h4>
      <ReportTable headers={["Tanggal", "Supplier", "Faktur", "Jatuh tempo", "Umur", "Sisa hutang"]} rows={supplierOutstanding.map(row => [dateText(row.invoice.invoice_date), supplierById.get(row.invoice.supplier_id)?.legal_name ?? row.invoice.supplier_id.slice(0, 8), row.invoice.supplier_invoice_number, dateText(row.invoice.due_date ?? ""), agingLabel(row.overdue), cash(row.balance)])} empty="Tidak ada faktur supplier dengan saldo terbuka dan jurnal AP posted pada tanggal ini." />
      <div className="flex flex-wrap gap-2"><Link className="tab-button" href="/invoice-pelanggan">Buka invoice pelanggan</Link><Link className="tab-button" href="/pembayaran">Buka pembayaran & alokasi</Link><Link className="tab-button" href="/operasional#invoices">Buka faktur supplier</Link></div>
      <p className="text-xs leading-5 text-[var(--muted)]">Alokasi draft/void atau alokasi tanpa jurnal tidak mengurangi saldo; invoice tanpa tanggal jatuh tempo ditandai “Tanpa jatuh tempo”. Payment advance yang belum dialokasikan muncul pada akun uang muka, bukan sebagai pengurang invoice.</p>
    </section>}
    {tab === "Tutup Buku" && <CloseBook data={data} currentPeriod={currentPeriod} />}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]"><span>{reportEntryCount} jurnal posted sesuai tanggal laporan · profil {data.profile?.status ?? "belum tersedia"} · {data.periods.filter(period => period.status === "open").length} periode terbuka</span><span>Untuk pembukuan internal; bukan pengganti review akuntan atau pelaporan pajak.</span></div>
  </div>;
}

function Overview({ data, currentPeriod, pnl, balanceSheet, postedCount }: { data: Data; currentPeriod?: Period; pnl: { revenue: number; expenses: number; net: number }; balanceSheet: { assetTotal: number; liabilityTotal: number; equityTotal: number }; postedCount: number }) {
  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Jurnal posted" value={String(postedCount)} /><Metric label="Pendapatan periode" value={cash(pnl.revenue)} /><Metric label="Laba / (rugi) periode" value={cash(pnl.net)} /><Metric label="Aset bersih ledger" value={cash(balanceSheet.assetTotal - balanceSheet.liabilityTotal)} /></div>
    <div className="card card-pad"><h3 className="font-semibold">Kesiapan pembukuan</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><Metric label="Profil posting" value={data.profile?.status === "approved" ? "Disetujui" : "Belum disetujui"} /><Metric label="Mapping akun" value={`${data.mappings.length}/10`} /><Metric label="Periode terbuka" value={currentPeriod ? `${dateText(currentPeriod.period_start)}–${dateText(currentPeriod.period_end)}` : "Tidak ada"} /></div></div>
    <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--muted)]">Angka berasal dari ledger posted saja. Tidak ada saldo awal sesuai setup saat ini. HPP supplier di akun clearing belum dihitung sebagai beban sampai direklasifikasi sesuai kebijakan.</p>
  </section>;
}

function CloseBook({ data, currentPeriod }: { data: Data; currentPeriod?: Period }) {
  return <section className="card card-pad space-y-4">
    <div><h3 className="font-semibold">Periode akuntansi dan kesiapan tutup buku</h3><p className="mt-1 text-xs text-[var(--muted)]">Status periode di bawah ini berasal dari database. Perintah buka/tutup periode tersedia di tab Jurnal umum dan divalidasi oleh RPC database.</p></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Periode terbuka" value={String(data.periods.filter(period => period.status === "open").length)} /><Metric label="Jurnal posted dalam periode aktif" value={String(currentPeriod ? data.entries.filter(entry => entry.status === "posted" && entry.entry_date >= currentPeriod.period_start && entry.entry_date <= currentPeriod.period_end).length : 0)} /><Metric label="Status profil" value={data.profile?.status === "approved" ? "Disetujui" : "Draft / terkunci"} /></div>
    {data.periods.length ? <ReportTable headers={["Mulai", "Sampai", "Status"]} rows={data.periods.map(period => [dateText(period.period_start), dateText(period.period_end), period.status === "open" ? "Terbuka" : period.status === "closed" ? "Ditutup" : "Draft"])} empty="Belum ada periode akuntansi." /> : <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm">Belum ada periode. Buat periode pertama melalui tab Jurnal umum.</p>}
    <Link className="primary-button inline-flex" href="/keuangan#jurnal">Kelola periode di Jurnal umum</Link>
    <p className="text-xs leading-5 text-[var(--muted)]">Sebelum menutup buku, lakukan rekonsiliasi bank, pastikan seluruh invoice/pembayaran diposting, review PPN dan HPP, serta simpan backup terverifikasi. Jangan tutup periode untuk sekadar mengisi laporan.</p>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>; }
function BalanceGroup({ title, rows, extra }: { title: string; rows: { account: Account; balance: number }[]; extra?: readonly [string, number] }) {
  const total = rows.reduce((sum, row) => sum + row.balance, 0) + (extra?.[1] ?? 0);
  return <div className="overflow-hidden rounded-xl border border-[var(--border)]"><h4 className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold">{title}</h4><div className="divide-y divide-[var(--border)]">{rows.map(row => <div key={row.account.id} className="flex justify-between gap-3 px-3 py-2 text-sm"><span>{row.account.account_code} · {row.account.account_name}</span><span className="shrink-0 tabular-nums">{cash(row.balance)}</span></div>)}{extra && <div className="flex justify-between gap-3 px-3 py-2 text-sm"><span>{extra[0]}</span><span className="shrink-0 tabular-nums">{cash(extra[1])}</span></div>}{!rows.length && !extra && <p className="p-3 text-xs text-[var(--muted)]">Tidak ada saldo pada tanggal ini.</p>}<div className="flex justify-between bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold"><span>Total {title.toLowerCase()}</span><span className="tabular-nums">{cash(total)}</span></div></div></div>;
}
function ReportTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{empty}</p>;
  return <div className="space-y-2"><div className="flex justify-end"><button type="button" className="tab-button" onClick={() => downloadCsv(headers, rows)}>Unduh CSV</button></div><div className="overflow-x-auto rounded-lg border border-[var(--border)]"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[var(--surface-muted)]"><tr>{headers.map((header, index) => <th className="whitespace-nowrap px-3 py-2 font-medium" key={`${header}-${index}`}>{header}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, colIndex) => <td className={`px-3 py-2 ${colIndex > 3 ? "whitespace-nowrap text-right tabular-nums" : ""}`} key={`${rowIndex}-${colIndex}`}>{value}</td>)}</tr>)}</tbody></table></div></div>;
}
