"use client";

import Link from "next/link";

const money = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8F24A]";

const modules = [
  { href: "/", code: "01", title: "Penjualan", description: "Faktur, status pembayaran, rincian barang", metric: "6 faktur contoh", color: "bg-violet-300" },
  { href: "/master-data", code: "02", title: "Master data", description: "Referensi pelanggan dan barang", metric: "6 pelanggan · 4 barang", color: "bg-lime-300" },
  { href: "/operasional", code: "03", title: "Pembelian & persediaan", description: "PO, penerimaan, batch, dan ED", metric: "7.090 unit batch contoh", color: "bg-sky-300" },
  { href: "/pengiriman-piutang", code: "04", title: "Pengiriman & piutang", description: "Surat jalan, pembayaran parsial, sisa tagihan", metric: "4 piutang contoh", color: "bg-amber-300" },
  { href: "/keuangan", code: "05", title: "Keuangan & laporan", description: "Arus kas, laba rugi, utang supplier", metric: "Data keuangan contoh", color: "bg-rose-300" },
];

const reminders = [
  { level: "danger", title: "Pengiriman gagal", detail: "SJ-2026-0145 · Apotek Kencana", action: "Periksa barang fisik sebelum stok dikembalikan", href: "/pengiriman-piutang", label: "Buka pengiriman" },
  { level: "warning", title: "Batch segera kedaluwarsa", detail: "Paracetamol 500 mg · BT-26018 · ED 30 Nov 2026", action: "Periksa ED fisik dan rencana distribusi", href: "/operasional", label: "Periksa batch" },
  { level: "warning", title: "Batch karantina", detail: "Omeprazole 20 mg · BT-26011 · 640 unit", action: "Jangan masukkan ke stok siap jual sebelum pemeriksaan", href: "/operasional", label: "Buka persediaan" },
  { level: "info", title: "Piutang mendekati jatuh tempo", detail: "INV-2026-0144 · Klinik Bina Sehat · Rp 5.680.000", action: "Pastikan status tagihan dan tindak lanjut pelanggan", href: "/pengiriman-piutang", label: "Buka piutang" },
];

export default function ManagementDashboard() {
  const sales = 44910000;
  const receivables = 31700000;
  const payables = 33000000;
  const cashIn = 11620000;
  const cashOut = 5450000;
  const netCash = cashIn - cashOut;
  const estimatedProfit = 6900000;

  return (
    <main className="min-h-screen bg-[#ECEBFA] p-3 text-[#14172F] [background-image:radial-gradient(900px_circle_at_8%_0%,rgba(122,105,246,.2),transparent_60%),radial-gradient(700px_circle_at_96%_100%,rgba(184,242,74,.18),transparent_55%)]">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1600px] flex-col gap-5 rounded-[32px] bg-[#F8F8FF]/90 p-4 shadow-[0_24px_80px_rgba(62,50,160,.14)] ring-1 ring-white/80 backdrop-blur-xl sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8F24A] text-xl font-extrabold">J</span><div><p className="text-sm font-bold">Jena Medical Center</p><p className="text-[11px] text-[#5E6488]">Distribusi alat & obat medis</p></div></div>
          <nav className="flex max-w-full flex-wrap gap-1 rounded-full bg-[#14172B] p-1" aria-label="Navigasi utama">
            <span aria-current="page" className="rounded-full bg-[#5B45F0] px-3.5 py-2 text-xs font-medium text-white">Dashboard</span>
            <Link href="/" className={`rounded-full px-3.5 py-2 text-xs text-slate-300 hover:bg-white/10 ${focus}`}>Penjualan</Link>
            <Link href="/master-data" className={`rounded-full px-3.5 py-2 text-xs text-slate-300 hover:bg-white/10 ${focus}`}>Master data</Link>
            <Link href="/operasional" className={`rounded-full px-3.5 py-2 text-xs text-slate-300 hover:bg-white/10 ${focus}`}>Operasional</Link>
            <Link href="/pengiriman-piutang" className={`rounded-full px-3.5 py-2 text-xs text-slate-300 hover:bg-white/10 ${focus}`}>Pengiriman & piutang</Link>
            <Link href="/keuangan" className={`rounded-full px-3.5 py-2 text-xs text-slate-300 hover:bg-white/10 ${focus}`}>Keuangan</Link>
          </nav>
        </header>

        <section className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#6D55F2]">Ringkasan manajemen</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-[#5E6488]">Satu tampilan untuk memprioritaskan penjualan, gudang, pengiriman, dan keuangan.</p></div>
          <div className="rounded-xl border border-[#E6E6F5] bg-white px-4 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#8A8FB0]">Snapshot data contoh</p><p className="mt-0.5 text-sm font-semibold">14 Oktober 2026</p></div>
        </section>

        <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Mode prototipe.</strong> Angka berikut berasal dari data contoh pada masing-masing halaman dan belum terhubung satu sama lain atau ke database. Gunakan untuk review alur dan tampilan, bukan keputusan operasional aktual.</div>

        <section aria-label="Ringkasan keuangan" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm text-[#5E6488]">Total faktur tercatat</p><span className="rounded-lg bg-violet-50 px-2 py-1 text-xs text-violet-700">Okt 2026</span></div><p className="mt-2 text-2xl font-semibold tabular-nums">{money(sales)}</p><p className="mt-1 text-xs text-[#8A8FB0]">6 faktur contoh · termasuk status retur, bukan kas masuk</p><Link href="/" className={`mt-3 inline-flex text-xs font-semibold text-[#5B45F0] hover:underline ${focus}`}>Lihat faktur →</Link></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Piutang tersisa</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(receivables)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Termasuk pembayaran parsial contoh</p><Link href="/pengiriman-piutang" className={`mt-3 inline-flex text-xs font-semibold text-[#5B45F0] hover:underline ${focus}`}>Tindak lanjuti →</Link></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Utang supplier tersisa</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(payables)}</p><p className="mt-1 text-xs text-[#8A8FB0]">3 faktur supplier contoh</p><Link href="/keuangan" className={`mt-3 inline-flex text-xs font-semibold text-[#5B45F0] hover:underline ${focus}`}>Lihat utang →</Link></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Arus kas bersih contoh</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${netCash >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(netCash)}</p><p className="mt-1 text-xs text-[#8A8FB0]">Kas masuk {money(cashIn)} − kas keluar {money(cashOut)}</p><Link href="/keuangan" className={`mt-3 inline-flex text-xs font-semibold text-[#5B45F0] hover:underline ${focus}`}>Buka keuangan →</Link></article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[28px] bg-[#14172B] p-5 text-white shadow-[0_24px_60px_rgba(20,23,43,.22)]">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#B8F24A]">Tindak lanjut</p><h2 className="mt-1 text-xl font-semibold">Perlu perhatian</h2><p className="mt-1 text-xs text-slate-400">Daftar contoh untuk memvalidasi prioritas kerja harian.</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-300">4 item contoh</span></div>
            <div className="mt-4 space-y-3">{reminders.map((r) => <div key={r.title} className="rounded-2xl border border-white/10 bg-white/[.04] p-3.5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${r.level === "danger" ? "bg-rose-400" : r.level === "warning" ? "bg-amber-300" : "bg-sky-300"}`}/><h3 className="text-sm font-semibold">{r.title}</h3></div><p className="mt-1 text-xs text-slate-300">{r.detail}</p><p className="mt-1 text-xs text-slate-400">{r.action}</p></div><Link href={r.href} className={`shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 ${focus}`}>{r.label}</Link></div></div>)}</div>
          </article>
          <article className="rounded-[28px] border border-[#E6E6F5] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6D55F2]">Snapshot gudang</p><h2 className="mt-1 text-xl font-semibold">Persediaan & pengiriman</h2><p className="mt-1 text-xs text-[#8A8FB0]">Jumlah berdasarkan data simulasi per modul.</p></div><Link href="/operasional" className={`rounded-full bg-[#F0EDFF] px-3 py-1.5 text-xs font-semibold text-[#4636C9] ${focus}`}>Buka gudang →</Link></div>
            <div className="mt-4 space-y-4">
              {[{label:"Total unit batch contoh",value:7090,display:"7.090 unit",color:"bg-violet-500",width:"100%"},{label:"Unit batch segera ED",value:3200,display:"3.200 unit",color:"bg-amber-400",width:"45.1%"},{label:"Unit karantina",value:640,display:"640 unit",color:"bg-rose-400",width:"9%" }].map((s) => <div key={s.label}><div className="flex items-center justify-between gap-3 text-sm"><span className="text-[#5E6488]">{s.label}</span><strong>{s.display}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F0EFF9]"><div className={`h-full rounded-full ${s.color}`} style={{width:s.width}}/></div></div>)}
              <div className="grid grid-cols-2 gap-3 pt-1"><div className="rounded-2xl bg-[#F7F6FF] p-3"><p className="text-xs text-[#5E6488]">Pengiriman perlu ditindaklanjuti</p><p className="mt-1 text-2xl font-semibold">2</p><p className="text-[11px] text-[#8A8FB0]">Menunggu / gagal</p></div><div className="rounded-2xl bg-[#F7F6FF] p-3"><p className="text-xs text-[#5E6488]">Laba bersih ilustrasi</p><p className="mt-1 text-lg font-semibold">{money(estimatedProfit)}</p><p className="text-[11px] text-[#8A8FB0]">Bukan saldo kas</p></div></div>
            </div>
          </article>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6D55F2]">Akses cepat</p><h2 className="mt-1 text-xl font-semibold">Modul kerja</h2></div><p className="text-xs text-[#8A8FB0]">Masuk langsung ke modul yang perlu dikelola.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{modules.map((m) => <Link href={m.href} key={m.code} className={`group rounded-2xl border border-[#E6E6F5] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#CFC6FA] hover:shadow-[0_14px_30px_rgba(91,69,240,.12)] ${focus}`}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#8A8FB0]">{m.code} / MODUL</span><span className={`h-2.5 w-2.5 rounded-full ${m.color}`}/></div><h3 className="mt-3 font-semibold">{m.title}</h3><p className="mt-1 min-h-10 text-xs leading-relaxed text-[#5E6488]">{m.description}</p><p className="mt-3 text-xs font-semibold text-[#4636C9]">{m.metric}</p><p className="mt-3 text-xs text-[#8A8FB0] group-hover:text-[#5B45F0]">Buka modul ↗</p></Link>)}</div>
        </section>

        <footer className="rounded-2xl border border-[#E6E6F5] bg-white/80 px-4 py-3 text-xs leading-relaxed text-[#8A8FB0]">Dashboard ini hanya menggabungkan indikator ilustratif untuk evaluasi UI. Nilai contoh lintas modul belum disinkronkan dan beberapa daftar terpisah dapat menggambarkan transaksi yang sama. Jangan menggunakan angka ini untuk pembukuan, keputusan pembelian, alokasi pembayaran, atau pengiriman nyata.</footer>
      </div>
    </main>
  );
}
