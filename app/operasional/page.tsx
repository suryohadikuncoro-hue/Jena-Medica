"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Batch = { id: string; item: string; code: string; supplier: string; received: string; expiry: string; qty: number; cost: number; status: "Layak jual" | "Segera ED" | "Karantina" };
type Purchase = { id: string; supplier: string; date: string; eta: string; status: "Dipesan" | "Diterima sebagian" | "Selesai"; total: number; lines: number };

const seedBatches: Batch[] = [
  { id: "BT-26041", item: "Amoxicillin 500 mg", code: "AMX-500", supplier: "PT Sehat Farma", received: "08 Okt 2026", expiry: "31 Des 2027", qty: 2400, cost: 9800, status: "Layak jual" },
  { id: "BT-26018", item: "Paracetamol 500 mg", code: "PCM-500", supplier: "PT Medika Utama", received: "05 Okt 2026", expiry: "30 Nov 2026", qty: 3200, cost: 7900, status: "Segera ED" },
  { id: "BT-26027", item: "Vitamin C 500 mg", code: "VTC-500", supplier: "PT Sehat Farma", received: "07 Okt 2026", expiry: "30 Jun 2027", qty: 850, cost: 14500, status: "Layak jual" },
  { id: "BT-26011", item: "Omeprazole 20 mg", code: "OMP-020", supplier: "CV Mitra Medis", received: "02 Okt 2026", expiry: "31 Jan 2028", qty: 640, cost: 21000, status: "Karantina" },
];
const seedPurchases: Purchase[] = [
  { id: "PO-2026-0092", supplier: "PT Sehat Farma", date: "12 Okt 2026", eta: "15 Okt 2026", status: "Dipesan", total: 18500000, lines: 4 },
  { id: "PO-2026-0091", supplier: "PT Medika Utama", date: "10 Okt 2026", eta: "13 Okt 2026", status: "Diterima sebagian", total: 12400000, lines: 3 },
  { id: "PO-2026-0090", supplier: "CV Mitra Medis", date: "08 Okt 2026", eta: "11 Okt 2026", status: "Selesai", total: 8600000, lines: 2 },
];
const money = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8F24A]";
const badge: Record<Batch["status"], string> = { "Layak jual": "bg-emerald-400/15 text-emerald-300", "Segera ED": "bg-amber-300/15 text-amber-200", Karantina: "bg-rose-400/15 text-rose-300" };

export default function PurchasingInventoryPage() {
  const [tab, setTab] = useState<"Pembelian" | "Stok & batch">("Pembelian");
  const [purchases, setPurchases] = useState(seedPurchases);
  const [batches, setBatches] = useState(seedBatches);
  const [search, setSearch] = useState("");
  const [purchaseStatus, setPurchaseStatus] = useState("Semua status");
  const [batchStatus, setBatchStatus] = useState("Semua status");
  const [showReceive, setShowReceive] = useState(false);
  const [selectedPO, setSelectedPO] = useState(seedPurchases[0].id);
  const [qty, setQty] = useState("100");
  const [expiry, setExpiry] = useState("31 Des 2027");
  const [supplier, setSupplier] = useState("PT Sehat Farma");
  const [notice, setNotice] = useState("");

  const visiblePurchases = useMemo(() => purchases.filter((p) =>
    (purchaseStatus === "Semua status" || p.status === purchaseStatus) &&
    `${p.id} ${p.supplier} ${p.status}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [purchases, purchaseStatus, search]);
  const visibleBatches = useMemo(() => batches.filter((b) =>
    (batchStatus === "Semua status" || b.status === batchStatus) &&
    `${b.id} ${b.item} ${b.code} ${b.supplier}`.toLowerCase().includes(search.trim().toLowerCase())
  ).sort((a, b) => a.cost - b.cost), [batches, batchStatus, search]);
  const totalStock = batches.reduce((sum, b) => sum + b.qty, 0);
  const quarantineQty = batches.filter((b) => b.status === "Karantina").reduce((sum, b) => sum + b.qty, 0);
  const soonExpiryQty = batches.filter((b) => b.status === "Segera ED").reduce((sum, b) => sum + b.qty, 0);

  function receiveGoods() {
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) { setNotice("Jumlah penerimaan harus bilangan bulat lebih dari nol."); return; }
    const po = purchases.find((p) => p.id === selectedPO);
    if (!po) { setNotice("Pesanan pembelian tidak ditemukan."); return; }
    const id = `BT-SIM-${String(batches.length + 1).padStart(3, "0")}`;
    setBatches((prev) => [...prev, { id, item: "Barang penerimaan simulasi", code: "ITEM-SIM", supplier, received: "14 Okt 2026", expiry, qty: amount, cost: 0, status: "Karantina" }]);
    setPurchases((prev) => prev.map((p) => p.id === selectedPO ? { ...p, status: "Diterima sebagian" } : p));
    setShowReceive(false);
    setNotice(`Penerimaan ${amount} unit dicatat sebagai batch simulasi ${id} berstatus Karantina. Belum menambah stok operasional.`);
  }

  return (
    <main className="min-h-screen bg-[#ECEBFA] p-3 text-[#14172F] [background-image:radial-gradient(900px_circle_at_8%_0%,rgba(122,105,246,.2),transparent_60%),radial-gradient(700px_circle_at_96%_100%,rgba(184,242,74,.18),transparent_55%)]">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1600px] flex-col gap-5 rounded-[32px] bg-[#F8F8FF]/90 p-4 shadow-[0_24px_80px_rgba(62,50,160,.14)] ring-1 ring-white/80 backdrop-blur-xl sm:p-6">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8F24A] text-lg font-extrabold">J</span><div><p className="text-sm font-bold">Jena Medical Center</p><p className="text-[11px] text-[#5E6488]">Distribusi alat & obat medis</p></div></div>
          <nav className="ml-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-[#14172B] p-1" aria-label="Navigasi utama"><Link href="/" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Penjualan</Link><Link href="/master-data" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Master data</Link><Link href="/pengiriman-piutang" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Pengiriman & piutang</Link><Link href="/keuangan" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Keuangan</Link><span aria-current="page" className="rounded-full bg-[#5B45F0] px-4 py-2 text-[13px] text-white">Operasional</span></nav>
        </header>
        <section className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#6D55F2]">Operasional gudang</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Pembelian & persediaan</h1><p className="mt-1 text-sm text-[#5E6488]">Pantau pesanan, penerimaan, batch, dan tanggal kedaluwarsa.</p></div><button onClick={() => { setShowReceive((v) => !v); setNotice(""); }} className={`rounded-full bg-[#5B45F0] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(91,69,240,.25)] hover:bg-[#4A36DB] ${focus}`}>＋ Catat penerimaan</button></section>
        <section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Total unit batch (simulasi)</p><p className="mt-1 text-2xl font-semibold">{new Intl.NumberFormat("id-ID").format(totalStock)}</p></article><article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Unit segera ED</p><p className="mt-1 text-2xl font-semibold">{new Intl.NumberFormat("id-ID").format(soonExpiryQty)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Perlu pemeriksaan fisik</p></article><article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Unit karantina</p><p className="mt-1 text-2xl font-semibold">{new Intl.NumberFormat("id-ID").format(quarantineQty)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Tidak dihitung sebagai stok siap jual</p></article></section>
        {notice && <p role="status" className="rounded-xl border border-[#D8D2FF] bg-[#F0EDFF] px-4 py-3 text-sm text-[#4636C9]">{notice}</p>}
        {showReceive && <section className="rounded-2xl border border-[#D8D2FF] bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Catat penerimaan · simulasi</h2><p className="mt-1 text-xs text-[#8A8FB0]">Penerimaan belum mengubah stok operasional. Batch baru masuk karantina sampai diperiksa.</p></div><button onClick={() => setShowReceive(false)} className={`rounded-full px-3 py-1 text-sm text-[#5E6488] hover:bg-[#F1F0FC] ${focus}`}>Tutup</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-medium text-[#5E6488]">Pesanan<select value={selectedPO} onChange={(e) => setSelectedPO(e.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-[#E6E6F5] bg-white px-3 text-sm text-[#14172F]">{purchases.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.supplier}</option>)}</select></label><label className="text-xs font-medium text-[#5E6488]">Supplier<input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-[#E6E6F5] px-3 text-sm text-[#14172F]" /></label><label className="text-xs font-medium text-[#5E6488]">Jumlah diterima<input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-[#E6E6F5] px-3 text-sm text-[#14172F]" /></label><label className="text-xs font-medium text-[#5E6488]">ED batch<input value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-[#E6E6F5] px-3 text-sm text-[#14172F]" /></label></div><button onClick={receiveGoods} className={`mt-4 rounded-xl bg-[#14172B] px-5 py-3 text-sm font-semibold text-white ${focus}`}>Simpan penerimaan simulasi</button></section>}
        <section className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[28px] bg-[#14172B] p-4 text-white shadow-[0_24px_60px_rgba(20,23,43,.25)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-full bg-white/10 p-1" role="tablist" aria-label="Modul operasional">{(["Pembelian", "Stok & batch"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSearch(""); setNotice(""); }} className={`rounded-full px-5 py-2 text-sm font-medium ${focus} ${tab === t ? "bg-[#5B45F0] text-white" : "text-slate-300 hover:bg-white/10"}`}>{t}</button>)}</div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "Pembelian" ? "Cari nomor PO atau supplier" : "Cari barang, batch, atau supplier"} aria-label="Cari data operasional" className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[#B8F24A] sm:w-64 sm:flex-none" />{tab === "Pembelian" ? <select aria-label="Filter status pesanan" value={purchaseStatus} onChange={(e) => setPurchaseStatus(e.target.value)} className="h-10 rounded-full border border-white/15 bg-[#20243D] px-4 text-sm text-white"><option>Semua status</option><option>Dipesan</option><option>Diterima sebagian</option><option>Selesai</option></select> : <select aria-label="Filter status batch" value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)} className="h-10 rounded-full border border-white/15 bg-[#20243D] px-4 text-sm text-white"><option>Semua status</option><option>Layak jual</option><option>Segera ED</option><option>Karantina</option></select>}</div></div>
          {tab === "Pembelian" ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-xs text-slate-400">{["Nomor PO", "Supplier", "Tanggal", "Estimasi tiba", "Baris", "Nilai pesanan", "Status"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visiblePurchases.map((p) => <tr key={p.id} className="border-b border-white/[.07] transition hover:bg-white/[.04]"><td className="px-3 py-4 font-mono text-xs text-[#B8F24A]">{p.id}</td><td className="px-3 py-4 font-medium">{p.supplier}</td><td className="px-3 py-4 text-slate-300">{p.date}</td><td className="px-3 py-4 text-slate-300">{p.eta}</td><td className="px-3 py-4">{p.lines}</td><td className="px-3 py-4 tabular-nums">{money(p.total)}</td><td className="px-3 py-4"><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{p.status}</span></td></tr>)}</tbody></table>{visiblePurchases.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Pesanan tidak ditemukan. Ubah pencarian atau filter.</p>}<p className="mt-4 text-xs text-slate-400">Purchase order hanya mencatat pesanan. Stok tidak bertambah sebelum penerimaan fisik diverifikasi.</p></div>
          : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-xs text-slate-400">{["Batch", "Barang", "Supplier", "Tanggal terima", "ED", "Qty", "Harga beli contoh", "Status"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visibleBatches.map((b) => <tr key={b.id} className="border-b border-white/[.07] transition hover:bg-white/[.04]"><td className="px-3 py-4 font-mono text-xs text-[#B8F24A]">{b.id}</td><td className="px-3 py-4 font-medium">{b.item}<p className="mt-1 text-xs text-slate-400">{b.code}</p></td><td className="px-3 py-4 text-slate-300">{b.supplier}</td><td className="px-3 py-4 text-slate-300">{b.received}</td><td className="px-3 py-4 text-slate-300">{b.expiry}</td><td className="px-3 py-4 tabular-nums">{new Intl.NumberFormat("id-ID").format(b.qty)}</td><td className="px-3 py-4 tabular-nums">{money(b.cost)}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${badge[b.status]}`}>{b.status}</span></td></tr>)}</tbody></table>{visibleBatches.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Batch tidak ditemukan. Ubah pencarian atau filter.</p>}<p className="mt-4 text-xs text-slate-400">Data batch, harga beli, ED, dan status masih simulasi. Gunakan FEFO saat pengeluaran stok; barang karantina bukan stok siap jual.</p></div>}
        </section>
      </div>
    </main>
  );
}
