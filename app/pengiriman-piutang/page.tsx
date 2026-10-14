"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Delivery = { id: string; invoice: string; customer: string; city: string; date: string; status: "Menunggu" | "Dalam perjalanan" | "Terkirim" | "Gagal"; amount: number };
type Receivable = { invoice: string; customer: string; date: string; due: string; amount: number; paid: number };
const initialDeliveries: Delivery[] = [
 { id: "SJ-2026-0148", invoice: "INV-2026-0148", customer: "Apotek Sehat Sentosa", city: "Lamongan", date: "14 Okt 2026", status: "Menunggu", amount: 12450000 },
 { id: "SJ-2026-0147", invoice: "INV-2026-0147", customer: "Klinik Medika Utama", city: "Gresik", date: "13 Okt 2026", status: "Dalam perjalanan", amount: 8750000 },
 { id: "SJ-2026-0146", invoice: "INV-2026-0146", customer: "RS Anugerah", city: "Surabaya", date: "12 Okt 2026", status: "Terkirim", amount: 6120000 },
 { id: "SJ-2026-0145", invoice: "INV-2026-0145", customer: "Apotek Kencana", city: "Lamongan", date: "12 Okt 2026", status: "Gagal", amount: 7320000 },
];
const initialAR: Receivable[] = [
 { invoice: "INV-2026-0148", customer: "Apotek Sehat Sentosa", date: "13 Okt 2026", due: "27 Okt 2026", amount: 12450000, paid: 0 },
 { invoice: "INV-2026-0147", customer: "Klinik Medika Utama", date: "13 Okt 2026", due: "28 Okt 2026", amount: 8750000, paid: 2500000 },
 { invoice: "INV-2026-0145", customer: "Apotek Kencana", date: "11 Okt 2026", due: "26 Okt 2026", amount: 7320000, paid: 0 },
 { invoice: "INV-2026-0144", customer: "Klinik Bina Sehat", date: "10 Okt 2026", due: "24 Okt 2026", amount: 5680000, paid: 0 },
];
const money = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8F24A]";
const deliveryTone: Record<Delivery["status"], string> = { Menunggu: "bg-amber-300/15 text-amber-200", "Dalam perjalanan": "bg-sky-400/15 text-sky-200", Terkirim: "bg-emerald-400/15 text-emerald-300", Gagal: "bg-rose-400/15 text-rose-300" };

export default function ShippingReceivablesPage() {
 const [tab, setTab] = useState<"Pengiriman" | "Piutang">("Pengiriman");
 const [deliveries, setDeliveries] = useState(initialDeliveries);
 const [receivables, setReceivables] = useState(initialAR);
 const [search, setSearch] = useState("");
 const [deliveryStatus, setDeliveryStatus] = useState("Semua status");
 const [showUpdate, setShowUpdate] = useState(false);
 const [selectedDelivery, setSelectedDelivery] = useState(initialDeliveries[0].id);
 const [nextStatus, setNextStatus] = useState<Delivery["status"]>("Dalam perjalanan");
 const [selectedAR, setSelectedAR] = useState(initialAR[0].invoice);
 const [payment, setPayment] = useState("");
 const [notice, setNotice] = useState("");

 const visibleDeliveries = useMemo(() => deliveries.filter(d =>
  (deliveryStatus === "Semua status" || d.status === deliveryStatus) &&
  `${d.id} ${d.invoice} ${d.customer} ${d.city} ${d.status}`.toLowerCase().includes(search.trim().toLowerCase())
 ), [deliveries, deliveryStatus, search]);
 const visibleAR = useMemo(() => receivables.filter(a =>
  `${a.invoice} ${a.customer}`.toLowerCase().includes(search.trim().toLowerCase())
 ), [receivables, search]);
 const outstanding = receivables.reduce((s, a) => s + Math.max(0, a.amount - a.paid), 0);
 const totalPaid = receivables.reduce((s, a) => s + a.paid, 0);

 function saveDelivery() {
  setDeliveries(prev => prev.map(d => d.id === selectedDelivery ? { ...d, status: nextStatus } : d));
  setShowUpdate(false);
  setNotice(`Status ${selectedDelivery} diperbarui di data simulasi menjadi "${nextStatus}".${nextStatus === "Gagal" ? " Barang wajib diperiksa sebelum stok dikembalikan." : ""}`);
 }
 function recordPayment() {
  const amount = Number(payment);
  const row = receivables.find(a => a.invoice === selectedAR);
  if (!row) { setNotice("Faktur piutang tidak ditemukan."); return; }
  if (!Number.isFinite(amount) || amount <= 0) { setNotice("Nominal pembayaran harus lebih dari nol."); return; }
  const due = row.amount - row.paid;
  if (amount > due) { setNotice("Nominal melebihi sisa piutang. Uang muka/kelebihan pembayaran harus dicatat terpisah."); return; }
  setReceivables(prev => prev.map(a => a.invoice === selectedAR ? { ...a, paid: a.paid + amount } : a));
  setPayment("");
  setNotice(`Pembayaran ${money(amount)} dicatat untuk ${selectedAR} dalam data simulasi. Belum ada jurnal atau transaksi aktual.`);
 }

 return <main className="min-h-screen bg-[#ECEBFA] p-3 text-[#14172F] [background-image:radial-gradient(900px_circle_at_8%_0%,rgba(122,105,246,.2),transparent_60%),radial-gradient(700px_circle_at_96%_100%,rgba(184,242,74,.18),transparent_55%)]">
  <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1600px] flex-col gap-5 rounded-[32px] bg-[#F8F8FF]/90 p-4 shadow-[0_24px_80px_rgba(62,50,160,.14)] ring-1 ring-white/80 backdrop-blur-xl sm:p-6">
   <header className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8F24A] text-lg font-extrabold">J</span><div><p className="text-sm font-bold">Jena Medical Center</p><p className="text-[11px] text-[#5E6488]">Distribusi alat & obat medis</p></div></div><nav className="ml-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-[#14172B] p-1" aria-label="Navigasi utama"><Link href="/dashboard" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Dashboard</Link><Link href="/" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Penjualan</Link><Link href="/master-data" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Master data</Link><Link href="/operasional" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Operasional</Link><Link href="/keuangan" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Keuangan</Link><span aria-current="page" className="rounded-full bg-[#5B45F0] px-4 py-2 text-[13px] text-white">Pengiriman & piutang</span></nav></header>
   <section className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#6D55F2]">Penjualan & penagihan</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Pengiriman & piutang</h1><p className="mt-1 text-sm text-[#5E6488]">Pantau serah terima barang, pembayaran parsial, dan sisa tagihan.</p></div></section>
   <section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Sisa piutang (contoh)</p><p className="mt-1 text-2xl font-semibold">{money(outstanding)}</p></article><article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Pembayaran tercatat (contoh)</p><p className="mt-1 text-2xl font-semibold">{money(totalPaid)}</p></article><article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Pengiriman perlu tindak lanjut</p><p className="mt-1 text-2xl font-semibold">{deliveries.filter(d => d.status === "Menunggu" || d.status === "Gagal").length}</p><p className="mt-1 text-xs text-[#8A8FB0]">Status gagal memerlukan pemeriksaan fisik</p></article></section>
   {notice && <p role="status" className="rounded-xl border border-[#D8D2FF] bg-[#F0EDFF] px-4 py-3 text-sm text-[#4636C9]">{notice}</p>}
   <section className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[28px] bg-[#14172B] p-4 text-white shadow-[0_24px_60px_rgba(20,23,43,.25)] sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-full bg-white/10 p-1" role="tablist" aria-label="Modul"><button role="tab" aria-selected={tab === "Pengiriman"} onClick={() => { setTab("Pengiriman"); setSearch(""); setNotice(""); }} className={`rounded-full px-5 py-2 text-sm ${focus} ${tab === "Pengiriman" ? "bg-[#5B45F0] text-white" : "text-slate-300"}`}>Pengiriman</button><button role="tab" aria-selected={tab === "Piutang"} onClick={() => { setTab("Piutang"); setSearch(""); setNotice(""); }} className={`rounded-full px-5 py-2 text-sm ${focus} ${tab === "Piutang" ? "bg-[#5B45F0] text-white" : "text-slate-300"}`}>Piutang</button></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === "Pengiriman" ? "Cari surat jalan, faktur, pelanggan, kota" : "Cari nomor faktur atau pelanggan"} aria-label="Cari pengiriman atau piutang" className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[#B8F24A] sm:w-72 sm:flex-none"/>{tab === "Pengiriman" && <select aria-label="Filter status pengiriman" value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)} className="h-10 rounded-full border border-white/15 bg-[#20243D] px-4 text-sm text-white"><option>Semua status</option><option>Menunggu</option><option>Dalam perjalanan</option><option>Terkirim</option><option>Gagal</option></select>}</div></div>
    {tab === "Pengiriman" ? <><div className="mt-4 flex justify-end"><button onClick={() => { setShowUpdate(v => !v); setNotice(""); }} className={`rounded-full bg-[#B8F24A] px-4 py-2 text-sm font-semibold text-[#14172F] ${focus}`}>Perbarui status</button></div>{showUpdate && <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-4 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs text-slate-300">Surat jalan<select value={selectedDelivery} onChange={e => setSelectedDelivery(e.target.value)} className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-[#20243D] px-3 text-sm text-white">{deliveries.map(d => <option key={d.id} value={d.id}>{d.id} · {d.customer}</option>)}</select></label><label className="text-xs text-slate-300">Status baru<select value={nextStatus} onChange={e => setNextStatus(e.target.value as Delivery["status"])} className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-[#20243D] px-3 text-sm text-white">{(["Menunggu","Dalam perjalanan","Terkirim","Gagal"] as const).map(s => <option key={s}>{s}</option>)}</select></label><button onClick={saveDelivery} className={`self-end rounded-xl bg-[#5B45F0] px-4 py-3 text-sm font-semibold text-white ${focus}`}>Simpan simulasi</button></div>}<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-xs text-slate-400">{["Surat jalan","Faktur","Pelanggan","Kota","Tanggal","Nilai","Status"].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visibleDeliveries.map(d => <tr key={d.id} className="border-b border-white/[.07] hover:bg-white/[.04]"><td className="px-3 py-4 font-mono text-xs text-[#B8F24A]">{d.id}</td><td className="px-3 py-4 text-xs">{d.invoice}</td><td className="px-3 py-4 font-medium">{d.customer}</td><td className="px-3 py-4 text-slate-300">{d.city}</td><td className="px-3 py-4 text-slate-300">{d.date}</td><td className="px-3 py-4 tabular-nums">{money(d.amount)}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${deliveryTone[d.status]}`}>{d.status}</span></td></tr>)}</tbody></table>{visibleDeliveries.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Pengiriman tidak ditemukan.</p>}</div><p className="mt-3 text-xs text-slate-400">Data pengiriman masih simulasi. Jika pengiriman gagal, periksa barang fisik sebelum mengembalikannya ke stok.</p></>
    : <><div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-4 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs text-slate-300">Faktur<select value={selectedAR} onChange={e => setSelectedAR(e.target.value)} className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-[#20243D] px-3 text-sm text-white">{receivables.map(a => <option key={a.invoice} value={a.invoice}>{a.invoice} · {a.customer}</option>)}</select></label><label className="text-xs text-slate-300">Nominal pembayaran<input type="number" min="1" value={payment} onChange={e => setPayment(e.target.value)} placeholder="Contoh: 2500000" className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400"/></label><button onClick={recordPayment} className={`self-end rounded-xl bg-[#B8F24A] px-4 py-3 text-sm font-semibold text-[#14172F] ${focus}`}>Catat pembayaran simulasi</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-xs text-slate-400">{["Faktur","Pelanggan","Tanggal","Jatuh tempo","Nilai faktur","Dibayar","Sisa piutang"].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visibleAR.map(a => <tr key={a.invoice} className="border-b border-white/[.07] hover:bg-white/[.04]"><td className="px-3 py-4 font-mono text-xs text-[#B8F24A]">{a.invoice}</td><td className="px-3 py-4 font-medium">{a.customer}</td><td className="px-3 py-4 text-slate-300">{a.date}</td><td className="px-3 py-4 text-slate-300">{a.due}</td><td className="px-3 py-4 tabular-nums">{money(a.amount)}</td><td className="px-3 py-4 tabular-nums">{money(a.paid)}</td><td className="px-3 py-4 tabular-nums">{money(Math.max(0,a.amount-a.paid))}</td></tr>)}</tbody></table>{visibleAR.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Piutang tidak ditemukan.</p>}</div><p className="mt-3 text-xs text-slate-400">Pembayaran parsial didukung pada data simulasi. Belum ada alokasi pembayaran, jurnal akuntansi, atau data bank aktual.</p></>}
   </section>
  </div>
 </main>;
}
