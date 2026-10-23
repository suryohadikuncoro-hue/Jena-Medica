"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type PO = { id: string; order_number: string; supplier_id: string; customer_id: string; sales_order_id: string; order_date: string; status: "draft" | "sent" | "acknowledged" | "cancelled"; estimated_total: number | string; notes: string | null };
type Party = { id: string; code: string; legal_name: string; phone?: string | null };
type Line = { purchase_order_id: string; line_number: number; product_code_snapshot: string; product_name_snapshot: string; unit_snapshot: string; quantity: number | string; quoted_unit_cost: number | string };
const money = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const dateLabel = (value: string) => new Date(`${value.slice(0,10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function SupplierOrdersManager() {
  const configured = isSupabaseConfigured();
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
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
      const [poResult, supplierResult, customerResult, lineResult] = await Promise.all([
        db.from("purchase_orders").select("id,order_number,supplier_id,customer_id,sales_order_id,order_date,status,estimated_total,notes").order("order_date", { ascending: false }).limit(500),
        db.from("suppliers").select("id,code,legal_name,phone").limit(500),
        db.from("customers").select("id,code,legal_name").limit(500),
        db.from("purchase_order_lines").select("purchase_order_id,line_number,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,quoted_unit_cost").order("line_number").limit(3000),
      ]);
      for (const result of [poResult, supplierResult, customerResult, lineResult]) if (result.error) throw result.error;
      setOrders((poResult.data ?? []) as PO[]);
      setSuppliers((supplierResult.data ?? []) as Party[]);
      setCustomers((customerResult.data ?? []) as Party[]);
      setLines((lineResult.data ?? []) as Line[]);
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
      <div><p className="page-kicker">Operasional · Pembelian drop-ship</p><h1 className="page-title">Pesanan Supplier</h1><p className="page-description">Bagikan rincian pesanan melalui WhatsApp, tandai setelah dikirim, lalu catat persetujuan supplier. Tidak ada pencatatan pengiriman.</p></div>
      <Link className="tab-button" href="/keuangan#jurnal">Faktur &amp; posting AP →</Link>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
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
