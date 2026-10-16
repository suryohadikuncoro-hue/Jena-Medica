"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ShipmentStatus = "draft" | "shipped" | "delivered" | "issue" | "cancelled";
type PurchaseOrderStatus = "draft" | "sent" | "acknowledged" | "cancelled";
type Shipment = {
  id: string; shipment_number: string; purchase_order_id: string; sales_order_id: string;
  supplier_id: string; customer_id: string; shipment_date: string; ship_to_address_snapshot: string;
  carrier: string | null; tracking_number: string | null; delivery_note_number: string | null;
  status: ShipmentStatus; shipped_at: string | null; delivered_at: string | null;
  issue_reason: string | null; cancelled_reason: string | null; notes: string | null; created_at: string;
};
type ShipmentLine = {
  id: string; shipment_id: string; line_number: number; purchase_order_line_id: string;
  product_code_snapshot: string; product_name_snapshot: string; unit_snapshot: string; quantity: number | string;
};
type ShipmentEvent = {
  id: string; shipment_id: string; previous_status: ShipmentStatus | null; new_status: ShipmentStatus;
  event_date: string; note: string | null; occurred_at: string;
};
type PurchaseOrder = {
  id: string; order_number: string; sales_order_id: string; supplier_id: string; customer_id: string;
  order_date: string; expected_delivery_date: string | null; ship_to_address_snapshot: string;
  status: PurchaseOrderStatus;
};
type PurchaseOrderLine = {
  id: string; purchase_order_id: string; product_code_snapshot: string;
  product_name_snapshot: string; unit_snapshot: string; quantity: number | string;
};
type NamedRow = { id: string; legal_name: string; code?: string };
type SalesOrder = { id: string; order_number: string };
type DraftLine = { purchase_order_line_id: string; quantity: string };
type TransitionTarget = { shipmentId: string; status: "shipped" | "delivered" | "issue" | "cancelled" };

const statusLabel: Record<ShipmentStatus, string> = {
  draft: "Draft", shipped: "Dikirim supplier", delivered: "Diterima pelanggan",
  issue: "Ada kendala", cancelled: "Draft dibatalkan",
};
const statusStyle: Record<ShipmentStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  shipped: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  issue: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
  cancelled: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
};

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function displayDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function ShipmentManager() {
  const configured = isSupabaseConfigured();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentLines, setShipmentLines] = useState<ShipmentLine[]>([]);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poLines, setPoLines] = useState<PurchaseOrderLine[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [suppliers, setSuppliers] = useState<NamedRow[]>([]);
  const [customers, setCustomers] = useState<NamedRow[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ShipmentStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [transitionTarget, setTransitionTarget] = useState<TransitionTarget | null>(null);
  const [poId, setPoId] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [transitionCarrier, setTransitionCarrier] = useState("");
  const [transitionTracking, setTransitionTracking] = useState("");
  const [transitionDeliveryNote, setTransitionDeliveryNote] = useState("");
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    if (!configured) {
      setError("Supabase belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRole(""); setShipments([]); setShipmentLines([]); setEvents([]); setPurchaseOrders([]);
        setPoLines([]); setSalesOrders([]); setSuppliers([]); setCustomers([]);
        setError("Masuk untuk melihat data pengiriman.");
        setLoading(false);
        return;
      }
      const businessRole = String(session.user.app_metadata?.business_role ?? "");
      setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) {
        setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata.");
        setLoading(false);
        return;
      }
      const results = await Promise.all([
        supabase.from("shipments").select("id,shipment_number,purchase_order_id,sales_order_id,supplier_id,customer_id,shipment_date,ship_to_address_snapshot,carrier,tracking_number,delivery_note_number,status,shipped_at,delivered_at,issue_reason,cancelled_reason,notes,created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("shipment_lines").select("id,shipment_id,line_number,purchase_order_line_id,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity").order("line_number").limit(3000),
        supabase.from("shipment_status_events").select("id,shipment_id,previous_status,new_status,event_date,note,occurred_at").order("occurred_at").limit(4000),
        supabase.from("purchase_orders").select("id,order_number,sales_order_id,supplier_id,customer_id,order_date,expected_delivery_date,ship_to_address_snapshot,status").order("order_date", { ascending: false }).limit(500),
        supabase.from("purchase_order_lines").select("id,purchase_order_id,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity").limit(3000),
        supabase.from("sales_orders").select("id,order_number").limit(1000),
        supabase.from("suppliers").select("id,legal_name,code").limit(500),
        supabase.from("customers").select("id,legal_name").limit(500),
      ]);
      for (const result of results) if (result.error) throw result.error;
      setShipments((results[0].data ?? []) as Shipment[]);
      setShipmentLines((results[1].data ?? []) as ShipmentLine[]);
      setEvents((results[2].data ?? []) as ShipmentEvent[]);
      setPurchaseOrders((results[3].data ?? []) as PurchaseOrder[]);
      setPoLines((results[4].data ?? []) as PurchaseOrderLine[]);
      setSalesOrders((results[5].data ?? []) as SalesOrder[]);
      setSuppliers((results[6].data ?? []) as NamedRow[]);
      setCustomers((results[7].data ?? []) as NamedRow[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat data pengiriman dari Supabase.");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const supplierById = useMemo(() => new Map(suppliers.map(item => [item.id, item])), [suppliers]);
  const customerById = useMemo(() => new Map(customers.map(item => [item.id, item])), [customers]);
  const orderById = useMemo(() => new Map(salesOrders.map(item => [item.id, item])), [salesOrders]);
  const poById = useMemo(() => new Map(purchaseOrders.map(item => [item.id, item])), [purchaseOrders]);
  const shipmentById = useMemo(() => new Map(shipments.map(item => [item.id, item])), [shipments]);
  const eligiblePurchaseOrders = purchaseOrders.filter(item => item.status === "sent" || item.status === "acknowledged");
  const availableByLine = useMemo(() => {
    const reserved = new Map<string, number>();
    for (const line of shipmentLines) {
      const shipment = shipmentById.get(line.shipment_id);
      if (shipment && shipment.status !== "cancelled") {
        reserved.set(line.purchase_order_line_id, (reserved.get(line.purchase_order_line_id) ?? 0) + Number(line.quantity));
      }
    }
    const result = new Map<string, number>();
    for (const line of poLines) result.set(line.id, Math.max(0, Number(line.quantity) - (reserved.get(line.id) ?? 0)));
    return result;
  }, [poLines, shipmentById, shipmentLines]);
  const linesByShipment = useMemo(() => {
    const result = new Map<string, ShipmentLine[]>();
    for (const line of shipmentLines) result.set(line.shipment_id, [...(result.get(line.shipment_id) ?? []), line]);
    return result;
  }, [shipmentLines]);
  const eventsByShipment = useMemo(() => {
    const result = new Map<string, ShipmentEvent[]>();
    for (const event of events) result.set(event.shipment_id, [...(result.get(event.shipment_id) ?? []), event]);
    return result;
  }, [events]);
  const linesByPO = useMemo(() => {
    const result = new Map<string, PurchaseOrderLine[]>();
    for (const line of poLines) result.set(line.purchase_order_id, [...(result.get(line.purchase_order_id) ?? []), line]);
    return result;
  }, [poLines]);
  const selectedShipment = selectedShipmentId ? shipmentById.get(selectedShipmentId) ?? null : null;
  const pendingShipment = transitionTarget ? shipmentById.get(transitionTarget.shipmentId) ?? null : null;
  const selectedPO = poById.get(poId);
  const selectedPOLines = selectedPO ? (linesByPO.get(selectedPO.id) ?? []).filter(line => (availableByLine.get(line.id) ?? 0) > 0) : [];

  const visibleShipments = shipments.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    const po = poById.get(item.purchase_order_id);
    const haystack = [item.shipment_number, item.tracking_number, item.delivery_note_number,
      po?.order_number, orderById.get(item.sales_order_id)?.order_number,
      supplierById.get(item.supplier_id)?.legal_name, customerById.get(item.customer_id)?.legal_name]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const activeCount = shipments.filter(item => ["draft", "shipped", "issue"].includes(item.status)).length;
  const inTransitCount = shipments.filter(item => item.status === "shipped").length;
  const deliveredCount = shipments.filter(item => item.status === "delivered").length;
  const needsAttentionCount = shipments.filter(item => item.status === "issue").length;

  function openCreateForm() {
    setError(""); setNotice(""); setShowForm(true); setShipmentDate(localDate());
    setPoId(""); setCarrier(""); setTrackingNumber(""); setDeliveryNoteNumber(""); setNotes(""); setDraftLines([]);
  }
  function choosePO(id: string) {
    setPoId(id);
    setDraftLines((linesByPO.get(id) ?? []).filter(line => (availableByLine.get(line.id) ?? 0) > 0)
      .map(line => ({ purchase_order_line_id: line.id, quantity: "" })));
  }
  function openTransition(shipment: Shipment, status: TransitionTarget["status"]) {
    setError(""); setNotice("");
    setEventDate(localDate()); setEventNote("");
    setTransitionCarrier(shipment.carrier ?? ""); setTransitionTracking(shipment.tracking_number ?? "");
    setTransitionDeliveryNote(shipment.delivery_note_number ?? "");
    setTransitionTarget({ shipmentId: shipment.id, status });
  }

  async function submitShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk membuat draft pengiriman.");
      if (!poId) throw new Error("Pilih PO yang sudah dikirim ke atau dikonfirmasi supplier.");
      if (!shipmentDate) throw new Error("Tanggal dokumen pengiriman wajib diisi.");
      const lines = draftLines.filter(line => line.quantity.trim()).map(line => ({
        purchase_order_line_id: line.purchase_order_line_id, quantity: Number(line.quantity),
      }));
      if (!lines.length) throw new Error("Masukkan kuantitas untuk minimal satu item PO.");
      for (const line of lines) {
        const quantity = Number(line.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Kuantitas pengiriman harus lebih dari nol.");
        if (quantity > (availableByLine.get(line.purchase_order_line_id) ?? 0)) throw new Error("Kuantitas melebihi sisa PO yang belum dialokasikan ke shipment.");
      }
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("create_shipment", {
        p_purchase_order_id: poId, p_shipment_date: shipmentDate, p_carrier: carrier,
        p_tracking_number: trackingNumber, p_delivery_note_number: deliveryNoteNumber,
        p_notes: notes, p_lines: lines,
      });
      if (rpcError) throw rpcError;
      setShowForm(false); setNotice("Draft pengiriman tersimpan. Kuantitas dicadangkan terhadap PO; belum menandai barang dikirim.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan draft pengiriman.");
    } finally { setSaving(false); }
  }

  async function saveTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transitionTarget) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk mengubah status pengiriman.");
      if (!eventDate) throw new Error("Tanggal kejadian wajib diisi.");
      if (["issue", "cancelled"].includes(transitionTarget.status) && eventNote.trim().length < 3) {
        throw new Error("Alasan harus berisi minimal 3 karakter.");
      }
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("transition_shipment", {
        p_shipment_id: transitionTarget.shipmentId,
        p_new_status: transitionTarget.status,
        p_event_date: eventDate,
        p_note: eventNote,
        p_carrier: transitionCarrier,
        p_tracking_number: transitionTracking,
        p_delivery_note_number: transitionDeliveryNote,
      });
      if (rpcError) throw rpcError;
      const label = statusLabel[transitionTarget.status];
      setTransitionTarget(null); setNotice(`Status pengiriman diperbarui: ${label}. Riwayat kejadian tersimpan.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui status pengiriman.");
    } finally { setSaving(false); }
  }

  function statusActions(shipment: Shipment) {
    if (!canWrite) return null;
    if (shipment.status === "draft") return <>
      <button type="button" className="primary-button" onClick={() => openTransition(shipment, "shipped")}>Tandai dikirim</button>
      <button type="button" className="tab-button" onClick={() => openTransition(shipment, "cancelled")}>Batalkan draft</button>
    </>;
    if (shipment.status === "shipped") return <>
      <button type="button" className="primary-button" onClick={() => openTransition(shipment, "delivered")}>Tandai diterima</button>
      <button type="button" className="tab-button" onClick={() => openTransition(shipment, "issue")}>Catat kendala</button>
    </>;
    if (shipment.status === "issue") return <>
      <button type="button" className="primary-button" onClick={() => openTransition(shipment, "shipped")}>Lanjutkan pengiriman</button>
      <button type="button" className="tab-button" onClick={() => openTransition(shipment, "delivered")}>Tandai diterima</button>
    </>;
    return null;
  }

  return <div>
    <div className="demo-banner mb-5"><strong>Pengiriman langsung · terhubung ke Supabase.</strong> Supplier mengirim ke alamat pelanggan pada snapshot PO. Draft shipment mencadangkan kuantitas; pembatalan draft melepaskan cadangan. Tidak ada penerimaan atau saldo stok.</div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Shipment aktif" value={String(activeCount)} detail="Draft, dikirim, atau kendala" />
      <Kpi label="Dalam perjalanan" value={String(inTransitCount)} detail="Menunggu konfirmasi pelanggan" />
      <Kpi label="Diterima pelanggan" value={String(deliveredCount)} detail="Status pengiriman selesai" />
      <Kpi label="Perlu ditinjau" value={String(needsAttentionCount)} detail="Kendala tercatat" />
    </section>

    {showForm && <form className="card card-pad mb-5" onSubmit={submitShipment}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">Buat draft pengiriman</h2><p className="mt-1 text-sm text-[var(--muted)]">Pilih PO yang sudah ditandai dikirim atau dikonfirmasi supplier. Pengiriman dapat dibuat parsial per item.</p></div>
        <button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs text-[var(--muted)]">PO supplier<select required className="field mt-1" value={poId} onChange={event => choosePO(event.target.value)}><option value="">Pilih PO…</option>{eligiblePurchaseOrders.map(po => <option key={po.id} value={po.id}>{po.order_number} · {supplierById.get(po.supplier_id)?.legal_name ?? "Supplier"} → {customerById.get(po.customer_id)?.legal_name ?? "Pelanggan"}</option>)}</select></label>
        <label className="text-xs text-[var(--muted)]">Tanggal dokumen pengiriman<input required className="field mt-1" type="date" value={shipmentDate} onChange={event => setShipmentDate(event.target.value)} /></label>
        <label className="text-xs text-[var(--muted)]">Kurir/ekspedisi<input className="field mt-1" value={carrier} onChange={event => setCarrier(event.target.value)} placeholder="Opsional" /></label>
        <label className="text-xs text-[var(--muted)]">Nomor resi<input className="field mt-1" value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} placeholder="Opsional" /></label>
        <label className="text-xs text-[var(--muted)]">Nomor surat jalan supplier<input className="field mt-1" value={deliveryNoteNumber} onChange={event => setDeliveryNoteNumber(event.target.value)} placeholder="Opsional" /></label>
        <div className="rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]"><span className="font-semibold text-[var(--foreground)]">Tujuan langsung:</span><br />{selectedPO ? `${customerById.get(selectedPO.customer_id)?.legal_name ?? "Pelanggan"} · ${selectedPO.ship_to_address_snapshot}` : "Alamat pelanggan disalin dari snapshot PO."}</div>
      </div>
      {selectedPO && <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Item PO yang belum dialokasikan</h3><p className="mt-1 text-xs text-[var(--muted)]">SO {orderById.get(selectedPO.sales_order_id)?.order_number ?? "—"} · database akan memvalidasi kuantitas lagi saat disimpan.</p></div><span className="status-pill">{selectedPO.status === "acknowledged" ? "Dikonfirmasi supplier" : "Dikirim ke supplier"}</span></div>
        {selectedPOLines.length ? <div className="space-y-2">{selectedPOLines.map(line => <div key={line.id} className="grid items-center gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1.7fr_1fr_1fr]">
          <div><p className="text-sm font-medium">{line.product_name_snapshot}</p><p className="text-xs text-[var(--muted)]">{line.product_code_snapshot} · Sisa {availableByLine.get(line.id) ?? 0} {line.unit_snapshot}</p></div>
          <p className="text-xs text-[var(--muted)]">Dipesan: {Number(line.quantity)} {line.unit_snapshot}</p>
          <label className="text-xs text-[var(--muted)]">Kuantitas shipment<input className="field mt-1" type="number" min="0.0001" max={availableByLine.get(line.id) ?? 0} step="0.0001" value={draftLines.find(item => item.purchase_order_line_id === line.id)?.quantity ?? ""} onChange={event => setDraftLines(current => current.map(item => item.purchase_order_line_id === line.id ? { ...item, quantity: event.target.value } : item))} placeholder="Isi jika dikirim" /></label>
        </div>)}</div> : <p className="rounded-lg bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">Semua kuantitas PO sudah dialokasikan ke draft/pengiriman lain.</p>}
      </div>}
      <label className="mt-4 block text-xs text-[var(--muted)]">Catatan internal<textarea className="field mt-1 min-h-20 py-2" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Instruksi atau catatan pengiriman" /></label>
      <div className="mt-4 flex justify-end"><button type="submit" className="primary-button" disabled={saving || loading}>{saving ? "Menyimpan…" : "Simpan draft pengiriman"}</button></div>
    </form>}

    <section className="card card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <input className="field min-w-[220px] flex-1 sm:max-w-sm" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nomor shipment, PO, resi…" aria-label="Cari shipment" />
          <select className="field sm:w-52" aria-label="Filter status shipment" value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | ShipmentStatus)}>
            <option value="all">Semua status</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" className="tab-button" onClick={() => void load()} disabled={loading}>{loading ? "Memuat…" : "Muat ulang"}</button>
          {canWrite && <button type="button" className="primary-button" onClick={openCreateForm} disabled={!eligiblePurchaseOrders.length}>＋ Buat pengiriman</button>}
        </div>
      </div>
      {loading ? <p className="py-10 text-center text-sm text-[var(--muted)]">Memuat shipment dan PO dari Supabase…</p> : !error && visibleShipments.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-lg">↗</div><h2 className="mt-3 font-semibold">{query || statusFilter !== "all" ? "Tidak ada shipment yang cocok" : "Belum ada pengiriman"}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">{query || statusFilter !== "all" ? "Ubah pencarian atau filter status." : "Setelah PO ditandai dikirim ke atau dikonfirmasi supplier, buat draft shipment langsung ke alamat pelanggan."}</p>{!query && statusFilter === "all" && <Link className="tab-button mt-4 inline-flex" href="/operasional">Buka Order Supplier</Link>}</div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Nomor shipment", "PO / SO", "Supplier → pelanggan", "Tanggal", "Resi / surat jalan", "Status", ""].map((label, index) => <th key={`${label}-${index}`} className="py-3 pr-3 text-left">{label}</th>)}</tr></thead><tbody>{visibleShipments.map(shipment => <tr className="table-row" key={shipment.id}>
          <td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{shipment.shipment_number}</td>
          <td className="py-4 pr-3 text-sm">{poById.get(shipment.purchase_order_id)?.order_number ?? "—"}<div className="mt-1 text-xs text-[var(--muted)]">SO {orderById.get(shipment.sales_order_id)?.order_number ?? "—"}</div></td>
          <td className="py-4 pr-3 text-sm"><span className="block">{supplierById.get(shipment.supplier_id)?.legal_name ?? "Supplier"}</span><span className="mt-1 block text-xs text-[var(--muted)]">→ {customerById.get(shipment.customer_id)?.legal_name ?? "Pelanggan"}</span></td>
          <td className="py-4 pr-3 text-sm">{displayDate(shipment.shipment_date)}{shipment.shipped_at && <span className="mt-1 block text-xs text-[var(--muted)]">Dikirim {displayDate(shipment.shipped_at)}</span>}</td>
          <td className="py-4 pr-3 text-xs">{shipment.tracking_number || shipment.delivery_note_number ? <>{shipment.tracking_number || "—"}<span className="mt-1 block text-[var(--muted)]">SJ {shipment.delivery_note_number || "—"}</span></> : "—"}</td>
          <td className="py-4 pr-3"><StatusBadge status={shipment.status} /></td>
          <td className="py-4 text-right"><button type="button" className="tab-button" onClick={() => setSelectedShipmentId(shipment.id)}>Detail</button></td>
        </tr>)}</tbody></table></div>
        <div className="space-y-3 md:hidden">{visibleShipments.map(shipment => <article className="rounded-xl border border-[var(--border)] p-3" key={shipment.id}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-[var(--accent)]">{shipment.shipment_number}</p><h3 className="mt-1 text-sm font-semibold">{supplierById.get(shipment.supplier_id)?.legal_name ?? "Supplier"} → {customerById.get(shipment.customer_id)?.legal_name ?? "Pelanggan"}</h3><p className="mt-1 text-xs text-[var(--muted)]">PO {poById.get(shipment.purchase_order_id)?.order_number ?? "—"} · SO {orderById.get(shipment.sales_order_id)?.order_number ?? "—"}</p></div><StatusBadge status={shipment.status} /></div>
          <p className="mt-3 text-xs text-[var(--muted)]">{displayDate(shipment.shipment_date)} · {shipment.tracking_number ? `Resi ${shipment.tracking_number}` : `SJ ${shipment.delivery_note_number ?? "—"}`}</p>
          <button type="button" className="tab-button mt-3 w-full justify-center" onClick={() => setSelectedShipmentId(shipment.id)}>Lihat detail & tindakan</button>
        </article>)}</div>
      </>}
    </section>

    {selectedShipment && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedShipmentId(""); }}>
      <section className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="shipment-detail-title">
        <div className="flex items-start justify-between gap-3"><div><p className="page-kicker">Detail pengiriman langsung</p><h2 id="shipment-detail-title" className="mt-1 text-xl font-bold">{selectedShipment.shipment_number}</h2></div><button type="button" className="icon-button" aria-label="Tutup detail" onClick={() => setSelectedShipmentId("")}>×</button></div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><StatusBadge status={selectedShipment.status} />{selectedShipment.status === "issue" && <span className="text-sm text-rose-700 dark:text-rose-300">{selectedShipment.issue_reason}</span>}</div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Detail label="PO supplier" value={poById.get(selectedShipment.purchase_order_id)?.order_number ?? "—"} />
          <Detail label="SO pelanggan" value={orderById.get(selectedShipment.sales_order_id)?.order_number ?? "—"} />
          <Detail label="Supplier pengirim" value={supplierById.get(selectedShipment.supplier_id)?.legal_name ?? "—"} />
          <Detail label="Pelanggan tujuan" value={customerById.get(selectedShipment.customer_id)?.legal_name ?? "—"} />
          <Detail label="Tanggal dokumen" value={displayDate(selectedShipment.shipment_date)} />
          <Detail label="Tanggal dikirim" value={displayDate(selectedShipment.shipped_at)} />
          <Detail label="Tanggal diterima" value={displayDate(selectedShipment.delivered_at)} />
          <Detail label="Kurir" value={selectedShipment.carrier || "—"} />
          <Detail label="Nomor resi" value={selectedShipment.tracking_number || "—"} />
          <Detail label="Surat jalan supplier" value={selectedShipment.delivery_note_number || "—"} />
        </div>
        <div className="mt-3 rounded-xl border border-[var(--border)] p-3"><p className="text-xs font-semibold text-[var(--muted)]">Alamat pelanggan · snapshot PO</p><p className="mt-1 text-sm">{selectedShipment.ship_to_address_snapshot}</p></div>
        <section className="mt-5"><h3 className="text-sm font-semibold">Item shipment</h3><div className="mt-2 space-y-2">{(linesByShipment.get(selectedShipment.id) ?? []).map(line => <div key={line.id} className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border)] p-3"><div><p className="text-sm font-medium">{line.product_name_snapshot}</p><p className="text-xs text-[var(--muted)]">Baris {line.line_number} · {line.product_code_snapshot}</p></div><strong className="whitespace-nowrap text-sm tabular-nums">{Number(line.quantity)} {line.unit_snapshot}</strong></div>)}</div></section>
        {selectedShipment.notes && <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-xs font-semibold text-[var(--muted)]">Catatan internal</p><p className="mt-1 text-sm">{selectedShipment.notes}</p></div>}
        <section className="mt-6"><h3 className="text-sm font-semibold">Riwayat status</h3><ol className="mt-3 space-y-3 border-l border-[var(--border)] pl-4">{(eventsByShipment.get(selectedShipment.id) ?? []).map(event => <li key={event.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" /><p className="text-sm font-medium">{statusLabel[event.new_status]} <span className="font-normal text-[var(--muted)]">· {displayDate(event.event_date)}</span></p>{event.note && <p className="mt-1 text-xs text-[var(--muted)]">{event.note}</p>}<p className="mt-1 text-[11px] text-[var(--muted)]">Dicatat {displayDateTime(event.occurred_at)}</p></li>)}</ol></section>
        {canWrite && <div className="mt-6 flex flex-wrap gap-2">{statusActions(selectedShipment)}</div>}
        {selectedShipment.status === "cancelled" && selectedShipment.cancelled_reason && <p className="mt-4 rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]">Alasan pembatalan: {selectedShipment.cancelled_reason}</p>}
      </section>
    </div>}

    {transitionTarget && pendingShipment && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setTransitionTarget(null); }}>
      <form className="card w-full max-w-lg p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="shipment-transition-title" onSubmit={saveTransition}>
        <div className="flex items-start justify-between gap-3"><div><p className="page-kicker">{pendingShipment.shipment_number}</p><h2 id="shipment-transition-title" className="mt-1 text-lg font-bold">{transitionTarget.status === "shipped" ? "Catat supplier sudah mengirim" : transitionTarget.status === "delivered" ? "Catat pelanggan menerima" : transitionTarget.status === "issue" ? "Catat kendala pengiriman" : "Batalkan draft shipment"}</h2></div><button type="button" className="icon-button" aria-label="Tutup" onClick={() => setTransitionTarget(null)}>×</button></div>
        <p className="mt-2 text-sm text-[var(--muted)]">Pembaruan ini hanya mencatat status dan riwayat di Jena; sistem tidak menghubungi kurir atau supplier.</p>
        <label className="mt-4 block text-xs text-[var(--muted)]">Tanggal kejadian<input className="field mt-1" type="date" required value={eventDate} onChange={event => setEventDate(event.target.value)} /></label>
        {transitionTarget.status !== "issue" && transitionTarget.status !== "cancelled" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[var(--muted)]">Kurir/ekspedisi<input className="field mt-1" value={transitionCarrier} onChange={event => setTransitionCarrier(event.target.value)} /></label>
          <label className="text-xs text-[var(--muted)]">Nomor resi<input className="field mt-1" value={transitionTracking} onChange={event => setTransitionTracking(event.target.value)} /></label>
          <label className="text-xs text-[var(--muted)] sm:col-span-2">Nomor surat jalan supplier<input className="field mt-1" value={transitionDeliveryNote} onChange={event => setTransitionDeliveryNote(event.target.value)} /></label>
        </div>}
        <label className="mt-3 block text-xs text-[var(--muted)]">{transitionTarget.status === "issue" ? "Rincian kendala (wajib)" : transitionTarget.status === "cancelled" ? "Alasan pembatalan (wajib)" : "Catatan (opsional)"}<textarea className="field mt-1 min-h-20 py-2" required={transitionTarget.status === "issue" || transitionTarget.status === "cancelled"} minLength={transitionTarget.status === "issue" || transitionTarget.status === "cancelled" ? 3 : undefined} value={eventNote} onChange={event => setEventNote(event.target.value)} placeholder="Catatan akan tersimpan pada timeline" /></label>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => setTransitionTarget(null)}>Kembali</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan status"}</button></div>
      </form>
    </div>}
  </div>;
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span>;
}
function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{detail}</p></article>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-[11px] text-[var(--muted)]">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>;
}
