"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SupplierInvoiceManager } from "@/app/components/supplier-invoice-manager";
import { IconOrder } from "@/app/components/icons";
import { ActionBanner, Button, ButtonLink, EmptyState, FilterChips, PageHeader, SegmentedTabs, SkeletonRows, StatCard, StatusBadge, type Tone } from "@/app/components/ui";

const money = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
type Tab = "order" | "faktur";
type StatusFilter = "all" | "draft" | "sent" | "acknowledged";
type Supplier = { id: string; code: string; legal_name: string };
type Customer = { id: string; legal_name: string };
type SalesOrder = { id: string; order_number: string; customer_id: string; order_date: string; status: string };
type SalesOrderLine = { id: string; sales_order_id: string; product_name_snapshot: string; quantity: number; unit_snapshot: string; line_total: number };
type SourcedLine = { sales_order_line_id: string; quantity: number };
type PurchaseOrder = { id: string; order_number: string; sales_order_id: string; supplier_id: string; customer_id: string; order_date: string; expected_delivery_date: string | null; status: "draft" | "sent" | "acknowledged" | "cancelled"; estimated_total: number };
type POLineDraft = { sales_order_line_id: string; quantity: string; quoted_unit_cost: string };
const poStatus: Record<PurchaseOrder["status"], string> = { draft: "Draf", sent: "Menunggu balasan", acknowledged: "Dibalas", cancelled: "Dibatalkan" };
const poTone: Record<PurchaseOrder["status"], Tone> = { draft: "gray", sent: "yellow", acknowledged: "mint", cancelled: "gray" };

export default function SupplierOperationsPage() {
  const [tab, setTab] = useState<Tab>("order");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
  const [statusUpdating, setStatusUpdating] = useState("");
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
    const sync = () => setTab(window.location.hash === "#invoices" ? "faktur" : "order");
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
  const unsourcedOrders = useMemo(() => salesOrders.filter(order => salesLines.some(line => line.sales_order_id === order.id && Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0) > 0)), [salesOrders, salesLines, sourcedByLine]);
  const visiblePOs = filteredPOs.filter(item => statusFilter === "all" || item.status === statusFilter);
  const selectedOrderLines = salesLines.filter(line => line.sales_order_id === salesOrderId);
  const selectedOrder = salesOrders.find(item => item.id === salesOrderId);
  const totalEstimate = purchaseOrders.reduce((sum, item) => sum + Number(item.estimated_total), 0);
  const draftCount = purchaseOrders.filter(item => item.status === "draft").length;
  const sentCount = purchaseOrders.filter(item => item.status === "sent").length;

  function selectTab(next: Tab) {
    setTab(next); setQuery(""); setShowForm(false);
    window.history.pushState(null, "", next === "faktur" ? "#invoices" : `${window.location.pathname}${window.location.search}`);
  }
  function openForm() { setShowForm(true); setError(""); }

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

  async function updatePOStatus(item: PurchaseOrder, nextStatus: "sent" | "acknowledged") {
    setError(""); setNotice(""); setStatusUpdating(item.id);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk memperbarui status PO.");
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("set_purchase_order_status", {
        p_purchase_order_id: item.id, p_new_status: nextStatus,
      });
      if (rpcError) throw rpcError;
      setNotice(nextStatus === "sent"
        ? `PO ${item.order_number} ditandai sudah dikirim. Aplikasi tidak mengirim email atau dokumen ke supplier.`
        : `Konfirmasi supplier untuk PO ${item.order_number} berhasil dicatat.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memperbarui status PO."); }
    finally { setStatusUpdating(""); }
  }

  return <main className="page-wrap">
    <PageHeader title="Order Supplier" subtitle="Pemesanan dan faktur dari supplier" actions={tab === "order" && canWrite ? <Button variant="solid" onClick={() => (showForm ? setShowForm(false) : openForm())}>{showForm ? "Tutup form" : "+ Buat PO supplier"}</Button> : undefined} />
    <div className="mt-5 flex flex-col gap-4">
      <SegmentedTabs label="Jenis dokumen supplier" items={[{ value: "order", label: "Order" }, { value: "faktur", label: "Faktur" }]} value={tab} onChange={selectTab} />
      {error && <ActionBanner tone="pink" role="alert" action={error.includes("Masuk") ? <ButtonLink href="/login" variant="solid" size="sm">Masuk</ButtonLink> : undefined}>{error}</ActionBanner>}
      {notice && <ActionBanner tone="mint">{notice}</ActionBanner>}
      {tab === "faktur" ? <SupplierInvoiceManager embedded /> : <>
        {canWrite && unsourcedOrders.length > 0 && <ActionBanner tone="yellow" action={<Button variant="solid" size="sm" onClick={openForm}>Buat order</Button>}><b>{unsourcedOrders.length} pesanan belum dipesan ke supplier.</b> Buat PO dari SO terkonfirmasi.</ActionBanner>}
        <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Menunggu balasan" value={loading ? "—" : String(sentCount)} unit="order" /><StatCard label="Draf PO" value={loading ? "—" : String(draftCount)} unit="draf" /><StatCard label="Estimasi biaya supplier" value={loading ? "—" : money(totalEstimate)} /></div>
    {showForm && tab === "order" && <form className="card card-pad mb-5" onSubmit={submitPO}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Draft PO supplier</h2><p className="mt-1 text-xs text-[var(--muted)]">Satu PO mengacu pada satu SO dan satu supplier; pemenuhan parsial/multi-supplier dapat dibuat sebagai beberapa PO.</p></div><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs text-[var(--muted)]">SO terkonfirmasi<select required className="field mt-1" value={salesOrderId} onChange={e => chooseSalesOrder(e.target.value)}><option value="">Pilih SO…</option>{salesOrders.map(order => <option key={order.id} value={order.id}>{order.order_number} · {customerById.get(order.customer_id)?.legal_name ?? "Pelanggan"}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Supplier aktif<select required className="field mt-1" value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">Pilih supplier…</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.legal_name}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Perkiraan tiba<input className="field mt-1" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}/></label><div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-3">Kirim langsung ke: <strong className="text-[var(--foreground)]">{selectedOrder ? customerById.get(selectedOrder.customer_id)?.legal_name ?? "Pelanggan" : "Pilih SO untuk memuat alamat snapshot"}</strong>. Alamat diambil dari snapshot SO dan tidak diubah saat membuat PO.</div></div><div className="mt-4"><h3 className="text-sm font-semibold">Item yang disumberkan</h3>{selectedOrderLines.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">Pilih SO terkonfirmasi yang memiliki baris barang.</p> : <div className="mt-2 space-y-2">{selectedOrderLines.map((line, index) => <div className="grid items-center gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[2fr_1fr_1fr]" key={line.id}><div><p className="text-sm font-medium">{line.product_name_snapshot}</p><p className="text-xs text-[var(--muted)]">Sisa untuk sumber: {Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0))} {line.unit_snapshot}; batas final ditegakkan database.</p></div><label className="text-xs text-[var(--muted)]">Kuantitas<input className="field mt-1" type="number" min="0.0001" max={Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0))} step="0.0001" disabled={Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0)) <= 0} value={poLines[index]?.quantity ?? ""} onChange={e => setPOLines(rows => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))}/></label><label className="text-xs text-[var(--muted)]">Harga beli/unit<input required className="field mt-1" type="number" min="0" step="0.01" disabled={Math.max(0, Number(line.quantity) - (sourcedByLine.get(line.id) ?? 0)) <= 0} value={poLines[index]?.quoted_unit_cost ?? ""} onChange={e => setPOLines(rows => rows.map((row, i) => i === index ? { ...row, quoted_unit_cost: e.target.value } : row))}/></label></div>)}</div>}</div><label className="mt-4 block text-xs text-[var(--muted)]">Catatan supplier<textarea className="field mt-1 min-h-20 py-2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instruksi pengiriman langsung"/></label><div className="mt-4 flex justify-end"><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan draft PO"}</button></div></form>}
        <div className="po-search"><input className="field" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor, supplier, pelanggan" aria-label="Cari PO supplier"/><Button size="sm" onClick={() => void load()} disabled={loading}>Muat ulang</Button></div>
        <FilterChips label="Saring status PO" items={[{ value: "all", label: "Semua" }, { value: "draft", label: "Draf" }, { value: "sent", label: "Menunggu balasan" }, { value: "acknowledged", label: "Dibalas" }]} value={statusFilter} onChange={setStatusFilter} />
        <div><h2 className="text-xl font-bold tracking-tight">Order</h2><p className="mt-1 text-xs text-[var(--muted)]">Urut dari tanggal terbaru</p></div>
        {loading ? <SkeletonRows count={3} /> : visiblePOs.length ? <div className="ui-list">{visiblePOs.map(item => {
          const actionable = canWrite && (item.status === "draft" || item.status === "sent");
          return <article key={item.id} className="ui-row po-item"><div className="po-item-main"><span className={`ui-row-icon ui-tone-${poTone[item.status]}`}><IconOrder /></span><span className="ui-row-text"><strong>{item.order_number} · {supplierById.get(item.supplier_id)?.legal_name ?? "Supplier"}</strong><small>dari {orderById.get(item.sales_order_id)?.order_number ?? "SO"} · kirim ke {customerById.get(item.customer_id)?.legal_name ?? "pelanggan"} · {item.order_date}</small></span><span className="ui-row-end"><strong>{money(Number(item.estimated_total))}</strong><StatusBadge tone={poTone[item.status]}>{poStatus[item.status]}</StatusBadge></span></div>{actionable && <Button size="sm" className="po-item-action" disabled={statusUpdating === item.id} onClick={() => void updatePOStatus(item, item.status === "draft" ? "sent" : "acknowledged")}>{statusUpdating === item.id ? "Menyimpan…" : item.status === "draft" ? "Tandai sudah dikirim" : "Catat balasan"}</Button>}</article>;
        })}</div> : !error && <EmptyState icon={<IconOrder />} title="Belum ada PO supplier" description={query || statusFilter !== "all" ? "Tidak ada PO yang cocok dengan filter ini." : "PO dibuat dari SO terkonfirmasi."} />}
        <p className="text-xs leading-relaxed text-[var(--muted)]">Aplikasi tidak mengirim email atau dokumen ke supplier. Catat status setelah PO dikirim atau supplier membalas di luar aplikasi. Pengiriman diurus supplier dan pelanggan, tidak dicatat di sini.</p>
      </>}
    </div>
  </main>;
}
