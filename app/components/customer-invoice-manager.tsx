"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type InvoiceStatus = "draft" | "void";
type Customer = { id: string; code: string; legal_name: string; phone: string | null };
type SalesOrder = { id: string; order_number: string; customer_id: string };
type Shipment = {
  id: string; shipment_number: string; sales_order_id: string; customer_id: string;
  shipment_date: string; delivered_at: string | null; status: "draft" | "shipped" | "delivered" | "issue" | "cancelled";
};
type ShipmentLine = {
  id: string; shipment_id: string; product_code_snapshot: string; product_name_snapshot: string;
  unit_snapshot: string; quantity: number | string;
};
type CustomerInvoice = {
  id: string; invoice_number: string; shipment_id: string; sales_order_id: string; customer_id: string;
  invoice_date: string; due_date: string; currency_code: string; customer_code_snapshot: string;
  customer_name_snapshot: string; customer_phone_snapshot: string | null; ship_to_address_snapshot: string;
  subtotal_amount: number | string; total_amount: number | string; status: InvoiceStatus;
  notes: string | null; void_reason: string | null; created_at: string;
};
type CustomerInvoiceLine = {
  id: string; sales_invoice_id: string; line_number: number; shipment_line_id: string;
  sales_order_line_id: string; customer_product_price_id: string | null; price_overridden: boolean;
  product_code_snapshot: string; product_name_snapshot: string; unit_snapshot: string;
  quantity: number | string; unit_price_snapshot: number | string; line_total: number | string;
};

const money = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentLines, setShipmentLines] = useState<ShipmentLine[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<CustomerInvoiceLine[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");
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
        setRole(""); setCustomers([]); setSalesOrders([]); setShipments([]); setShipmentLines([]); setInvoices([]); setInvoiceLines([]);
        setError("Masuk untuk melihat invoice pelanggan."); setLoading(false); return;
      }
      const businessRole = String(session.user.app_metadata?.business_role ?? "");
      setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) {
        setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata."); setLoading(false); return;
      }
      const results = await Promise.all([
        supabase.from("customers").select("id,code,legal_name,phone").limit(1000),
        supabase.from("sales_orders").select("id,order_number,customer_id").limit(1000),
        supabase.from("shipments").select("id,shipment_number,sales_order_id,customer_id,shipment_date,delivered_at,status").order("shipment_date", { ascending: false }).limit(1000),
        supabase.from("shipment_lines").select("id,shipment_id,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity").order("line_number").limit(4000),
        supabase.from("sales_invoices").select("id,invoice_number,shipment_id,sales_order_id,customer_id,invoice_date,due_date,currency_code,customer_code_snapshot,customer_name_snapshot,customer_phone_snapshot,ship_to_address_snapshot,subtotal_amount,total_amount,status,notes,void_reason,created_at").order("invoice_date", { ascending: false }).limit(1000),
        supabase.from("sales_invoice_lines").select("id,sales_invoice_id,line_number,shipment_line_id,sales_order_line_id,customer_product_price_id,price_overridden,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,unit_price_snapshot,line_total").order("line_number").limit(4000),
      ]);
      for (const result of results) if (result.error) throw result.error;
      setCustomers((results[0].data ?? []) as Customer[]);
      setSalesOrders((results[1].data ?? []) as SalesOrder[]);
      setShipments((results[2].data ?? []) as Shipment[]);
      setShipmentLines((results[3].data ?? []) as ShipmentLine[]);
      setInvoices((results[4].data ?? []) as CustomerInvoice[]);
      setInvoiceLines((results[5].data ?? []) as CustomerInvoiceLine[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat invoice pelanggan dari Supabase."); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  const customerById = useMemo(() => new Map(customers.map(row => [row.id, row])), [customers]);
  const salesOrderById = useMemo(() => new Map(salesOrders.map(row => [row.id, row])), [salesOrders]);
  const shipmentById = useMemo(() => new Map(shipments.map(row => [row.id, row])), [shipments]);
  const linesByShipment = useMemo(() => {
    const grouped = new Map<string, ShipmentLine[]>();
    for (const line of shipmentLines) grouped.set(line.shipment_id, [...(grouped.get(line.shipment_id) ?? []), line]);
    return grouped;
  }, [shipmentLines]);
  const linesByInvoice = useMemo(() => {
    const grouped = new Map<string, CustomerInvoiceLine[]>();
    for (const line of invoiceLines) grouped.set(line.sales_invoice_id, [...(grouped.get(line.sales_invoice_id) ?? []), line]);
    return grouped;
  }, [invoiceLines]);
  const activeShipmentIds = useMemo(() => new Set(invoices.filter(row => row.status !== "void").map(row => row.shipment_id)), [invoices]);
  const eligibleShipments = shipments.filter(row => row.status === "delivered" && !activeShipmentIds.has(row.id));
  const selectedShipment = shipments.find(row => row.id === shipmentId);
  const selectedInvoice = invoices.find(row => row.id === selectedInvoiceId) ?? invoices[0] ?? null;
  const selectedInvoiceShipment = selectedInvoice ? shipmentById.get(selectedInvoice.shipment_id) : undefined;
  const selectedInvoiceOrder = selectedInvoice ? salesOrderById.get(selectedInvoice.sales_order_id) : undefined;
  const selectedInvoiceLines = selectedInvoice ? linesByInvoice.get(selectedInvoice.id) ?? [] : [];
  const visibleInvoices = invoices.filter(row => {
    const shipment = shipmentById.get(row.shipment_id);
    const order = salesOrderById.get(row.sales_order_id);
    return `${row.invoice_number} ${row.customer_name_snapshot} ${shipment?.shipment_number ?? ""} ${order?.order_number ?? ""}`.toLowerCase().includes(query.toLowerCase());
  });
  const invoiceNumber = selectedInvoice?.invoice_number ?? "";
  const phone = whatsappNumber(selectedInvoice?.customer_phone_snapshot ?? null);
  const whatsappText = selectedInvoice
    ? `Halo ${selectedInvoice.customer_name_snapshot}, draf invoice ${selectedInvoice.invoice_number} untuk pengiriman ${selectedInvoiceShipment?.shipment_number ?? ""} telah disiapkan. Nilai sementara ${money(selectedInvoice.total_amount)}; PPN belum dihitung dan dokumen ini belum final. Jatuh tempo: ${displayDate(selectedInvoice.due_date)}.`
    : "";
  const whatsappHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}` : "";

  function openCreateForm() {
    setError(""); setNotice(""); setShowForm(true); setShipmentId(""); setInvoiceDate(localDate()); setNotes("");
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk membuat draft invoice.");
      if (!shipmentId) throw new Error("Pilih shipment yang sudah dicatat diterima pelanggan.");
      if (!invoiceDate) throw new Error("Tanggal draft invoice wajib diisi.");
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("create_customer_invoice", {
        p_shipment_id: shipmentId, p_invoice_date: invoiceDate, p_notes: notes,
      });
      if (rpcError) throw rpcError;
      setShowForm(false); setSelectedInvoiceId(String(data ?? ""));
      setNotice("Draft invoice tersimpan dari kuantitas shipment delivered. Belum ada PPN, posting akuntansi, atau pengiriman otomatis.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal membuat draft invoice pelanggan."); }
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal membatalkan draft invoice."); }
    finally { setVoidSaving(false); }
  }

  return <main className="page-wrap">
    <div className="screen-only mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="page-kicker">Transaksi · Penagihan drop-ship</p><h1 className="page-title">Invoice pelanggan</h1><p className="page-description">Satu draft invoice dibuat ketika setiap shipment dicatat diterima pelanggan; kiriman parsial ditagih terpisah.</p></div>
      <div className="flex gap-2"><Link className="tab-button" href="/pengiriman-piutang">← Pengiriman</Link>{canWrite && <button className="primary-button" type="button" disabled={eligibleShipments.length === 0} onClick={openCreateForm}>＋ Buat draft shipment lama</button>}</div>
    </div>

    <div className="screen-only demo-banner mb-5"><strong>Aturan penagihan:</strong> draft dibuat otomatis saat shipment dicatat diterima pelanggan. Setiap shipment parsial menghasilkan draft tersendiri; draft shipment lama yang belum memiliki invoice dapat dibuat manual oleh Owner/Admin. PPN dan identitas legal perusahaan belum dikonfigurasi, sehingga dokumen tetap draft, bukan invoice resmi/Faktur Pajak. Tidak ada jurnal, pembayaran, atau pengiriman pesan otomatis.</div>
    {error && <p role="alert" className="screen-only mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="screen-only mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    {showForm && <form className="screen-only card card-pad mb-5" onSubmit={createInvoice}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Backfill draft dari shipment lama</h2><p className="mt-1 text-xs text-[var(--muted)]">Gunakan hanya untuk shipment yang sudah delivered sebelum aturan otomatis diterapkan. Nilai mengikuti snapshot harga SO; shipment parsial ditagih terpisah dan sisa pembulatan dialokasikan pada invoice terakhir.</p></div><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--muted)]">Shipment delivered<select required className="field mt-1" value={shipmentId} onChange={event => setShipmentId(event.target.value)}><option value="">Pilih shipment…</option>{eligibleShipments.map(row => <option key={row.id} value={row.id}>{row.shipment_number} · {salesOrderById.get(row.sales_order_id)?.order_number ?? "SO"} · {customerById.get(row.customer_id)?.legal_name ?? "Pelanggan"}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Tanggal draft<input required className="field mt-1" type="date" value={invoiceDate} onChange={event => setInvoiceDate(event.target.value)} /></label></div>
      {selectedShipment && <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3 text-sm"><strong>{customerById.get(selectedShipment.customer_id)?.legal_name ?? "Pelanggan"}</strong><span className="mx-2 text-[var(--muted)]">·</span>SO {salesOrderById.get(selectedShipment.sales_order_id)?.order_number ?? "—"}<p className="mt-1 text-xs text-[var(--muted)]">Diterima {displayDate(selectedShipment.delivered_at)} · {(linesByShipment.get(selectedShipment.id) ?? []).length} baris shipment · {(linesByShipment.get(selectedShipment.id) ?? []).reduce((sum, line) => sum + Number(line.quantity), 0).toLocaleString("id-ID")} unit (kuantitas agregat)</p></div>}
      <label className="mt-3 block text-xs text-[var(--muted)]">Catatan draft<textarea className="field mt-1 min-h-20 py-2" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan internal opsional" /></label>
      <div className="mt-4 flex justify-end"><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan draft invoice"}</button></div>
    </form>}

    <section className="screen-only mb-5 grid gap-3 sm:grid-cols-3">
      <Kpi label="Draft aktif" value={String(invoices.filter(row => row.status === "draft").length)} />
      <Kpi label="Shipment menunggu invoice" value={String(eligibleShipments.length)} />
      <Kpi label="Total draft · tanpa PPN" value={money(invoices.filter(row => row.status === "draft").reduce((sum, row) => sum + Number(row.total_amount), 0))} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
      <div className="screen-only card card-pad">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar invoice</h2><p className="mt-1 text-xs text-[var(--muted)]">{invoices.length} dokumen dari Supabase</p></div><input className="field max-w-52" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari invoice/SO…" aria-label="Cari invoice pelanggan" /></div>
        {loading ? <p className="py-6 text-sm text-[var(--muted)]">Memuat invoice…</p> : visibleInvoices.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center"><p className="font-medium">Belum ada invoice</p><p className="mt-1 text-xs text-[var(--muted)]">Draft baru bisa dibuat setelah shipment berstatus diterima pelanggan.</p></div> : <div className="space-y-2">{visibleInvoices.map(row => {
          const shipment = shipmentById.get(row.shipment_id);
          const order = salesOrderById.get(row.sales_order_id);
          return <button key={row.id} type="button" onClick={() => { setSelectedInvoiceId(row.id); setShowVoidForm(false); }} className={`w-full rounded-xl border p-3 text-left ${selectedInvoice?.id === row.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-muted)]"}`}>
            <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.invoice_number}</p><h3 className="mt-1 text-sm font-semibold">{row.customer_name_snapshot}</h3></div><span className="status-pill">{row.status === "draft" ? "Draft" : "Dibatalkan"}</span></div>
            <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-[var(--muted)]"><span>{shipment?.shipment_number ?? "Shipment"} · {order?.order_number ?? "SO"}</span><strong className="text-[var(--foreground)]">{money(row.total_amount)}</strong></div>
          </button>;
        })}</div>}
      </div>

      {selectedInvoice ? <article id="invoice-print" className="print-document card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div><p className="page-kicker">Jena Medical Center</p><h2 className="mt-1 text-xl font-bold">Invoice Penjualan</h2><p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${selectedInvoice.status === "draft" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-800"}`}>{selectedInvoice.status === "draft" ? "DRAFT · BELUM DITERBITKAN" : "DIBATALKAN"}</p></div>
          <div className="text-left sm:text-right"><p className="text-xs text-[var(--muted)]">Nomor dokumen</p><p className="mt-1 font-mono text-sm font-semibold">{invoiceNumber}</p><p className="mt-2 text-xs text-[var(--muted)]">Tanggal {displayDate(selectedInvoice.invoice_date)}</p><p className="text-xs text-[var(--muted)]">Jatuh tempo {displayDate(selectedInvoice.due_date)}</p></div>
        </div>
        <div className="my-4 grid gap-4 sm:grid-cols-2"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Pelanggan</p><p className="mt-1 font-semibold">{selectedInvoice.customer_name_snapshot}</p><p className="text-xs text-[var(--muted)]">{selectedInvoice.customer_code_snapshot}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">Pengiriman yang diterima</p><p className="mt-1 font-semibold">{selectedInvoiceShipment?.shipment_number ?? "—"}</p><p className="text-xs text-[var(--muted)]">SO {selectedInvoiceOrder?.order_number ?? "—"} · {displayDate(selectedInvoiceShipment?.delivered_at)}</p></div></div>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>Dokumen draft, bukan tagihan final atau Faktur Pajak.</strong> Identitas legal perusahaan dan perlakuan PPN belum dikonfigurasi; nilai di bawah adalah nilai sebelum pajak dan belum diposting ke akuntansi.</div>
        <div className="mb-4 rounded-lg bg-[var(--surface-muted)] p-3 text-xs"><p className="font-semibold">Alamat tujuan pengiriman</p><p className="mt-1">{selectedInvoice.ship_to_address_snapshot}</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[540px] border-collapse text-left text-xs invoice-print-table"><thead><tr className="border-y border-[var(--border)] text-[var(--muted)]"><th className="py-2 pr-2">Barang</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Harga/unit</th><th className="py-2 pl-2 text-right">Jumlah setelah diskon SO</th></tr></thead><tbody>{selectedInvoiceLines.map(line => <tr key={line.id} className="border-b border-[var(--border)] align-top"><td className="py-3 pr-2"><strong>{line.product_name_snapshot}</strong><p className="mt-1 text-[10px] text-[var(--muted)]">{line.product_code_snapshot} · {line.unit_snapshot}{line.price_overridden ? " · harga override SO" : " · harga snapshot SO"}</p></td><td className="px-2 py-3 text-right tabular-nums">{Number(line.quantity).toLocaleString("id-ID")} {line.unit_snapshot}</td><td className="px-2 py-3 text-right tabular-nums">{money(line.unit_price_snapshot)}</td><td className="py-3 pl-2 text-right font-semibold tabular-nums">{money(line.line_total)}</td></tr>)}</tbody></table></div>
        <div className="ml-auto mt-4 max-w-sm space-y-2 border-t border-[var(--border)] pt-3 text-sm"><div className="flex justify-between"><span>Subtotal setelah diskon</span><strong>{money(selectedInvoice.subtotal_amount)}</strong></div><div className="flex justify-between text-base font-bold"><span>Total sementara · belum termasuk PPN</span><strong>{money(selectedInvoice.total_amount)}</strong></div></div>
        {selectedInvoice.notes && <p className="mt-4 text-xs text-[var(--muted)]">Catatan: {selectedInvoice.notes}</p>}
        {selectedInvoice.status === "void" && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-700">Alasan pembatalan: {selectedInvoice.void_reason}</p>}
        <div className="mt-6 border-t border-[var(--border)] pt-3 text-[10px] leading-5 text-[var(--muted)]"><p>Dokumen ini hanya pratinjau internal. Belum diterbitkan, belum menghitung PPN, dan bukan Faktur Pajak. Lengkapi identitas legal serta kebijakan pajak sebelum menerbitkan dokumen resmi.</p><p className="mt-1">Jena Medical Center · Drop-ship langsung dari supplier ke pelanggan.</p></div>
      </article> : <div className="screen-only card card-pad flex min-h-80 items-center justify-center text-center"><div><h2 className="font-semibold">Pilih invoice untuk pratinjau</h2><p className="mt-1 text-sm text-[var(--muted)]">PDF dapat disimpan melalui fungsi cetak browser.</p></div></div>}
    </section>

    {selectedInvoice && <div className="screen-only mt-4 flex flex-wrap gap-2">
      <button type="button" className="primary-button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
      {selectedInvoice.status === "draft" && phone ? <a className="tab-button inline-flex items-center" href={whatsappHref} target="_blank" rel="noreferrer">Siapkan WhatsApp</a> : <button type="button" className="tab-button" disabled title="Nomor WhatsApp pelanggan yang valid diperlukan">Siapkan WhatsApp</button>}
      {canWrite && selectedInvoice.status === "draft" && <button type="button" className="tab-button" onClick={() => { setShowVoidForm(value => !value); setVoidReason(""); }}>Batalkan draft</button>}
      <p className="basis-full text-xs text-[var(--muted)]">WhatsApp hanya membuka teks siap kirim; tidak mengirim otomatis dan tidak melampirkan PDF. Cetak/Simpan PDF menggunakan dialog browser.</p>
    </div>}
    {showVoidForm && selectedInvoice?.status === "draft" && <form className="screen-only card card-pad mt-3" onSubmit={voidInvoice}><h3 className="font-semibold">Batalkan draft invoice</h3><label className="mt-3 block text-xs text-[var(--muted)]">Alasan<input required minLength={3} className="field mt-1" value={voidReason} onChange={event => setVoidReason(event.target.value)} /></label><div className="mt-3 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => setShowVoidForm(false)}>Kembali</button><button type="submit" className="tab-button" disabled={voidSaving}>{voidSaving ? "Menyimpan…" : "Konfirmasi pembatalan"}</button></div></form>}
  </main>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></article>;
}
