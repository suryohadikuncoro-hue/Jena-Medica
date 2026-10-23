"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Direction = "customer" | "supplier";
type PaymentMethod = "bank_transfer" | "cash" | "check" | "card" | "other";
type Party = { id: string; code: string; legal_name: string };
type Payment = {
  id: string; payment_number: string; payment_date: string; amount: number | string;
  payment_method: PaymentMethod; external_reference: string | null; notes: string | null;
  status: "recorded" | "void"; void_reason: string | null; created_at: string;
  customer_id?: string; supplier_id?: string;
};
type BillingDocument = {
  id: string; invoice_number?: string; supplier_invoice_number?: string; invoice_date: string;
  due_date: string | null; total_amount?: number | string; invoice_total_reported?: number | string;
  currency_code?: string; status: string; customer_id?: string; supplier_id?: string;
};
type AllocationBatch = { id: string; payment_id: string; status: "active" | "void"; void_reason: string | null; created_at: string };
type Allocation = { id: string; batch_id: string; sales_invoice_id?: string; supplier_invoice_id?: string; allocated_amount: number | string };
type PaymentDraft = { party_id: string; payment_date: string; amount: string; payment_method: PaymentMethod; external_reference: string; notes: string };
type AllocationDraft = { row_id: string; invoice_id: string; amount: string };
type VoidTarget = { kind: "payment" | "allocation"; id: string };

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Transfer bank" },
  { value: "cash", label: "Tunai" },
  { value: "check", label: "Cek" },
  { value: "card", label: "Kartu" },
  { value: "other", label: "Lainnya" },
];
const methodLabel = (method: PaymentMethod) => METHODS.find(item => item.value === method)?.label ?? "Lainnya";
const money = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
function localDate() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function blankPayment(): PaymentDraft {
  return { party_id: "", payment_date: localDate(), amount: "", payment_method: "bank_transfer", external_reference: "", notes: "" };
}
function validMoney(value: number) {
  return Number.isFinite(value) && value > 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
const itemId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
type PageResult<T> = { data: T[] | null; error: { message: string } | null };
async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const pageSize = 500;
  const maximumRows = 50_000;
  const rows: T[] = [];
  for (let from = 0; from < maximumRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const current = data ?? [];
    rows.push(...current);
    if (current.length < pageSize) return rows;
  }
  throw new Error("Histori melebihi batas aman tampilan. Perlu penyaringan atau pagination sebelum modul dapat digunakan.");
}
function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "object" && cause !== null && "message" in cause) return String(cause.message);
  return fallback;
}

export function PaymentManager() {
  const [direction, setDirection] = useState<Direction>("customer");
  const [parties, setParties] = useState<Party[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [batches, setBatches] = useState<AllocationBatch[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(blankPayment);
  const [paymentKey, setPaymentKey] = useState("");
  const [paymentAttempted, setPaymentAttempted] = useState(false);
  const [allocationPayment, setAllocationPayment] = useState<Payment | null>(null);
  const [allocationRows, setAllocationRows] = useState<AllocationDraft[]>([]);
  const [allocationKey, setAllocationKey] = useState("");
  const [allocationAttempted, setAllocationAttempted] = useState(false);
  const [voidTarget, setVoidTarget] = useState<VoidTarget | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const canWrite = role === "owner" || role === "admin";
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    setLoading(true); setError(""); setSchemaReady(false);
    setParties([]); setPayments([]); setDocuments([]); setBatches([]); setAllocations([]);
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRole(""); setParties([]); setPayments([]); setDocuments([]); setBatches([]); setAllocations([]);
        setError("Masuk untuk melihat pembayaran."); setLoading(false); return;
      }
      const businessRole = String(session.user.app_metadata?.business_role ?? "");
      setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) throw new Error("Akun belum memiliki role bisnis yang valid.");
      const isCustomer = direction === "customer";
      const [partyRows, paymentRows, documentRows, batchRows, allocationRows] = await Promise.all([
        isCustomer
          ? fetchAllRows((from, to) => supabase.from("customers").select("id,code,legal_name").order("legal_name").order("id").range(from, to))
          : fetchAllRows((from, to) => supabase.from("suppliers").select("id,code,legal_name").order("legal_name").order("id").range(from, to)),
        isCustomer
          ? fetchAllRows((from, to) => supabase.from("customer_payments").select("id,payment_number,customer_id,payment_date,amount,payment_method,external_reference,notes,status,void_reason,created_at").order("payment_date", { ascending: false }).order("id", { ascending: false }).range(from, to))
          : fetchAllRows((from, to) => supabase.from("supplier_payments").select("id,payment_number,supplier_id,payment_date,amount,payment_method,external_reference,notes,status,void_reason,created_at").order("payment_date", { ascending: false }).order("id", { ascending: false }).range(from, to)),
        isCustomer
          ? fetchAllRows((from, to) => supabase.from("sales_invoices").select("id,invoice_number,customer_id,invoice_date,due_date,total_amount,currency_code,status").order("invoice_date", { ascending: false }).order("id", { ascending: false }).range(from, to))
          : fetchAllRows((from, to) => supabase.from("supplier_invoices").select("id,supplier_invoice_number,supplier_id,invoice_date,due_date,invoice_total_reported,status").order("invoice_date", { ascending: false }).order("id", { ascending: false }).range(from, to)),
        isCustomer
          ? fetchAllRows((from, to) => supabase.from("customer_payment_allocation_batches").select("id,payment_id,status,void_reason,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to))
          : fetchAllRows((from, to) => supabase.from("supplier_payment_allocation_batches").select("id,payment_id,status,void_reason,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
        isCustomer
          ? fetchAllRows((from, to) => supabase.from("customer_payment_allocations").select("id,batch_id,sales_invoice_id,allocated_amount").order("id").range(from, to))
          : fetchAllRows((from, to) => supabase.from("supplier_payment_allocations").select("id,batch_id,supplier_invoice_id,allocated_amount").order("id").range(from, to)),
      ]);
      setParties(partyRows as Party[]);
      setPayments(paymentRows as Payment[]);
      setDocuments(documentRows as BillingDocument[]);
      setBatches(batchRows as AllocationBatch[]);
      setAllocations(allocationRows as Allocation[]);
      setSchemaReady(true);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "";
      const paymentSchemaMissing = /customer_payments|supplier_payments|payment_allocation|schema cache|does not exist/i.test(detail);
      setSchemaReady(false);
      setError(paymentSchemaMissing
        ? "Skema pembayaran belum diterapkan pada Supabase. Terapkan migration pembayaran di environment ini sebelum memakai modul; tidak ada pembayaran yang dimuat atau diubah."
        : detail || "Gagal memuat pembayaran dan alokasi.");
    } finally { setLoading(false); }
  }, [configured, direction]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  const partyById = useMemo(() => new Map(parties.map(party => [party.id, party])), [parties]);
  const paymentById = useMemo(() => new Map(payments.map(payment => [payment.id, payment])), [payments]);
  const batchById = useMemo(() => new Map(batches.map(batch => [batch.id, batch])), [batches]);

  function documentId(allocation: Allocation) { return direction === "customer" ? allocation.sales_invoice_id : allocation.supplier_invoice_id; }
  function partyId(payment: Payment) { return direction === "customer" ? payment.customer_id : payment.supplier_id; }
  function documentPartyId(document: BillingDocument) { return direction === "customer" ? document.customer_id : document.supplier_id; }
  function documentNumber(document: BillingDocument) { return direction === "customer" ? document.invoice_number : document.supplier_invoice_number; }
  function documentTotal(document: BillingDocument) { return Number(direction === "customer" ? document.total_amount : document.invoice_total_reported) || 0; }
  function requiredDocumentStatus() { return direction === "customer" ? "issued" : "posted"; }
  function documentDisplayStatus() { return direction === "customer" ? "invoice terbit" : "faktur diposting"; }

  const appliedByPayment = useMemo(() => {
    const totals = new Map<string, number>();
    for (const allocation of allocations) {
      const batch = batchById.get(allocation.batch_id);
      const payment = batch ? paymentById.get(batch.payment_id) : undefined;
      if (!batch || batch.status !== "active" || payment?.status !== "recorded") continue;
      totals.set(batch.payment_id, (totals.get(batch.payment_id) ?? 0) + Number(allocation.allocated_amount));
    }
    return totals;
  }, [allocations, batchById, paymentById]);

  const appliedByDocument = useMemo(() => {
    const totals = new Map<string, number>();
    for (const allocation of allocations) {
      const batch = batchById.get(allocation.batch_id);
      const payment = batch ? paymentById.get(batch.payment_id) : undefined;
      const id = documentId(allocation);
      if (!id || !batch || batch.status !== "active" || payment?.status !== "recorded") continue;
      totals.set(id, (totals.get(id) ?? 0) + Number(allocation.allocated_amount));
    }
    return totals;
  // documentId uses the current tab; direction changes cause a remount of this calculation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocations, batchById, paymentById, direction]);

  const eligibleDocuments = (forPayment: Payment) => documents.filter(document =>
    document.status === requiredDocumentStatus() && documentPartyId(document) === partyId(forPayment) &&
    documentTotal(document) - (appliedByDocument.get(document.id) ?? 0) > 0
  );
  const activePayments = payments.filter(payment => payment.status === "recorded");
  const unappliedAmount = activePayments.reduce((total, payment) => total + Math.max(0, Number(payment.amount) - (appliedByPayment.get(payment.id) ?? 0)), 0);
  const recordedAmount = activePayments.reduce((total, payment) => total + Number(payment.amount), 0);
  const visiblePayments = payments.filter(payment => {
    const party = partyById.get(partyId(payment) ?? "");
    return `${payment.payment_number} ${party?.code ?? ""} ${party?.legal_name ?? ""} ${payment.external_reference ?? ""}`.toLowerCase().includes(search.toLowerCase());
  });

  function openPaymentForm() {
    setPaymentDraft(blankPayment()); setPaymentKey(itemId()); setPaymentAttempted(false);
    setShowPaymentForm(true); setError(""); setNotice("");
  }
  function closePaymentForm() {
    setShowPaymentForm(false); setPaymentDraft(blankPayment()); setPaymentKey(""); setPaymentAttempted(false);
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const amount = Number(paymentDraft.amount);
    if (!canWrite) { setError("Role Owner/Admin diperlukan untuk mencatat pembayaran."); return; }
    if (!paymentDraft.party_id) { setError(direction === "customer" ? "Pilih pelanggan." : "Pilih supplier."); return; }
    if (!paymentDraft.payment_date) { setError("Tanggal pembayaran wajib diisi."); return; }
    if (!validMoney(amount)) { setError("Nominal harus lebih dari 0 dan maksimal dua angka desimal."); return; }
    if (!paymentKey) { setError("Kunci transaksi tidak tersedia. Tutup lalu buka kembali formulir."); return; }
    setPaymentAttempted(true);
    setSaving(true);
    try {
      const functionName = direction === "customer" ? "record_customer_payment" : "record_supplier_payment";
      const payload = {
        p_idempotency_key: paymentKey,
        ...(direction === "customer" ? { p_customer_id: paymentDraft.party_id } : { p_supplier_id: paymentDraft.party_id }),
        p_payment_date: paymentDraft.payment_date,
        p_amount: amount,
        p_payment_method: paymentDraft.payment_method,
        p_external_reference: paymentDraft.external_reference.trim() || null,
        p_notes: paymentDraft.notes.trim() || null,
      };
      const { data: paymentId, error: rpcError } = await getSupabaseBrowserClient().rpc(functionName, payload);
      if (rpcError) { setPaymentAttempted(false); setPaymentKey(itemId()); throw rpcError; }
      let journalWarning = "";
      if (direction === "supplier") {
        try {
          if (!paymentId) throw new Error("ID pembayaran tidak dikembalikan database.");
          const { error: journalError } = await getSupabaseBrowserClient().rpc("post_supplier_payment_journal", { p_payment_id: paymentId });
          if (journalError) throw journalError;
        } catch {
          journalWarning = " Pembayaran sudah tercatat, tetapi jurnal belum terbentuk karena konfigurasi akuntansi/periode/metode pembayaran belum siap. Buka Keuangan untuk menyelesaikan posting.";
        }
      }
      closePaymentForm();
      setNotice(direction === "customer"
        ? "Penerimaan tersimpan sebagai kas/uang muka pelanggan. Jurnal penerimaan pelanggan tetap mengikuti alur posting Keuangan."
        : `Pembayaran supplier tersimpan.${journalWarning || " Jurnal pembayaran berhasil dibuat otomatis."}`);
      await load();
    } catch (cause) { setError(errorMessage(cause, "Pembayaran tidak dapat disimpan.")); }
    finally { setSaving(false); }
  }

  function beginAllocation(payment: Payment) {
    setAllocationPayment(payment); setAllocationRows([{ row_id: itemId(), invoice_id: "", amount: "" }]);
    setAllocationKey(itemId()); setAllocationAttempted(false); setError(""); setNotice("");
  }
  function closeAllocation() {
    setAllocationPayment(null); setAllocationRows([]); setAllocationKey(""); setAllocationAttempted(false);
  }
  function updateAllocationRow(rowId: string, key: "invoice_id" | "amount", value: string) {
    setAllocationRows(rows => rows.map(row => row.row_id === rowId ? { ...row, [key]: value } : row));
  }
  function allocationDocumentOptions(rowId: string) {
    if (!allocationPayment) return [];
    const selectedByOtherRows = new Set(allocationRows.filter(row => row.row_id !== rowId).map(row => row.invoice_id).filter(Boolean));
    return eligibleDocuments(allocationPayment).filter(document => !selectedByOtherRows.has(document.id));
  }
  const allocationAvailable = allocationPayment ? Math.max(0, Number(allocationPayment.amount) - (appliedByPayment.get(allocationPayment.id) ?? 0)) : 0;
  const proposedAllocationTotal = allocationRows.reduce((total, row) => total + (Number(row.amount) || 0), 0);
  const allocationPayloadValid = Boolean(allocationPayment && allocationRows.length > 0 && allocationRows.every(row => {
    const amount = Number(row.amount);
    return row.invoice_id && validMoney(amount);
  }) && new Set(allocationRows.map(row => row.invoice_id)).size === allocationRows.length && proposedAllocationTotal <= allocationAvailable);

  async function saveAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!canWrite || !allocationPayment) { setError("Role Owner/Admin dan pembayaran tercatat diperlukan."); return; }
    if (!allocationPayloadValid) { setError("Periksa dokumen, nominal dua desimal, dan total alokasi yang tersedia."); return; }
    setAllocationAttempted(true);
    setSaving(true);
    try {
      const functionName = direction === "customer" ? "allocate_customer_payment" : "allocate_supplier_payment";
      const payload = {
        p_payment_id: allocationPayment.id,
        p_idempotency_key: allocationKey,
        p_allocations: allocationRows.map(row => ({ invoice_id: row.invoice_id, amount: Number(row.amount) })),
      };
      const { data: batchId, error: rpcError } = await getSupabaseBrowserClient().rpc(functionName, payload);
      if (rpcError) { setAllocationAttempted(false); setAllocationKey(itemId()); throw rpcError; }
      let journalWarning = "";
      if (direction === "supplier") {
        try {
          if (!batchId) throw new Error("ID batch alokasi tidak dikembalikan database.");
          const { error: journalError } = await getSupabaseBrowserClient().rpc("post_supplier_allocation_journal", { p_batch_id: batchId });
          if (journalError) throw journalError;
        } catch {
          journalWarning = " Alokasi tersimpan, tetapi jurnal pelunasan belum terbentuk karena konfigurasi akuntansi/periode belum siap. Buka Keuangan untuk menyelesaikan posting.";
        }
      }
      closeAllocation();
      setNotice(direction === "supplier"
        ? `Alokasi pembayaran supplier tersimpan.${journalWarning || " Jurnal alokasi berhasil dibuat otomatis."}`
        : "Alokasi pembayaran pelanggan tersimpan. Jurnal alokasi tetap mengikuti alur posting Keuangan.");
      await load();
    } catch (cause) { setError(errorMessage(cause, "Alokasi tidak dapat disimpan.")); }
    finally { setSaving(false); }
  }

  async function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!voidTarget || voidReason.trim().length < 3) { setError("Alasan pembatalan minimal 3 karakter."); return; }
    setSaving(true);
    try {
      const functionName = voidTarget.kind === "payment"
        ? direction === "customer" ? "void_customer_payment" : "void_supplier_payment"
        : direction === "customer" ? "void_customer_payment_allocation_batch" : "void_supplier_payment_allocation_batch";
      const idParam = voidTarget.kind === "payment" ? "p_payment_id" : "p_batch_id";
      const { error: rpcError } = await getSupabaseBrowserClient().rpc(functionName, { [idParam]: voidTarget.id, p_reason: voidReason.trim() });
      if (rpcError) throw rpcError;
      setVoidTarget(null); setVoidReason("");
      setNotice(voidTarget.kind === "payment"
        ? "Pembayaran ditandai void dengan jejak audit. Void bukan bukti refund atau pembalikan bank."
        : "Batch alokasi dibatalkan dengan jejak audit; dana kembali menjadi saldo belum teralokasi.");
      await load();
    } catch (cause) { setError(errorMessage(cause, "Pembatalan tidak dapat disimpan.")); }
    finally { setSaving(false); }
  }

  function changeDirection(next: Direction) {
    if (next === direction) return;
    setDirection(next); setSearch(""); closePaymentForm(); closeAllocation(); setVoidTarget(null); setError(""); setNotice("");
  }

  return <section>
    <div className="demo-banner mb-5"><strong>Pencatatan operasional saja.</strong> Catat hanya dana yang sudah terverifikasi. Pembayaran yang belum dapat dialokasikan tetap menjadi uang muka; alokasi baru dibuka untuk invoice pelanggan berstatus <code>issued</code> atau faktur supplier berstatus <code>posted</code>. Fitur ini belum memposting AP/AR, jurnal, pajak, atau rekonsiliasi bank.</div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Jenis pembayaran">
      <button disabled={saving || showPaymentForm || Boolean(allocationPayment) || paymentAttempted || allocationAttempted} type="button" role="tab" aria-selected={direction === "customer"} className="tab-button" onClick={() => changeDirection("customer")}>Penerimaan pelanggan</button>
      <button disabled={saving || showPaymentForm || Boolean(allocationPayment) || paymentAttempted || allocationAttempted} type="button" role="tab" aria-selected={direction === "supplier"} className="tab-button" onClick={() => changeDirection("supplier")}>Pembayaran supplier</button>
    </div>

    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><p className="page-kicker">{direction === "customer" ? "Kas masuk · belum menjadi posting AR" : "Kas keluar · belum menjadi posting AP"}</p><h2 className="mt-1 text-lg font-semibold">{direction === "customer" ? "Penerimaan pelanggan" : "Pembayaran supplier"}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">Pembayaran dicatat manual setelah dana terverifikasi. Pembayaran parsial dan satu pembayaran untuk beberapa invoice didukung setelah dokumen terkait diposting.</p></div>
      {canWrite && schemaReady && !showPaymentForm && <button type="button" className="primary-button" onClick={openPaymentForm}>＋ Catat {direction === "customer" ? "Penerimaan" : "Pembayaran"}</button>}
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Kpi label="Pembayaran tercatat" value={loading ? "…" : String(activePayments.length)} detail="Status recorded" />
      <Kpi label="Nilai dana tercatat" value={loading ? "…" : money(recordedAmount)} detail="Tidak sama dengan saldo GL" />
      <Kpi label="Belum teralokasi / uang muka" value={loading ? "…" : money(unappliedAmount)} detail="Akan dikurangi setelah dokumen posted" />
    </div>

    {showPaymentForm && <form className="card card-pad mb-5" onSubmit={savePayment}>
      <div className="mb-4"><h3 className="font-semibold">Catat dana yang sudah diterima/dibayar</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Catatan ini menyimpan transaksi kas/bank aktual. Belum memilih rekening buku besar dan belum membuat jurnal.</p></div>
      <fieldset disabled={saving || paymentAttempted} className="grid gap-4 border-0 p-0 md:grid-cols-2 xl:grid-cols-3">
        <label className="field-label">{direction === "customer" ? "Pelanggan" : "Supplier"}<select required className="field-input" value={paymentDraft.party_id} onChange={event => setPaymentDraft(value => ({ ...value, party_id: event.target.value }))}><option value="">Pilih {direction === "customer" ? "pelanggan" : "supplier"}</option>{parties.map(party => <option key={party.id} value={party.id}>{party.code} · {party.legal_name}</option>)}</select></label>
        <label className="field-label">Tanggal dana diterima/dibayar<input required type="date" className="field-input" value={paymentDraft.payment_date} onChange={event => setPaymentDraft(value => ({ ...value, payment_date: event.target.value }))} /></label>
        <label className="field-label">Nominal (IDR)<input required min="0.01" step="0.01" inputMode="decimal" type="number" className="field-input" value={paymentDraft.amount} onChange={event => setPaymentDraft(value => ({ ...value, amount: event.target.value }))} placeholder="0" /></label>
        <label className="field-label">Metode<select required className="field-input" value={paymentDraft.payment_method} onChange={event => setPaymentDraft(value => ({ ...value, payment_method: event.target.value as PaymentMethod }))}>{METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
        <label className="field-label">Referensi eksternal (opsional)<input maxLength={200} className="field-input" value={paymentDraft.external_reference} onChange={event => setPaymentDraft(value => ({ ...value, external_reference: event.target.value }))} placeholder="No. transfer / bukti" /></label>
        <label className="field-label">Catatan (opsional)<input maxLength={1000} className="field-input" value={paymentDraft.notes} onChange={event => setPaymentDraft(value => ({ ...value, notes: event.target.value }))} placeholder="Keterangan" /></label>
      </fieldset>
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button disabled={saving || paymentAttempted} type="button" className="tab-button" onClick={closePaymentForm}>Batal</button><button disabled={saving || !canWrite} className="primary-button" type="submit">{saving ? "Menyimpan…" : paymentAttempted ? "Ulangi permintaan aman" : "Simpan pembayaran"}</button></div>
    </form>}

    {allocationPayment && <form className="card card-pad mb-5 border border-[var(--accent)]" onSubmit={saveAllocation}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="page-kicker">Alokasi hanya ke dokumen posted</p><h3 className="font-semibold">Alokasikan {allocationPayment.payment_number}</h3><p className="mt-1 text-sm text-[var(--muted)]">Tersedia {money(allocationAvailable)} · {partyById.get(partyId(allocationPayment) ?? "")?.legal_name ?? ""}</p></div><button disabled={saving || allocationAttempted} type="button" className="tab-button" onClick={closeAllocation}>Tutup</button></div>
      {eligibleDocuments(allocationPayment).length === 0 ? <p className="rounded-xl bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">Belum ada {documentDisplayStatus()} untuk pihak ini. Draft tidak bisa menerima alokasi; dana tetap sebagai uang muka.</p> : <>
        <div className="space-y-3">{allocationRows.map((row, index) => {
          const options = allocationDocumentOptions(row.row_id);
          const selected = documents.find(document => document.id === row.invoice_id);
          const remaining = selected ? Math.max(0, documentTotal(selected) - (appliedByDocument.get(selected.id) ?? 0)) : 0;
          return <div key={row.row_id} className="grid gap-3 rounded-xl border border-[var(--border)] p-3 md:grid-cols-[1fr_220px_auto]">
            <label className="field-label">Dokumen alokasi {index + 1}<select disabled={saving || allocationAttempted} className="field-input" value={row.invoice_id} onChange={event => updateAllocationRow(row.row_id, "invoice_id", event.target.value)}><option value="">Pilih dokumen posted</option>{options.map(document => <option key={document.id} value={document.id}>{documentNumber(document)} · sisa {money(documentTotal(document) - (appliedByDocument.get(document.id) ?? 0))} · jatuh tempo {document.due_date ?? "—"}</option>)}</select>{selected && <span className="mt-1 block text-[11px] text-[var(--muted)]">Sisa dokumen: {money(remaining)}</span>}</label>
            <label className="field-label">Nominal alokasi<input disabled={saving || allocationAttempted} required min="0.01" max={Math.min(remaining, allocationAvailable)} step="0.01" type="number" inputMode="decimal" className="field-input" value={row.amount} onChange={event => updateAllocationRow(row.row_id, "amount", event.target.value)} placeholder="0" /></label>
            <button disabled={saving || allocationAttempted || allocationRows.length === 1} type="button" className="tab-button self-end" onClick={() => setAllocationRows(rows => rows.filter(item => item.row_id !== row.row_id))}>Hapus</button>
          </div>;
        })}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button disabled={saving || allocationAttempted} type="button" className="tab-button" onClick={() => setAllocationRows(rows => [...rows, { row_id: itemId(), invoice_id: "", amount: "" }])}>＋ Tambah invoice</button><p className={`text-sm ${proposedAllocationTotal > allocationAvailable ? "text-red-700" : "text-[var(--muted)]"}`}>Total alokasi: {money(proposedAllocationTotal)} / {money(allocationAvailable)}</p></div>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Alokasi batch bersifat atomik dan idempoten. Setelah upaya pertama, payload dikunci; jika terjadi timeout, kirim ulang payload yang sama. Error RPC yang pasti akan membuka kembali form untuk koreksi.</p>
        <div className="mt-4 flex justify-end"><button disabled={saving || !canWrite || !allocationPayloadValid} className="primary-button" type="submit">{saving ? "Menyimpan…" : allocationAttempted ? "Ulangi permintaan aman" : "Simpan alokasi"}</button></div>
      </>}
    </form>}

    {voidTarget && <form className="card card-pad mb-5 border border-amber-300" onSubmit={submitVoid}>
      <h3 className="font-semibold">{voidTarget.kind === "payment" ? "Void pembayaran" : "Batalkan batch alokasi"}</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Aksi akan menyimpan alasan dan pengguna. Void pembayaran bukan bukti refund; void alokasi mengembalikan dana ke saldo belum dialokasikan.</p>
      <label className="field-label mt-3">Alasan<textarea required minLength={3} maxLength={1000} rows={2} className="field-input" value={voidReason} onChange={event => setVoidReason(event.target.value)} /></label>
      <div className="mt-3 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => { setVoidTarget(null); setVoidReason(""); }}>Batal</button><button disabled={saving || voidReason.trim().length < 3} type="submit" className="primary-button">{saving ? "Menyimpan…" : "Konfirmasi void"}</button></div>
    </form>}

    <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Riwayat pembayaran</h3><p className="mt-1 text-xs text-[var(--muted)]">{payments.length} catatan · allocation tersedia setelah dokumen posted</p></div><label className="field-label min-w-56">Cari<input className="field-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nomor, pihak, referensi" /></label></div>
    {loading ? <div className="card card-pad text-sm text-[var(--muted)]">Memuat pembayaran…</div> : error && payments.length === 0 ? <div className="card card-pad text-sm text-[var(--muted)]">Belum dapat menampilkan catatan pembayaran.</div> : visiblePayments.length === 0 ? <div className="card card-pad text-sm text-[var(--muted)]">Belum ada pembayaran tercatat. Saldo demo tidak ditampilkan.</div> : <div className="space-y-3">{visiblePayments.map(payment => {
      const party = partyById.get(partyId(payment) ?? "");
      const applied = appliedByPayment.get(payment.id) ?? 0;
      const available = payment.status === "recorded" ? Math.max(0, Number(payment.amount) - applied) : 0;
      const canAllocate = canWrite && !showPaymentForm && !allocationPayment && !voidTarget && payment.status === "recorded" && available > 0 && eligibleDocuments(payment).length > 0;
      const paymentBatches = batches.filter(batch => batch.payment_id === payment.id);
      const allocationsByBatch = (batchId: string) => allocations.filter(allocation => allocation.batch_id === batchId);
      return <article key={payment.id} className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{payment.payment_number}</h4><span className="status-pill">{payment.status === "recorded" ? "Tercatat" : "Void"}</span></div><p className="mt-1 text-sm">{party?.legal_name ?? "Pihak tidak diketahui"} · {payment.payment_date} · {methodLabel(payment.payment_method)}</p><p className="mt-1 text-xs text-[var(--muted)]">{payment.external_reference ? `Referensi: ${payment.external_reference}` : "Tanpa referensi eksternal"}{payment.notes ? ` · ${payment.notes}` : ""}</p>{payment.status === "void" && <p className="mt-1 text-xs text-amber-800">Void: {payment.void_reason}</p>}</div>
          <div className="text-right"><p className="font-semibold tabular-nums">{money(payment.amount)}</p><p className="mt-1 text-xs text-[var(--muted)]">Dialokasikan {money(applied)} · belum dialokasikan {money(available)}</p></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{canAllocate && <button type="button" className="tab-button" onClick={() => beginAllocation(payment)}>Alokasikan ke dokumen posted</button>}{canWrite && payment.status === "recorded" && !showPaymentForm && !allocationPayment && !voidTarget && <button type="button" className="tab-button" onClick={() => { setVoidTarget({ kind: "payment", id: payment.id }); setVoidReason(""); }}>Void pembayaran</button>}{payment.status === "recorded" && available > 0 && !canAllocate && <span className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]">Belum ada {documentDisplayStatus()} yang eligible; dana tercatat sebagai uang muka.</span>}</div>
        {paymentBatches.length > 0 && <details className="mt-3 border-t border-[var(--border)] pt-3"><summary className="cursor-pointer text-xs font-semibold">Riwayat alokasi ({paymentBatches.length})</summary><div className="mt-3 space-y-2">{paymentBatches.map(batch => <div key={batch.id} className="rounded-xl bg-[var(--surface-muted)] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs font-semibold">Batch {batch.id.slice(0, 8)} · {batch.status === "active" ? "Aktif" : "Void"}</p>{batch.status === "active" && canWrite && !showPaymentForm && !allocationPayment && !voidTarget && <button type="button" className="text-xs font-semibold text-amber-800 underline" onClick={() => { setVoidTarget({ kind: "allocation", id: batch.id }); setVoidReason(""); }}>Batalkan batch</button>}</div>{allocationsByBatch(batch.id).map(allocation => {
            const document = documents.find(item => item.id === documentId(allocation));
            return <p key={allocation.id} className="mt-1 text-xs text-[var(--muted)]">{document ? documentNumber(document) : "Dokumen"} · {money(allocation.allocated_amount)}</p>;
          })}{batch.status === "void" && <p className="mt-1 text-xs text-amber-800">Alasan: {batch.void_reason}</p>}</div>)}</div></details>}
      </article>;
    })}</div>}
    <p className="mt-4 text-xs leading-5 text-[var(--muted-soft)]">{canWrite ? "Owner/Admin dapat mencatat dan membatalkan dengan alasan; Viewer hanya baca." : "Akun tidak memiliki izin tulis pembayaran. Pembukuan, rekening bank, bukti privat, dan jurnal berada di luar modul ini."} Dokumen dan pembayaran tetap tersimpan sebagai jejak operasional; belum merupakan laporan AR/AP atau buku besar.</p>
  </section>;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-lg font-bold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-[var(--muted-soft)]">{detail}</p></div>;
}
