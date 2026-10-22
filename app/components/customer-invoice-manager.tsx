"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/error-message";

type InvoiceStatus = "draft" | "issued" | "void";
type Customer = { id: string; code: string; legal_name: string; phone: string | null };
type SalesOrder = {
  id: string; order_number: string; customer_id: string; order_date: string;
  due_date: string; payment_terms_days_snapshot: number; ship_to_address_snapshot: string;
  status: "draft" | "confirmed" | "cancelled"; total_amount: number | string;
};
type SalesOrderLine = {
  id: string; sales_order_id: string; line_number: number; product_code_snapshot: string;
  product_name_snapshot: string; unit_snapshot: string; quantity: number | string;
  unit_price_snapshot: number | string; line_total: number | string;
  customer_product_price_id: string | null; price_overridden: boolean;
};
type CustomerInvoice = {
  id: string; invoice_number: string; sales_order_id: string; customer_id: string;
  invoice_date: string; due_date: string; currency_code: string;
  customer_code_snapshot: string; customer_name_snapshot: string;
  customer_phone_snapshot: string | null; ship_to_address_snapshot: string;
  subtotal_amount: number | string; total_amount: number | string; tax_amount: number | string;
  tax_status: string; issued_invoice_number: string | null; status: InvoiceStatus;
  notes: string | null; void_reason: string | null; created_at: string;
};
type CustomerInvoiceLine = {
  id: string; sales_invoice_id: string; line_number: number; sales_order_line_id: string;
  customer_product_price_id: string | null; price_overridden: boolean; product_code_snapshot: string;
  product_name_snapshot: string; unit_snapshot: string; quantity: number | string;
  unit_price_snapshot: number | string; line_total: number | string;
};

const money = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
function localDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function whatsappNumber(value: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("62") && digits.length >= 9 && digits.length <= 15) return digits;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 14) return `62${digits.slice(1)}`;
  return "";
}

export function CustomerInvoiceManager() {
  const configured = isSupabaseConfigured();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [orderLines, setOrderLines] = useState<SalesOrderLine[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<CustomerInvoiceLine[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [editingInvoiceId, setEditingInvoiceId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({});
  const [voidReason, setVoidReason] = useState("");
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidSaving, setVoidSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRole(""); setCustomers([]); setSalesOrders([]); setOrderLines([]); setInvoices([]); setInvoiceLines([]);
        setError("Masuk untuk melihat invoice pelanggan."); setLoading(false); return;
      }
      const businessRole = String(session.user.app_metadata?.business_role ?? "");
      setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) {
        setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata."); setLoading(false); return;
      }
      const results = await Promise.all([
        supabase.from("customers").select("id,code,legal_name,phone").limit(1000),
        supabase.from("sales_orders").select("id,order_number,customer_id,order_date,due_date,payment_terms_days_snapshot,ship_to_address_snapshot,status,total_amount").order("order_date", { ascending: false }).limit(1000),
        supabase.from("sales_order_lines").select("id,sales_order_id,line_number,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,unit_price_snapshot,line_total,customer_product_price_id,price_overridden").order("line_number").limit(4000),
        supabase.from("sales_invoices").select("id,invoice_number,sales_order_id,customer_id,invoice_date,due_date,currency_code,customer_code_snapshot,customer_name_snapshot,customer_phone_snapshot,ship_to_address_snapshot,subtotal_amount,total_amount,tax_amount,tax_status,issued_invoice_number,status,notes,void_reason,created_at").order("invoice_date", { ascending: false }).limit(1000),
        supabase.from("sales_invoice_lines").select("id,sales_invoice_id,line_number,sales_order_line_id,customer_product_price_id,price_overridden,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,unit_price_snapshot,line_total").order("line_number").limit(4000),
      ]);
      for (const result of results) if (result.error) throw result.error;
      setCustomers((results[0].data ?? []) as Customer[]);
      setSalesOrders((results[1].data ?? []) as SalesOrder[]);
      setOrderLines((results[2].data ?? []) as SalesOrderLine[]);
      setInvoices((results[3].data ?? []) as CustomerInvoice[]);
      setInvoiceLines((results[4].data ?? []) as CustomerInvoiceLine[]);
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Gagal memuat invoice pelanggan dari Supabase."));
    } finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  const customerById = useMemo(() => new Map(customers.map(row => [row.id, row])), [customers]);
  const salesOrderById = useMemo(() => new Map(salesOrders.map(row => [row.id, row])), [salesOrders]);
  const linesByInvoice = useMemo(() => {
    const grouped = new Map<string, CustomerInvoiceLine[]>();
    for (const line of invoiceLines) grouped.set(line.sales_invoice_id, [...(grouped.get(line.sales_invoice_id) ?? []), line]);
    return grouped;
  }, [invoiceLines]);
  const invoicedQuantityByOrderLine = useMemo(() => {
    const totals = new Map<string, number>();
    const activeInvoiceIds = new Set(invoices.filter(row => row.status !== "void").map(row => row.id));
    for (const line of invoiceLines) {
      if (activeInvoiceIds.has(line.sales_invoice_id)) {
        totals.set(line.sales_order_line_id, (totals.get(line.sales_order_line_id) ?? 0) + Number(line.quantity));
      }
    }
    return totals;
  }, [invoices, invoiceLines]);
  const selectedOrder = salesOrders.find(row => row.id === salesOrderId);
  const selectedOrderLines = orderLines.filter(line => line.sales_order_id === salesOrderId);
  const editingLineQuantities = new Map((editingInvoiceId ? invoiceLines.filter(line => line.sales_invoice_id === editingInvoiceId) : []).map(line => [line.sales_order_line_id, Number(line.quantity)]));
  const availableOrderLines = selectedOrderLines.map(line => ({
    ...line, available: Math.max(0, Number(line.quantity) - (invoicedQuantityByOrderLine.get(line.id) ?? 0) + (editingLineQuantities.get(line.id) ?? 0)),
  })).filter(line => line.available > 0);
  const visibleInvoices = invoices.filter(row => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    const order = salesOrderById.get(row.sales_order_id);
    return `${row.invoice_number} ${row.customer_name_snapshot} ${order?.order_number ?? ""}`.toLowerCase().includes(query.toLowerCase());
  });
  const selectedInvoice = visibleInvoices.find(row => row.id === selectedInvoiceId) ?? visibleInvoices[0] ?? null;
  const selectedInvoiceOrder = selectedInvoice ? salesOrderById.get(selectedInvoice.sales_order_id) : undefined;
  const selectedInvoiceLines = selectedInvoice ? linesByInvoice.get(selectedInvoice.id) ?? [] : [];
  const invoiceNumber = selectedInvoice ? (selectedInvoice.issued_invoice_number ?? selectedInvoice.invoice_number) : "";
  const phone = whatsappNumber(selectedInvoice?.customer_phone_snapshot ?? null);
  const whatsappText = selectedInvoice
    ? selectedInvoice.status === "issued"
      ? `Halo ${selectedInvoice.customer_name_snapshot}, invoice ${invoiceNumber} untuk pesanan ${selectedInvoiceOrder?.order_number ?? ""} telah diterbitkan. Total ${money(selectedInvoice.total_amount)}. Jatuh tempo: ${displayDate(selectedInvoice.due_date)}. Ini invoice komersial, bukan Faktur Pajak.`
      : `Halo ${selectedInvoice.customer_name_snapshot}, ${selectedInvoice.status === "void" ? "dokumen invoice " + selectedInvoice.invoice_number + " telah dibatalkan." : "draf invoice " + selectedInvoice.invoice_number + " untuk pesanan " + (selectedInvoiceOrder?.order_number ?? "") + " telah disiapkan."} Nilai sementara ${money(selectedInvoice.total_amount)}; PPN belum dihitung dan dokumen ini belum final. Jatuh tempo: ${displayDate(selectedInvoice.due_date)}.`
    : "";
  const whatsappHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}` : "";

  function openCreateForm() {
    setError(""); setNotice(""); setEditingInvoiceId(""); setShowForm(true); setSalesOrderId(""); setInvoiceDate(localDate()); setNotes(""); setLineQuantities({});
  }

  function openEditDraft() {
    if (!selectedInvoice || selectedInvoice.status !== "draft") return;
    setError(""); setNotice(""); setEditingInvoiceId(selectedInvoice.id); setShowForm(true);
    setSalesOrderId(selectedInvoice.sales_order_id); setInvoiceDate(selectedInvoice.invoice_date);
    setNotes(selectedInvoice.notes ?? "");
    setLineQuantities(Object.fromEntries((linesByInvoice.get(selectedInvoice.id) ?? []).map(line => [line.sales_order_line_id, String(line.quantity)])));
    setShowVoidForm(false);
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk membuat invoice.");
      if (!selectedOrder || selectedOrder.status !== "confirmed") throw new Error("Pilih SO yang sudah terkonfirmasi.");
      if (!invoiceDate) throw new Error("Tanggal invoice wajib diisi.");
      const selectedLines = availableOrderLines
        .filter(line => lineQuantities[line.id]?.trim())
        .map(line => ({ sales_order_line_id: line.id, quantity: Number(lineQuantities[line.id]) }));
      if (selectedLines.length === 0) throw new Error("Masukkan kuantitas minimal satu baris.");
      if (selectedLines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0)) throw new Error("Kuantitas invoice harus lebih dari nol.");
      const lineById = new Map(availableOrderLines.map(line => [line.id, line]));
      if (selectedLines.some(line => line.quantity > (lineById.get(line.sales_order_line_id)?.available ?? 0))) {
        throw new Error("Kuantitas invoice melebihi sisa kuantitas SO.");
      }
      const supabase = getSupabaseBrowserClient();
      const { data, error: rpcError } = editingInvoiceId
        ? await supabase.rpc("update_customer_invoice_draft", { p_customer_invoice_id: editingInvoiceId, p_invoice_date: invoiceDate, p_notes: notes, p_lines: selectedLines })
        : await supabase.rpc("create_customer_invoice", { p_sales_order_id: selectedOrder.id, p_invoice_date: invoiceDate, p_notes: notes, p_lines: selectedLines });
      if (rpcError) throw rpcError;
      setShowForm(false); setSelectedInvoiceId(String(data ?? editingInvoiceId)); setEditingInvoiceId("");
      setNotice("Draf invoice tersimpan. Belum diterbitkan atau dibukukan.");
      await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal membuat invoice pelanggan.")); }
    finally { setSaving(false); }
  }

  async function voidInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice) return;
    setError(""); setNotice(""); setVoidSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk membatalkan draft invoice.");
      if (voidReason.trim().length < 3) throw new Error("Alasan pembatalan minimal 3 karakter.");
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("void_customer_invoice", {
        p_customer_invoice_id: selectedInvoice.id, p_reason: voidReason.trim(),
      });
      if (rpcError) throw rpcError;
      setShowVoidForm(false); setVoidReason("");
      setNotice(`Draft ${selectedInvoice.invoice_number} dibatalkan dan tetap tersimpan untuk jejak audit.`);
      await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal membatalkan draft invoice.")); }
    finally { setVoidSaving(false); }
  }

  return <main className="page-wrap customer-invoice-screen">
    <div className="screen-only mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="page-kicker">Transaksi · Penagihan</p><h1 className="page-title">Invoice pelanggan</h1><p className="page-description">Draf dibuat otomatis saat SO dikonfirmasi. Tinjau kuantitas dan detail sebelum menerbitkan; satu SO dapat ditagih beberapa kali.</p></div>
      {canWrite && <button className="primary-button" type="button" onClick={openCreateForm}>＋ Buat invoice</button>}
    </div>
    <div className="screen-only demo-banner mb-5"><strong>Aturan penagihan:</strong> draf dibuat otomatis saat SO dikonfirmasi. Draf bukan invoice final, Faktur Pajak/e-Faktur, atau jurnal. Pendapatan dan piutang baru diakui saat invoice diterbitkan melalui workflow akuntansi yang disetujui.</div>
    {error && <p role="alert" className="screen-only mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="screen-only mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    {showForm && <form className="screen-only card card-pad mb-5 customer-invoice-form" onSubmit={createInvoice}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{editingInvoiceId ? "Tinjau dan edit draf invoice" : "Buat invoice dari pesanan"}</h2><p className="mt-1 text-xs text-[var(--muted)]">Atur kuantitas yang akan ditagihkan. Draf tidak mengakui pendapatan/piutang; batas kumulatif dijaga database.</p></div><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--muted)]">Pesanan terkonfirmasi<select required className="field mt-1" value={salesOrderId} onChange={event => { setSalesOrderId(event.target.value); setLineQuantities({}); }}><option value="">Pilih SO…</option>{salesOrders.filter(row => row.status === "confirmed" && (!invoices.some(invoice => invoice.sales_order_id === row.id && invoice.status === "draft") || row.id === salesOrderId)).map(row => <option key={row.id} value={row.id}>{row.order_number} · {customerById.get(row.customer_id)?.legal_name ?? "Pelanggan"} · {money(row.total_amount)}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Tanggal invoice<input required className="field mt-1" type="date" value={invoiceDate} onChange={event => setInvoiceDate(event.target.value)} /></label></div>
      {selectedOrder && <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3 text-sm"><strong>{customerById.get(selectedOrder.customer_id)?.legal_name ?? "Pelanggan"}</strong><p className="mt-1 text-xs text-[var(--muted)]">SO {selectedOrder.order_number} · tanggal {displayDate(selectedOrder.order_date)} · jatuh tempo SO {displayDate(selectedOrder.due_date)}</p><p className="mt-1 text-xs text-[var(--muted)]">{selectedOrder.ship_to_address_snapshot}</p></div>}
      {selectedOrder && <div className="mt-4 space-y-2">{availableOrderLines.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Semua kuantitas pada SO ini sudah ditagihkan.</p> : availableOrderLines.map(line => <div key={line.id} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[2fr_1fr_1fr_1fr] sm:items-center"><div><p className="font-medium">{line.product_name_snapshot}</p><p className="text-xs text-[var(--muted)]">{line.product_code_snapshot} · {line.unit_snapshot}</p></div><div className="text-xs"><p className="text-[var(--muted)]">Harga/unit</p><strong>{money(line.unit_price_snapshot)}</strong></div><div className="text-xs"><p className="text-[var(--muted)]">Sisa yang bisa ditagih</p><strong>{line.available.toLocaleString("id-ID")} {line.unit_snapshot}</strong></div><label className="text-xs text-[var(--muted)]">Qty invoice<input className="field mt-1" type="number" min="0" max={line.available} step="0.0001" value={lineQuantities[line.id] ?? ""} onChange={event => setLineQuantities(current => ({ ...current, [line.id]: event.target.value }))} /></label></div>)}</div>}
      <label className="mt-3 block text-xs text-[var(--muted)]">Catatan internal<textarea className="field mt-1 min-h-20 py-2" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan opsional" /></label>
      <div className="mt-4 flex justify-end"><button type="submit" className="primary-button" disabled={saving || !selectedOrder || availableOrderLines.length === 0}>{saving ? "Menyimpan…" : editingInvoiceId ? "Simpan perubahan draf" : "Simpan draft invoice"}</button></div>
    </form>}

    <section className="screen-only mb-5 grid gap-3 sm:grid-cols-3">
      <Kpi label="Draft aktif" value={String(invoices.filter(row => row.status === "draft").length)} />
      <Kpi label="Invoice terbit" value={String(invoices.filter(row => row.status === "issued").length)} />
      <Kpi label="Total draft · sebelum pajak" value={money(invoices.filter(row => row.status === "draft").reduce((sum, row) => sum + Number(row.total_amount), 0))} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
      <div className="screen-only card card-pad customer-invoice-list">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar invoice</h2><p className="mt-1 text-xs text-[var(--muted)]">{invoices.length} dokumen dari Supabase</p></div><input className="field max-w-52" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari invoice/SO…" aria-label="Cari invoice pelanggan" /></div>
        <div className="customer-invoice-tabs" role="group" aria-label="Filter status invoice">{([{ value: "all", label: "Semua" }, { value: "draft", label: "Draft" }, { value: "issued", label: "Terbit" }, { value: "void", label: "Batal" }] as const).map(tab => <button key={tab.value} type="button" aria-pressed={statusFilter === tab.value} onClick={() => setStatusFilter(tab.value)}>{tab.label}</button>)}</div>
        {loading ? <p className="py-6 text-sm text-[var(--muted)]">Memuat invoice…</p> : visibleInvoices.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center"><p className="font-medium">Belum ada invoice</p><p className="mt-1 text-xs text-[var(--muted)]">Pilih SO terkonfirmasi untuk membuat draft invoice.</p></div> : <div className="space-y-2">{visibleInvoices.map(row => {
          const order = salesOrderById.get(row.sales_order_id);
          return <button key={row.id} type="button" onClick={() => { setSelectedInvoiceId(row.id); setShowVoidForm(false); }} className={`w-full rounded-xl border p-3 text-left ${selectedInvoice?.id === row.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-muted)]"}`}>
            <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.invoice_number}</p><h3 className="mt-1 text-sm font-semibold">{row.customer_name_snapshot}</h3></div><span className="status-pill">{row.status === "draft" ? "Draft" : row.status === "issued" ? "Terbit · dibukukan" : "Dibatalkan"}</span></div>
            <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-[var(--muted)]"><span>{order?.order_number ?? "SO"} · {displayDate(row.invoice_date)}</span><strong className="text-[var(--foreground)]">{money(row.total_amount)}</strong></div>
          </button>;
        })}</div>}
      </div>

      {selectedInvoice ? <article id="invoice-print" className="print-document card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div><p className="page-kicker">Jena Medical Center</p><h2 className="mt-1 text-xl font-bold">Invoice Penjualan</h2><p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${selectedInvoice.status === "draft" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-800"}`}>{selectedInvoice.status === "draft" ? "DRAFT · BELUM DITERBITKAN" : selectedInvoice.status === "issued" ? "TERBIT · AR POSTED" : "DIBATALKAN"}</p></div>
          <div className="text-left sm:text-right"><p className="text-xs text-[var(--muted)]">Nomor dokumen</p><p className="mt-1 font-mono text-sm font-semibold">{invoiceNumber}</p><p className="mt-2 text-xs text-[var(--muted)]">Tanggal {displayDate(selectedInvoice.invoice_date)}</p><p className="text-xs text-[var(--muted)]">Jatuh tempo {displayDate(selectedInvoice.due_date)}</p></div>
        </div>
        <div className="my-4 grid gap-4 sm:grid-cols-2"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Pelanggan</p><p className="mt-1 font-semibold">{selectedInvoice.customer_name_snapshot}</p><p className="text-xs text-[var(--muted)]">{selectedInvoice.customer_code_snapshot}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Pesanan</p><p className="mt-1 font-semibold">{selectedInvoiceOrder?.order_number ?? "—"}</p><p className="text-xs text-[var(--muted)]">SO tanggal {displayDate(selectedInvoiceOrder?.order_date)}</p></div></div>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">{selectedInvoice.status === "issued" ? <><strong>Invoice komersial telah diterbitkan dan AR dibukukan.</strong> Nilai pajak mengikuti keputusan manual yang disetujui; dokumen ini bukan Faktur Pajak/e-Faktur.</> : selectedInvoice.status === "draft" ? <><strong>Dokumen draft, bukan tagihan final atau Faktur Pajak.</strong> Nilai belum termasuk pajak dan belum dibukukan.</> : <><strong>Dokumen dibatalkan.</strong> Dokumen tersimpan sebagai jejak audit.</>}</div>
        <div className="mb-4 rounded-lg bg-[var(--surface-muted)] p-3 text-xs"><p className="font-semibold">Alamat pelanggan</p><p className="mt-1">{selectedInvoice.ship_to_address_snapshot}</p></div>
        <InvoiceItemTable lines={selectedInvoiceLines} />
        <div className="ml-auto mt-4 max-w-sm space-y-2 border-t border-[var(--border)] pt-3 text-sm"><div className="flex justify-between"><span>Subtotal setelah diskon</span><strong>{money(selectedInvoice.subtotal_amount)}</strong></div>{selectedInvoice.status === "issued" && <div className="flex justify-between"><span>PPN sesuai keputusan</span><strong>{money(selectedInvoice.tax_amount)}</strong></div>}<div className="flex justify-between text-base font-bold"><span>{selectedInvoice.status === "issued" ? "Total invoice" : "Total sementara · sebelum pajak"}</span><strong>{money(selectedInvoice.total_amount)}</strong></div></div>
        {selectedInvoice.notes && <p className="mt-4 text-xs text-[var(--muted)]">Catatan: {selectedInvoice.notes}</p>}
        {selectedInvoice.status === "void" && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-700">Alasan pembatalan: {selectedInvoice.void_reason}</p>}
        <div className="mt-6 border-t border-[var(--border)] pt-3 text-[10px] leading-5 text-[var(--muted)]"><p>{selectedInvoice.status === "issued" ? "Invoice komersial ini dibukukan ke piutang. Nilai PPN dicatat manual sesuai keputusan pajak; bukan Faktur Pajak/e-Faktur." : "Pratinjau draft internal. Belum diterbitkan dan belum dibukukan. Gunakan workflow issue & posting setelah kebijakan serta periode disetujui."}</p></div>
      </article> : <div className="screen-only card card-pad flex min-h-80 items-center justify-center text-center"><div><h2 className="font-semibold">Pilih invoice untuk pratinjau</h2><p className="mt-1 text-sm text-[var(--muted)]">PDF dapat disimpan melalui fungsi cetak browser.</p></div></div>}
    </section>

    {selectedInvoice && <div className="screen-only mt-4 flex flex-wrap gap-2">
      {canWrite && selectedInvoice.status === "draft" && <button type="button" className="primary-button" onClick={openEditDraft}>Tinjau / edit draf</button>}
      <button type="button" className="primary-button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
      {selectedInvoice.status === "issued" && phone ? <a className="tab-button inline-flex items-center" href={whatsappHref} target="_blank" rel="noreferrer">Siapkan WhatsApp</a> : <button type="button" className="tab-button" disabled title={selectedInvoice.status === "draft" ? "Terbitkan invoice terlebih dahulu" : "Nomor WhatsApp pelanggan yang valid diperlukan"}>Siapkan WhatsApp</button>}
      {selectedInvoice.status === "draft" && <Link className="primary-button inline-flex items-center" href="/keuangan#jurnal">Buka antrean issue &amp; posting AR →</Link>}
      {canWrite && selectedInvoice.status === "draft" && <button type="button" className="tab-button" onClick={() => { setShowVoidForm(value => !value); setVoidReason(""); }}>Batalkan draft</button>}
      <p className="basis-full text-xs text-[var(--muted)]">WhatsApp hanya membuka teks siap kirim; tidak mengirim otomatis dan tidak melampirkan PDF. Cetak/Simpan PDF menggunakan dialog browser.</p>
    </div>}
    {showVoidForm && selectedInvoice?.status === "draft" && <form className="screen-only card card-pad mt-3" onSubmit={voidInvoice}><h3 className="font-semibold">Batalkan draft invoice</h3><label className="mt-3 block text-xs text-[var(--muted)]">Alasan<input required minLength={3} className="field mt-1" value={voidReason} onChange={event => setVoidReason(event.target.value)} /></label><div className="mt-3 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => setShowVoidForm(false)}>Kembali</button><button type="submit" className="tab-button" disabled={voidSaving}>{voidSaving ? "Menyimpan…" : "Konfirmasi pembatalan"}</button></div></form>}
  </main>;
}

function InvoiceItemTable({ lines }: { lines: CustomerInvoiceLine[] }) {
  return (
    <div className="invoice-items-scroll overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse text-left text-xs invoice-print-table" aria-label="Rincian barang pada invoice">
        <thead>
          <tr className="border-y border-[var(--border)] text-[var(--muted)]">
            <th scope="col" className="py-2 pr-2">Barang</th>
            <th scope="col" className="px-2 py-2 text-right">Qty</th>
            <th scope="col" className="px-2 py-2 text-right">Harga/unit</th>
            <th scope="col" className="py-2 pl-2 text-right">Jumlah setelah diskon SO</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(line => (
            <tr key={line.id} className="border-b border-[var(--border)] align-top">
              <td className="py-3 pr-2">
                <span className="invoice-mobile-label invoice-mobile-label--item">Barang</span>
                <strong>{line.product_name_snapshot}</strong>
                <p className="mt-1 text-[10px] text-[var(--muted)]">{line.product_code_snapshot} · {line.unit_snapshot}{line.price_overridden ? " · harga override SO" : " · harga snapshot SO"}</p>
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                <span className="invoice-mobile-label">Qty</span>
                <span className="invoice-mobile-value">{Number(line.quantity).toLocaleString("id-ID")} {line.unit_snapshot}</span>
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                <span className="invoice-mobile-label">Harga/unit</span>
                <span className="invoice-mobile-value">{money(line.unit_price_snapshot)}</span>
              </td>
              <td className="py-3 pl-2 text-right font-semibold tabular-nums">
                <span className="invoice-mobile-label">Jumlah setelah diskon SO</span>
                <span className="invoice-mobile-value">{money(line.line_total)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></article>;
}
