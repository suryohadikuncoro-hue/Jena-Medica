"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SupplierInvoiceManager } from "@/app/components/supplier-invoice-manager";

const money = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
type Tab = "PO Supplier" | "Faktur Supplier";
type Supplier = { id: string; code: string; legal_name: string };
type Customer = { id: string; legal_name: string };
type SalesOrder = { id: string; order_number: string; customer_id: string; order_date: string; status: string };
type SalesOrderLine = { id: string; sales_order_id: string; product_name_snapshot: string; quantity: number; unit_snapshot: string; line_total: number };
type SourcedLine = { sales_order_line_id: string; quantity: number };
type PurchaseOrder = { id: string; order_number: string; sales_order_id: string; supplier_id: string; customer_id: string; order_date: string; expected_delivery_date: string | null; status: "draft" | "sent" | "acknowledged" | "cancelled"; estimated_total: number };
type POLineDraft = { sales_order_line_id: string; quantity: string; quoted_unit_cost: string };
const poStatus: Record<PurchaseOrder["status"], string> = { draft: "Draft", sent: "Dikirim ke supplier", acknowledged: "Dikonfirmasi supplier", cancelled: "Dibatalkan" };

export default function SupplierOperationsPage() {
  const [tab, setTab] = useState<Tab>("PO Supplier");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [salesLines, setSalesLines] = useState<SalesOrderLine[]>([]);
  const [sourcedLines, setSourcedLines] = useState<SourcedLine[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [poLines, setPOLines] = useState<POLineDraft[]>([]);
  const configured = isSupabaseConfigured();
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(""); setError("Masuk untuk melihat PO supplier."); setSuppliers([]); setSalesOrders([]); setSalesLines([]); setSourcedLines([]); setPurchaseOrders([]); setLoading(false); return; }
      const businessRole = String(session.user.app_metadata?.business_role ?? ""); setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata."); setLoading(false); return; }
      const [supplierResult, customerResult, orderResult, lineResult, poResult, sourcedResult] = await Promise.all([
        supabase.from("suppliers").select("id,code,legal_name").eq("is_active", true).order("legal_name").limit(500),
        supabase.from("customers").select("id,legal_name").limit(500),
        supabase.from("sales_orders").select("id,order_number,customer_id,order_date,status").eq("status", "confirmed").order("order_date", { ascending: false }).limit(300),
        supabase.from("sales_order_lines").select("id,sales_order_id,product_name_snapshot,quantity,unit_snapshot,line_total").limit(1000),
        supabase.from("purchase_orders").select("id,order_number,sales_order_id,supplier_id,customer_id,order_date,expected_delivery_date,status,estimated_total").order("order_date", { ascending: false }).limit(300),
        supabase.from("purchase_order_lines").select("sales_order_line_id,quantity").limit(2000),
      ]);
      for (const result of [supplierResult, customerResult, orderResult, lineResult, poResult, sourcedResult]) if (result.error) throw result.error;
      setSuppliers((supplierResult.data ?? []) as Supplier[]); setCustomers((customerResult.data ?? []) as Customer[]);
      setSalesOrders((orderResult.data ?? []) as SalesOrder[]); setSalesLines((lineResult.data ?? []) as SalesOrderLine[]);
      setSourcedLines((sourcedResult.data ?? []) as SourcedLine[]);
      setPurchaseOrders((poResult.data ?? []) as PurchaseOrder[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat data PO dari Supabase."); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => {
    const sync = () => setTab(window.location.hash === "#invoices" ? "Faktur Supplier" : "PO Supplier");
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, []);

  const supplierById = useMemo(() => new Map(suppliers.map(item => [item.id, item])), [suppliers]);
  const customerById = useMemo(() => new Map(customers.map(item => [item.id, item])), [customers]);
  const orderById = useMemo(() => new Map(salesOrders.map(item => [item.id, item])), [salesOrders]);
  const filteredPOs = purchaseOrders.filter(item => `${item.order_number} ${orderById.get(item.sales_order_id)?.order_number ?? ""} ${supplierById.get(item.supplier_id)?.legal_name ?? ""} ${customerById.get(item.customer_id)?.legal_name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const sourcedByLine = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of sourcedLines) totals.set(line.sales_order_line_id, (totals.get(line.sales_order_line_id) ?? 0) + Number(line.quantity));
    return totals;
  }, [sourcedLines]);
  const selectedOrderLines = salesLines.filter(line => line.sales_order_id === salesOrderId);
  const selectedOrder = salesOrders.find(item => item.id === salesOrderId);
  const totalEstimate = purchaseOrders.reduce((sum, item) => sum + Number(item.estimated_total), 0);
  const draftCount = purchaseOrders.filter(item => item.status === "draft").length;

  if (tab === "Faktur Supplier") return <SupplierInvoiceManager />;

  function chooseSalesOrder(id: string) {
    setSalesOrderId(id);
    setPOLines(salesLines.filter(line => line.sales_order_id === id).map(line => ({ sales_order_line_id: line.id, quantity: String(Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0))), quoted_unit_cost: "" })));
  }

  async function submitPO(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk membuat PO.");
      if (!supplierId || !salesOrderId) throw new Error("Pilih supplier dan SO yang sudah dikonfirmasi.");
      const activeLines = poLines.filter(line => Number(line.quantity) > 0);
      if (!activeLines.length) throw new Error("Tidak ada kuantitas SO yang tersisa untuk disumberkan.");
      if (activeLines.some(line => !line.quoted_unit_cost.trim())) throw new Error("Lengkapi harga beli untuk setiap item yang disumberkan.");
      const lines = activeLines.map(line => ({ sales_order_line_id: line.sales_order_line_id, quantity: Number(line.quantity), quoted_unit_cost: Number(line.quoted_unit_cost) }));
      if (lines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.quoted_unit_cost) || line.quoted_unit_cost < 0)) throw new Error("Periksa kuantitas dan harga beli per item.");
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("create_purchase_order", {
        p_supplier_id: supplierId, p_sales_order_id: salesOrderId,
        p_expected_delivery_date: expectedDate || null, p_notes: notes, p_lines: lines,
      });
      if (rpcError) throw rpcError;
      setShowForm(false); setSupplierId(""); setSalesOrderId(""); setExpectedDate(""); setNotes(""); setPOLines([]);
      setNotice("Draft PO tersimpan. Kuantitas sumber divalidasi terhadap sisa baris SO."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan PO supplier."); }
    finally { setSaving(false); }
  }

  return <main className="page-wrap">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Transaksi · Pembelian drop-ship</p><h1 className="page-title">Order & faktur supplier</h1><p className="page-description">PO menautkan SO terkonfirmasi ke supplier aktif dan alamat kirim pelanggan; barang tidak masuk persediaan Jena.</p></div>{tab === "PO Supplier" && canWrite && <button className="primary-button" onClick={() => { setShowForm(v => !v); setError(""); }}>＋ Buat PO supplier</button>}</div>
    <div className="demo-banner mb-5"><strong>{tab === "PO Supplier" ? "PO terhubung ke Supabase." : "Faktur supplier belum diintegrasikan."}</strong> {tab === "PO Supplier" ? "Draft disimpan melalui RPC atomik; kuantitas PO tidak boleh melebihi sisa SO." : "Belum ada tabel faktur/pembayaran pada fase ini; tidak ada data demo ditampilkan."}</div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}{notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <section className="mb-5 grid gap-3 sm:grid-cols-3"><Kpi label="PO dimuat" value={String(purchaseOrders.length)}/><Kpi label="Draft PO" value={String(draftCount)}/><Kpi label="Estimasi biaya supplier" value={money(totalEstimate)}/></section>
    {showForm && tab === "PO Supplier" && <form className="card card-pad mb-5" onSubmit={submitPO}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Draft PO supplier</h2><p className="mt-1 text-xs text-[var(--muted)]">Satu PO mengacu pada satu SO dan satu supplier; pemenuhan parsial/multi-supplier dapat dibuat sebagai beberapa PO.</p></div><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs text-[var(--muted)]">SO terkonfirmasi<select required className="field mt-1" value={salesOrderId} onChange={e => chooseSalesOrder(e.target.value)}><option value="">Pilih SO…</option>{salesOrders.map(order => <option key={order.id} value={order.id}>{order.order_number} · {customerById.get(order.customer_id)?.legal_name ?? "Pelanggan"}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Supplier aktif<select required className="field mt-1" value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">Pilih supplier…</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.legal_name}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Perkiraan tiba<input className="field mt-1" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}/></label><div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-3">Kirim langsung ke: <strong className="text-[var(--foreground)]">{selectedOrder ? customerById.get(selectedOrder.customer_id)?.legal_name ?? "Pelanggan" : "Pilih SO untuk memuat alamat snapshot"}</strong>. Alamat diambil dari snapshot SO dan tidak diubah saat membuat PO.</div></div><div className="mt-4"><h3 className="text-sm font-semibold">Item yang disumberkan</h3>{selectedOrderLines.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">Pilih SO terkonfirmasi yang memiliki baris barang.</p> : <div className="mt-2 space-y-2">{selectedOrderLines.map((line, index) => <div className="grid items-center gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[2fr_1fr_1fr]" key={line.id}><div><p className="text-sm font-medium">{line.product_name_snapshot}</p><p className="text-xs text-[var(--muted)]">Sisa untuk sumber: {Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0))} {line.unit_snapshot}; batas final ditegakkan database.</p></div><label className="text-xs text-[var(--muted)]">Kuantitas<input className="field mt-1" type="number" min="0.0001" max={Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0))} step="0.0001" disabled={Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0)) <= 0} value={poLines[index]?.quantity ?? ""} onChange={e => setPOLines(rows => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))}/></label><label className="text-xs text-[var(--muted)]">Harga beli/unit<input required className="field mt-1" type="number" min="0" step="0.01" disabled={Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0)) <= 0} value={poLines[index]?.quoted_unit_cost ?? ""} onChange={e => setPOLines(rows => rows.map((row, i) => i === index ? { ...row, quoted_unit_cost: e.target.value } : row))}/></label></div>)}</div>}</div><label className="mt-4 block text-xs text-[var(--muted)]">Catatan supplier<textarea className="field mt-1 min-h-20 py-2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instruksi pengiriman langsung"/></label><div className="mt-4 flex justify-end"><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan draft PO"}</button></div></form>}
    <section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Jenis dokumen supplier">{(["PO Supplier", "Faktur Supplier"] as const).map(item => <button key={item} className="tab-button" role="tab" aria-selected={tab === item} onClick={() => { setTab(item); setQuery(""); setShowForm(false); }}>{item}</button>)}</div><div className="flex gap-2"><input className="field sm:w-64" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor, supplier, pelanggan" aria-label="Cari PO supplier"/><button className="tab-button" onClick={() => void load()} disabled={loading}>Muat ulang</button></div></div>
      {tab === "PO Supplier" ? <><div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Nomor PO","SO pelanggan","Supplier","Kirim langsung ke","Tanggal","Estimasi","Status"].map(h => <th key={h} className="py-3 pr-3">{h}</th>)}</tr></thead><tbody>{filteredPOs.map(item => <tr className="table-row" key={item.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{item.order_number}</td><td className="py-4 pr-3">{orderById.get(item.sales_order_id)?.order_number ?? "SO"}</td><td className="py-4 pr-3">{supplierById.get(item.supplier_id)?.legal_name ?? "Supplier nonaktif"}</td><td className="py-4 pr-3">{customerById.get(item.customer_id)?.legal_name ?? "Pelanggan"}</td><td className="py-4 pr-3">{item.order_date}</td><td className="py-4 pr-3 text-right">{money(Number(item.estimated_total))}</td><td className="py-4 text-right"><span className="status-pill">{poStatus[item.status]}</span></td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{filteredPOs.map(item => <article key={item.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{item.order_number}</p><h3 className="mt-1 text-sm font-semibold">{supplierById.get(item.supplier_id)?.legal_name ?? "Supplier"}</h3><p className="mt-1 text-xs text-[var(--muted)]">SO {orderById.get(item.sales_order_id)?.order_number ?? "—"} · Kirim ke {customerById.get(item.customer_id)?.legal_name ?? "pelanggan"}</p></div><span className="status-pill">{poStatus[item.status]}</span></div><div className="mt-3 flex justify-between text-xs"><span>{item.order_date}</span><strong>{money(Number(item.estimated_total))}</strong></div></article>)}</div>{!loading && !filteredPOs.length && !error && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada PO supplier untuk filter ini.</p>}</> : <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center"><h2 className="font-semibold">Faktur supplier — fase berikutnya</h2><p className="mx-auto mt-2 max-w-xl text-sm text-[var(--muted)]">Tabel faktur, alokasi diskon, perlakuan PPN masukan, pembayaran dan pencatatan hutang belum dibuat. Tidak ada angka demo yang ditampilkan agar tidak tertukar dengan data nyata.</p></div>}
      {loading && <p className="py-6 text-center text-sm text-[var(--muted)]">Memuat data Supabase…</p>}
    </section>
  </main>;
}
function Kpi({ label, value }: { label: string; value: string }) { return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></article>; }
