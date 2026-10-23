"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type PO = { id: string; order_number: string; supplier_id: string; customer_id: string; sales_order_id: string; order_date: string; status: "draft" | "sent" | "acknowledged" | "cancelled"; estimated_total: number | string; notes: string | null };
type Party = { id: string; code: string; legal_name: string; phone?: string | null };
type Line = { purchase_order_id: string; sales_order_line_id: string; line_number: number; product_code_snapshot: string; product_name_snapshot: string; unit_snapshot: string; quantity: number | string; quoted_unit_cost: number | string };
type SO = { id: string; order_number: string; customer_id: string; order_date: string; status: "draft" | "confirmed" | "cancelled" };
type SOLine = { id: string; sales_order_id: string; line_number: number; product_code_snapshot: string; product_name_snapshot: string; unit_snapshot: string; quantity: number | string };
type PODraftLine = { sales_order_line_id: string; included: boolean; quantity: string; quoted_unit_cost: string };
const money = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const dateLabel = (value: string) => new Date(`${value.slice(0,10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function SupplierOrdersManager() {
  const configured = isSupabaseConfigured();
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [sourceOrders, setSourceOrders] = useState<SO[]>([]);
  const [sourceLines, setSourceLines] = useState<SOLine[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceOrderId, setSourceOrderId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poDraftLines, setPoDraftLines] = useState<PODraftLine[]>([]);
  const [creatingPO, setCreatingPO] = useState(false);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const db = getSupabaseBrowserClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session) throw new Error("Masuk untuk melihat pesanan supplier.");
      const businessRole = String(session.user.app_metadata?.business_role ?? "");
      setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) throw new Error("Akun belum memiliki role bisnis yang valid.");
      const [poResult, supplierResult, customerResult, lineResult, soResult, soLineResult] = await Promise.all([
        db.from("purchase_orders").select("id,order_number,supplier_id,customer_id,sales_order_id,order_date,status,estimated_total,notes").order("order_date", { ascending: false }).limit(500),
        db.from("suppliers").select("id,code,legal_name,phone").limit(500),
        db.from("customers").select("id,code,legal_name").limit(500),
        db.from("purchase_order_lines").select("purchase_order_id,sales_order_line_id,line_number,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,quoted_unit_cost").order("line_number").limit(3000),
        db.from("sales_orders").select("id,order_number,customer_id,order_date,status").in("status", ["draft", "confirmed"]).order("order_date", { ascending: false }).limit(500),
        db.from("sales_order_lines").select("id,sales_order_id,line_number,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity").order("line_number").limit(3000),
      ]);
      for (const result of [poResult, supplierResult, customerResult, lineResult, soResult, soLineResult]) if (result.error) throw result.error;
      setOrders((poResult.data ?? []) as PO[]);
      setSuppliers((supplierResult.data ?? []) as Party[]);
      setCustomers((customerResult.data ?? []) as Party[]);
      setLines((lineResult.data ?? []) as Line[]);
      setSourceOrders((soResult.data ?? []) as SO[]);
      setSourceLines((soLineResult.data ?? []) as SOLine[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat pesanan supplier."); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  const supplierById = useMemo(() => new Map(suppliers.map(row => [row.id, row])), [suppliers]);
  const customerById = useMemo(() => new Map(customers.map(row => [row.id, row])), [customers]);
  const linesByPO = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const line of lines) map.set(line.purchase_order_id, [...(map.get(line.purchase_order_id) ?? []), line]);
    return map;
  }, [lines]);
  const visible = orders.filter(po => {
    const supplier = supplierById.get(po.supplier_id);
    const customer = customerById.get(po.customer_id);
    return `${po.order_number} ${supplier?.legal_name ?? ""} ${customer?.legal_name ?? ""} ${po.status}`.toLowerCase().includes(search.trim().toLowerCase());
  });

  const selectedSourceOrder = sourceOrders.find(row => row.id === sourceOrderId);
  const selectedSourceLines = sourceLines.filter(line => line.sales_order_id === sourceOrderId);
  const reservedBySourceLine = useMemo(() => {
    const result = new Map<string, number>();
    for (const line of lines) {
      const parent = orders.find(po => po.id === line.purchase_order_id);
      if (!parent || parent.status === "cancelled") continue;
      result.set(line.sales_order_line_id, (result.get(line.sales_order_line_id) ?? 0) + Number(line.quantity));
    }
    return result;
  }, [lines, orders]);

  function chooseSourceOrder(id: string) {
    setSourceOrderId(id);
    setPoDraftLines(sourceLines.filter(line => line.sales_order_id === id).map(line => ({
      sales_order_line_id: line.id, included: false,
      quantity: String(Math.max(0, Number(line.quantity) - (reservedBySourceLine.get(line.id) ?? 0))),
      quoted_unit_cost: "",
    })));
  }

  function updatePODraftLine(id: string, patch: Partial<PODraftLine>) {
    setPoDraftLines(current => current.map(line => line.sales_order_line_id === id ? { ...line, ...patch } : line));
  }

  async function createPurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!canWrite) { setError("Role Owner/Admin diperlukan untuk membuat pesanan supplier."); return; }
    if (!supplierId || !sourceOrderId) { setError("Pilih supplier dan pesanan pelanggan."); return; }
    const chosen = poDraftLines.filter(line => line.included);
    if (!chosen.length) { setError("Pilih minimal satu baris pesanan untuk supplier ini."); return; }
    const payloadLines = chosen.map(line => ({ sales_order_line_id: line.sales_order_line_id, quantity: Number(line.quantity), quoted_unit_cost: Number(line.quoted_unit_cost) }));
    if (payloadLines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.quoted_unit_cost) || line.quoted_unit_cost < 0)) {
      setError("Kuantitas harus lebih dari 0 dan estimasi harga supplier harus angka nol atau lebih."); return;
    }
    setCreatingPO(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("create_purchase_order", {
        p_supplier_id: supplierId, p_sales_order_id: sourceOrderId,
        p_expected_delivery_date: expectedDate || null, p_notes: poNotes.trim() || null, p_lines: payloadLines,
      });
      if (rpcError) throw rpcError;
      setCreateOpen(false); setSourceOrderId(""); setSupplierId(""); setExpectedDate(""); setPoNotes(""); setPoDraftLines([]);
      setNotice("Pesanan supplier dibuat. Bagikan melalui WhatsApp, tandai setelah terkirim, lalu catat persetujuan supplier sebelum mengonfirmasi pesanan pelanggan.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pesanan supplier gagal dibuat. Pastikan migration D-12 sudah diterapkan."); }
    finally { setCreatingPO(false); }
  }

  function whatsappMessage(po: PO) {
    const supplier = supplierById.get(po.supplier_id);
    const customer = customerById.get(po.customer_id);
    const detail = linesByPO.get(po.id) ?? [];
    return [
      `PESANAN JENA MEDICAL CENTER`,
      `Nomor: ${po.order_number}`,
      `Tanggal: ${dateLabel(po.order_date)}`,
      `Supplier: ${supplier?.legal_name ?? "—"}`,
      `Pelanggan tujuan: ${customer?.legal_name ?? "—"}`,
      "",
      ...detail.map(line => `${line.line_number}. ${line.product_name_snapshot} (${line.product_code_snapshot}) — ${line.quantity} ${line.unit_snapshot} × ${money(line.quoted_unit_cost)}`),
      "",
      `Estimasi total: ${money(po.estimated_total)}`,
      po.notes ? `Catatan: ${po.notes}` : "",
      "",
      "Mohon konfirmasi ketersediaan dan persetujuan harga/jumlah pesanan ini melalui balasan WhatsApp. Pesanan dianggap disetujui setelah kami mencatat konfirmasi Anda.",
    ].filter(Boolean).join("\n");
  }

  function shareWhatsApp(po: PO) {
    const supplier = supplierById.get(po.supplier_id);
    const phone = (supplier?.phone ?? "").replace(/[^0-9]/g, "").replace(/^0/, "62");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(po))}`;
    if (phone) window.open(url, "_blank", "noopener,noreferrer");
    else window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage(po))}`, "_blank", "noopener,noreferrer");
    setNotice("WhatsApp dibuka dengan draf pesanan. Setelah benar-benar dikirim, tekan “Tandai sudah dikirim” agar status tidak salah.");
  }

  async function transition(po: PO, status: "sent" | "acknowledged") {
    setBusyId(po.id); setError(""); setNotice("");
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("set_purchase_order_status", { p_purchase_order_id: po.id, p_new_status: status });
      if (rpcError) throw rpcError;
      setNotice(status === "sent" ? `Pesanan ${po.order_number} ditandai sudah dikirim.` : `Persetujuan supplier untuk ${po.order_number} tercatat.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Status pesanan tidak dapat diperbarui."); }
    finally { setBusyId(""); }
  }

  const statusLabel: Record<PO["status"], string> = { draft: "Draft", sent: "Menunggu persetujuan", acknowledged: "Disetujui supplier", cancelled: "Dibatalkan" };
  return <main className="page-wrap">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="page-kicker">Operasional · Pembelian drop-ship</p><h1 className="page-title">Pesanan Supplier</h1><p className="page-description">Buat pesanan supplier dari SO draft, bagikan via WhatsApp, lalu catat persetujuan sebelum SO dikonfirmasi. Tidak ada pencatatan pengiriman.</p></div>
      <div className="flex gap-2"><Link className="tab-button" href="/keuangan#jurnal">Faktur &amp; posting AP →</Link>{canWrite && <button type="button" className="primary-button" onClick={() => { setCreateOpen(value => !value); setError(""); setNotice(""); }}>＋ Buat pesanan supplier</button>}</div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {createOpen && <form className="card card-pad mb-5" onSubmit={createPurchaseOrder}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Buat pesanan supplier</h2><p className="mt-1 text-xs text-[var(--muted)]">Pilih sebagian atau seluruh baris SO. Jika pembelian dipecah ke beberapa supplier, buat PO terpisah untuk sisa kuantitas.</p></div><button type="button" className="tab-button" onClick={() => setCreateOpen(false)}>Tutup</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Pesanan pelanggan<select className="field mt-1" required value={sourceOrderId} onChange={event => chooseSourceOrder(event.target.value)}><option value="">Pilih SO draft/terkonfirmasi…</option>{sourceOrders.map(so => <option key={so.id} value={so.id}>{so.order_number} · {customerById.get(so.customer_id)?.legal_name ?? "Pelanggan"} · {so.status === "draft" ? "Draft — perlu persetujuan supplier" : "Terkonfirmasi"}</option>)}</select></label>
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Supplier<select className="field mt-1" required value={supplierId} onChange={event => setSupplierId(event.target.value)}><option value="">Pilih supplier…</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.legal_name}</option>)}</select></label>
        <label className="text-xs text-[var(--muted)]">Tanggal perkiraan (opsional)<input className="field mt-1" type="date" value={expectedDate} onChange={event => setExpectedDate(event.target.value)} /></label>
        <label className="text-xs text-[var(--muted)] sm:col-span-3">Catatan untuk supplier (opsional)<input className="field mt-1" maxLength={1000} value={poNotes} onChange={event => setPoNotes(event.target.value)} placeholder="Catatan singkat untuk pesanan ini" /></label>
      </div>
      {sourceOrderId && <div className="mt-4 space-y-3">{selectedSourceLines.map(line => {
        const draftLine = poDraftLines.find(item => item.sales_order_line_id === line.id);
        const available = Math.max(0, Number(line.quantity) - (reservedBySourceLine.get(line.id) ?? 0));
        return <div key={line.id} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[auto_1fr_120px_150px] sm:items-center">
          <input aria-label={`Pilih ${line.product_name_snapshot}`} type="checkbox" disabled={available <= 0} checked={draftLine?.included ?? false} onChange={event => updatePODraftLine(line.id, { included: event.target.checked })} />
          <div><p className="text-sm font-medium">{line.product_name_snapshot}</p><p className="text-xs text-[var(--muted)]">{line.product_code_snapshot} · {line.quantity} {line.unit_snapshot} di SO · tersedia untuk dialokasikan {available}</p></div>
          <label className="text-xs text-[var(--muted)]">Kuantitas<input className="field mt-1" type="number" min="0.0001" max={available} step="0.0001" disabled={!draftLine?.included} value={draftLine?.quantity ?? ""} onChange={event => updatePODraftLine(line.id, { quantity: event.target.value })} /></label>
          <label className="text-xs text-[var(--muted)]">Estimasi harga/unit (Rp)<input className="field mt-1" type="number" min="0" step="0.01" disabled={!draftLine?.included} value={draftLine?.quoted_unit_cost ?? ""} onChange={event => updatePODraftLine(line.id, { quoted_unit_cost: event.target.value })} /></label>
        </div>;
      })}{selectedSourceLines.length === 0 && <p className="text-sm text-[var(--muted)]">SO ini tidak memiliki baris item.</p>}</div>}
      {selectedSourceOrder?.status === "draft" && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">SO draft dapat disourcing terlebih dahulu. SO baru bisa dikonfirmasi setelah semua kuantitas dialokasikan ke PO aktif dan seluruh supplier menyetujui pesanannya.</p>}
      <div className="mt-4 flex justify-end"><button className="primary-button" type="submit" disabled={creatingPO || !canWrite}>{creatingPO ? "Menyimpan…" : "Simpan pesanan supplier"}</button></div>
    </form>}
    <section className="card card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Daftar pesanan</h2><input className="field max-w-sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nomor, supplier, pelanggan…" /></div>
      {loading ? <p className="py-8 text-sm text-[var(--muted)]">Memuat pesanan…</p> : visible.length === 0 ? <p className="py-8 text-sm text-[var(--muted)]">Belum ada pesanan yang cocok.</p> :
        <div className="space-y-3">{visible.map(po => {
          const supplier = supplierById.get(po.supplier_id);
          const customer = customerById.get(po.customer_id);
          const poLines = linesByPO.get(po.id) ?? [];
          return <article key={po.id} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{po.order_number}</p><p className="mt-1 text-sm">{supplier?.legal_name ?? "Supplier tidak ditemukan"} <span className="text-[var(--muted)]">→</span> {customer?.legal_name ?? "Pelanggan tidak ditemukan"}</p><p className="mt-1 text-xs text-[var(--muted)]">{dateLabel(po.order_date)} · {poLines.length} baris · {statusLabel[po.status]}</p></div><p className="font-semibold">{money(po.estimated_total)}</p></div>
            <div className="mt-3 space-y-1 text-sm">{poLines.map(line => <p key={`${po.id}-${line.line_number}`}>{line.line_number}. {line.product_name_snapshot} — {line.quantity} {line.unit_snapshot} × {money(line.quoted_unit_cost)}</p>)}</div>
            {po.notes && <p className="mt-2 text-xs text-[var(--muted)]">Catatan: {po.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {po.status !== "cancelled" && <button className="tab-button" type="button" onClick={() => shareWhatsApp(po)}>Bagikan via WhatsApp</button>}
              {canWrite && po.status === "draft" && <button className="primary-button" type="button" disabled={busyId === po.id} onClick={() => void transition(po, "sent")}>{busyId === po.id ? "Menyimpan…" : "Tandai sudah dikirim"}</button>}
              {canWrite && po.status === "sent" && <button className="primary-button" type="button" disabled={busyId === po.id} onClick={() => void transition(po, "acknowledged")}>{busyId === po.id ? "Menyimpan…" : "Catat supplier setuju"}</button>}
            </div>
          </article>;
        })}</div>}
    </section>
    <p className="mt-4 text-xs text-[var(--muted)]">Catatan: halaman ini mengelola pesanan supplier yang sudah ada. Pembuatan/pecah PO tetap mengikuti alur yang tersedia di aplikasi. Status dikunci oleh RPC database, bukan hanya oleh tampilan.</p>
  </main>;
}
