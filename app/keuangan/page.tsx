"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CashType = "Masuk" | "Keluar";
type CashEntry = { id: string; date: string; description: string; category: string; type: CashType; amount: number };
type Payable = { supplier: string; invoice: string; due: string; amount: number; paid: number };
const seedCash: CashEntry[] = [
  { id: "KAS-0261", date: "14 Okt 2026", description: "Pembayaran faktur RS Anugerah", category: "Penerimaan pelanggan", type: "Masuk", amount: 6120000 },
  { id: "KAS-0260", date: "13 Okt 2026", description: "Pembayaran sebagian Klinik Medika Utama", category: "Penerimaan pelanggan", type: "Masuk", amount: 2500000 },
  { id: "KAS-0259", date: "12 Okt 2026", description: "Pembelian persediaan", category: "Pembelian", type: "Keluar", amount: 4200000 },
  { id: "KAS-0258", date: "10 Okt 2026", description: "Biaya operasional gudang", category: "Operasional", type: "Keluar", amount: 1250000 },
  { id: "KAS-0257", date: "08 Okt 2026", description: "Pembayaran faktur Apotek Kencana", category: "Penerimaan pelanggan", type: "Masuk", amount: 3000000 },
];
const seedPayables: Payable[] = [
  { supplier: "PT Sehat Farma", invoice: "FP-2026-092", due: "18 Okt 2026", amount: 18500000, paid: 4000000 },
  { supplier: "PT Medika Utama", invoice: "FP-2026-091", due: "16 Okt 2026", amount: 12400000, paid: 0 },
  { supplier: "CV Mitra Medis", invoice: "FP-2026-090", due: "20 Okt 2026", amount: 8600000, paid: 2500000 },
];
const fmtMoney = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8F24A]";
const demoPL = { sales: 42500000, salesReturns: 800000, cogs: 30200000, operating: 4250000, otherIncome: 0, otherExpense: 350000 };
const monthOptions = ["Okt 2026", "Sep 2026", "Agu 2026", "Semua periode"];

export default function FinanceReportsPage() {
  const [tab, setTab] = useState<"Ikhtisar" | "Arus kas" | "Laba rugi" | "Utang & piutang">("Ikhtisar");
  const [cashEntries, setCashEntries] = useState(seedCash);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("Okt 2026");
  const [showForm, setShowForm] = useState(false);
  const [cashType, setCashType] = useState<CashType>("Keluar");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Operasional");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");

  const periodCash = useMemo(() => cashEntries.filter((entry) =>
    period === "Semua periode" || (entry.date.endsWith(period.split(" ")[1]) && entry.date.includes(period.split(" ")[0]))
  ), [cashEntries, period]);
  const visibleCash = useMemo(() => periodCash.filter((entry) =>
    `${entry.id} ${entry.description} ${entry.category} ${entry.type}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [periodCash, search]);
  const cashIn = periodCash.filter((e) => e.type === "Masuk").reduce((sum, e) => sum + e.amount, 0);
  const cashOut = periodCash.filter((e) => e.type === "Keluar").reduce((sum, e) => sum + e.amount, 0);
  const netCashflow = cashIn - cashOut;
  const outstandingAR = 31700000;
  const outstandingAP = seedPayables.reduce((sum, p) => sum + Math.max(0, p.amount - p.paid), 0);
  const grossProfit = demoPL.sales - demoPL.salesReturns - demoPL.cogs;
  const netProfit = grossProfit + demoPL.otherIncome - demoPL.operating - demoPL.otherExpense;

  function addCashEntry() {
    const cleanDescription = description.trim();
    const value = Number(amount);
    if (!cleanDescription) { setNotice("Deskripsi transaksi wajib diisi."); return; }
    if (!Number.isFinite(value) || value <= 0) { setNotice("Nominal harus berupa angka lebih dari nol."); return; }
    const id = `KAS-SIM-${String(cashEntries.length + 1).padStart(3, "0")}`;
    const entryPeriod = period === "Semua periode" ? "Okt 2026" : period;
    const [entryMonth, entryYear] = entryPeriod.split(" ");
    setCashEntries((prev) => [{ id, date: `14 ${entryMonth} ${entryYear}`, description: cleanDescription, category, type: cashType, amount: value }, ...prev]);
    setDescription(""); setAmount(""); setShowForm(false);
    setNotice(`Transaksi ${id} ditambahkan ke data simulasi. Belum memengaruhi saldo bank atau buku besar.`);
  }

  return (
    <main className="min-h-screen bg-[#ECEBFA] p-3 text-[#14172F] [background-image:radial-gradient(900px_circle_at_8%_0%,rgba(122,105,246,.2),transparent_60%),radial-gradient(700px_circle_at_96%_100%,rgba(184,242,74,.18),transparent_55%)]">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1600px] flex-col gap-5 rounded-[32px] bg-[#F8F8FF]/90 p-4 shadow-[0_24px_80px_rgba(62,50,160,.14)] ring-1 ring-white/80 backdrop-blur-xl sm:p-6">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8F24A] text-lg font-extrabold">J</span><div><p className="text-sm font-bold">Jena Medical Center</p><p className="text-[11px] text-[#5E6488]">Distribusi alat & obat medis</p></div></div>
          <nav className="ml-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-[#14172B] p-1" aria-label="Navigasi utama">
            <Link href="/dashboard" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Dashboard</Link>
            <Link href="/" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Penjualan</Link>
            <Link href="/master-data" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Master data</Link>
            <Link href="/operasional" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Operasional</Link>
            <Link href="/pengiriman-piutang" className={`rounded-full px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10 ${focus}`}>Pengiriman & piutang</Link>
            <span aria-current="page" className="rounded-full bg-[#5B45F0] px-4 py-2 text-[13px] text-white">Keuangan</span>
          </nav>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#6D55F2]">Kontrol finansial</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Keuangan & laporan</h1><p className="mt-1 text-sm text-[#5E6488]">Pisahkan pergerakan kas, laba, piutang, dan utang agar angka tidak tercampur.</p></div>
          <label className="text-xs font-medium text-[#5E6488]">Periode transaksi kas<select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 block h-11 rounded-xl border border-[#E6E6F5] bg-white px-3 text-sm text-[#14172F]">{monthOptions.map((m) => <option key={m}>{m}</option>)}</select></label>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Kas masuk (simulasi)</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtMoney(cashIn)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Berdasarkan daftar transaksi kas</p></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Kas keluar (simulasi)</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtMoney(cashOut)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Berdasarkan daftar transaksi kas</p></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Arus kas bersih (simulasi)</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtMoney(netCashflow)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Kas masuk dikurangi kas keluar</p></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Laba bersih ilustrasi</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtMoney(netProfit)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Tidak sama dengan saldo kas</p></article>
        </section>

        {notice && <p role="status" className="rounded-xl border border-[#D8D2FF] bg-[#F0EDFF] px-4 py-3 text-sm text-[#4636C9]">{notice}</p>}

        <section className="flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-[28px] bg-[#14172B] p-4 text-white shadow-[0_24px_60px_rgba(20,23,43,.25)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full bg-white/10 p-1" role="tablist" aria-label="Laporan keuangan">
              {(["Ikhtisar", "Arus kas", "Laba rugi", "Utang & piutang"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSearch(""); setNotice(""); }} className={`rounded-full px-4 py-2 text-sm font-medium ${focus} ${tab === t ? "bg-[#5B45F0] text-white" : "text-slate-300 hover:bg-white/10"}`}>{t}</button>)}
            </div>
            {tab === "Arus kas" && <div className="flex flex-wrap gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari transaksi atau kategori" aria-label="Cari transaksi kas" className="h-10 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[#B8F24A]" /><button onClick={() => { setShowForm((v) => !v); setNotice(""); }} className={`rounded-full bg-[#B8F24A] px-4 py-2 text-sm font-semibold text-[#14172F] ${focus}`}>＋ Catat transaksi</button></div>}
          </div>

          {showForm && tab === "Arus kas" && <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs text-slate-300">Jenis<select value={cashType} onChange={(e) => setCashType(e.target.value as CashType)} className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-[#20243D] px-3 text-sm text-white"><option>Masuk</option><option>Keluar</option></select></label>
            <label className="text-xs text-slate-300">Kategori<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-[#20243D] px-3 text-sm text-white"><option>Penerimaan pelanggan</option><option>Pembelian</option><option>Operasional</option><option>Lainnya</option></select></label>
            <label className="text-xs text-slate-300 lg:col-span-2">Deskripsi<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Keterangan transaksi" className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400" /></label>
            <label className="text-xs text-slate-300">Nominal<input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Contoh: 500000" className="mt-1 block h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400" /></label>
            <div className="flex gap-2 lg:col-span-5"><button onClick={addCashEntry} className={`rounded-xl bg-[#5B45F0] px-4 py-2.5 text-sm font-semibold text-white ${focus}`}>Simpan simulasi</button><button onClick={() => setShowForm(false)} className={`rounded-xl border border-white/15 px-4 py-2.5 text-sm ${focus}`}>Batal</button></div>
          </div>}

          {tab === "Ikhtisar" && <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><h2 className="font-semibold">Arus kas periode terpilih</h2><p className="mt-1 text-xs text-slate-400">Hanya penjumlahan transaksi kas simulasi, bukan saldo rekening.</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/[.05] p-3"><p className="text-xs text-slate-400">Kas masuk</p><p className="mt-1 text-lg font-semibold">{fmtMoney(cashIn)}</p></div><div className="rounded-xl bg-white/[.05] p-3"><p className="text-xs text-slate-400">Kas keluar</p><p className="mt-1 text-lg font-semibold">{fmtMoney(cashOut)}</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#B8F24A]" style={{ width: `${cashIn + cashOut ? (cashIn / (cashIn + cashOut)) * 100 : 0}%` }} /></div><p className="mt-2 text-xs text-slate-400">Rasio visual kas masuk dibanding total arus kas dalam daftar.</p></article>
            <article className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><h2 className="font-semibold">Posisi kewajiban & tagihan</h2><div className="mt-4 space-y-4"><div><div className="flex justify-between gap-3 text-sm"><span className="text-slate-300">Piutang pelanggan (contoh)</span><strong>{fmtMoney(outstandingAR)}</strong></div><div className="mt-1 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-sky-400" style={{ width: "72%" }} /></div></div><div><div className="flex justify-between gap-3 text-sm"><span className="text-slate-300">Utang supplier (contoh)</span><strong>{fmtMoney(outstandingAP)}</strong></div><div className="mt-1 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-amber-300" style={{ width: "52%" }} /></div></div></div><p className="mt-4 text-xs text-slate-400">Nilai piutang dan utang bersifat ilustratif dan belum tersinkron dengan modul transaksi.</p></article>
          </div>}

          {tab === "Arus kas" && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-xs text-slate-400">{["ID transaksi", "Tanggal", "Deskripsi", "Kategori", "Kas masuk", "Kas keluar"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visibleCash.map((e) => <tr key={e.id} className="border-b border-white/[.07] hover:bg-white/[.04]"><td className="px-3 py-4 font-mono text-xs text-[#B8F24A]">{e.id}</td><td className="px-3 py-4 text-slate-300">{e.date}</td><td className="px-3 py-4 font-medium">{e.description}</td><td className="px-3 py-4 text-slate-300">{e.category}</td><td className="px-3 py-4 tabular-nums">{e.type === "Masuk" ? fmtMoney(e.amount) : "—"}</td><td className="px-3 py-4 tabular-nums">{e.type === "Keluar" ? fmtMoney(e.amount) : "—"}</td></tr>)}</tbody></table>{visibleCash.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Transaksi kas tidak ditemukan untuk filter ini.</p>}<p className="mt-3 text-xs text-slate-400">Transaksi manual yang ditambahkan hanya disimpan dalam state halaman dan hilang setelah reload.</p></div>}

          {tab === "Laba rugi" && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Laporan laba rugi</h2><p className="mt-1 text-xs text-slate-400">Ilustrasi tetap bulan Oktober 2026 — tidak berubah mengikuti filter transaksi kas.</p></div><span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs text-amber-200">Data ilustrasi</span></div><dl className="mt-5 divide-y divide-white/10">{[["Penjualan kotor", demoPL.sales], ["Retur penjualan", -demoPL.salesReturns], ["Harga pokok penjualan (HPP)", -demoPL.cogs], ["Laba kotor", grossProfit], ["Beban operasional", -demoPL.operating], ["Pendapatan lain", demoPL.otherIncome], ["Beban lain", -demoPL.otherExpense], ["Laba bersih ilustrasi", netProfit]].map(([label, value], index) => <div key={String(label)} className={`flex items-center justify-between gap-4 py-3 ${index === 3 || index === 7 ? "font-semibold text-[#B8F24A]" : "text-slate-200"}`}><dt>{label}</dt><dd className="tabular-nums">{Number(value) < 0 ? "−" : ""}{fmtMoney(Math.abs(Number(value)))}</dd></div>)}</dl><p className="mt-4 text-xs leading-relaxed text-slate-400">Laba rugi yang valid memerlukan transaksi penjualan, retur, HPP berdasarkan metode persediaan yang disetujui, dan beban yang sudah dicatat. Angka pada prototipe ini semata-mata untuk menguji bentuk laporan.</p></div>}

          {tab === "Utang & piutang" && <div className="mt-4 grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><h2 className="font-semibold">Utang supplier (simulasi)</h2><p className="mt-1 text-xs text-slate-400">Prioritas pembayaran perlu mempertimbangkan jatuh tempo dan saldo yang belum dibayar.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs text-slate-400"><th className="py-2 pr-3">Supplier</th><th className="py-2 pr-3">Faktur</th><th className="py-2 pr-3">Jatuh tempo</th><th className="py-2">Sisa</th></tr></thead><tbody>{seedPayables.map((p) => <tr key={p.invoice} className="border-b border-white/[.07]"><td className="py-3 pr-3">{p.supplier}</td><td className="py-3 pr-3 text-xs">{p.invoice}</td><td className="py-3 pr-3 text-slate-300">{p.due}</td><td className="py-3 tabular-nums">{fmtMoney(p.amount - p.paid)}</td></tr>)}</tbody></table></div></article><article className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><h2 className="font-semibold">Piutang pelanggan (ringkasan)</h2><p className="mt-1 text-xs text-slate-400">Ringkasan contoh; rincian dan catatan pembayaran ada di workspace Piutang.</p><p className="mt-4 text-2xl font-semibold">{fmtMoney(outstandingAR)}</p><Link href="/pengiriman-piutang" className={`mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#14172F] ${focus}`}>Buka Pengiriman & piutang</Link></article></div>}
        </section>
        <p className="px-1 text-xs leading-relaxed text-[#8A8FB0]">Semua angka di halaman ini adalah data simulasi. Pencatatan kas bukan jurnal akuntansi otomatis; laba, saldo kas, piutang, utang, dan modal harus tetap dibedakan. Belum ada rekonsiliasi bank atau penguncian periode.</p>
      </div>
    </main>
  );
}
