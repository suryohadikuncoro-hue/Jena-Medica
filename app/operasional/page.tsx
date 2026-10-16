"use client";

import { useEffect, useState } from "react";

const money = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
type PurchaseOrder = { id: string; so: string; supplier: string; customer: string; date: string; items: number; total: number; status: string };
type SupplierInvoice = { id: string; supplier: string; po: string; date: string; due: string; total: number; paid: number; tax: string };
const poRows: PurchaseOrder[] = [
  { id: "PO/2026/10/0092", so: "SO/2026/10/0048", supplier: "PT Sehat Farma", customer: "Apotek Sehat Sentosa", date: "16 Okt 2026", items: 3, total: 18500000, status: "Menunggu konfirmasi" },
  { id: "PO/2026/10/0091", so: "SO/2026/10/0047", supplier: "PT Medika Utama", customer: "Klinik Medika Utama", date: "15 Okt 2026", items: 2, total: 12400000, status: "Dikirim langsung" },
  { id: "PO/2026/10/0090", so: "SO/2026/10/0046", supplier: "CV Mitra Medis", customer: "RS Anugerah", date: "14 Okt 2026", items: 1, total: 8600000, status: "Sebagian dipenuhi" },
];
const invoiceRows: SupplierInvoice[] = [
  { id: "FP/2026/10/0092", supplier: "PT Sehat Farma", po: "PO/2026/10/0092", date: "16 Okt 2026", due: "30 Okt 2026", total: 18500000, paid: 4000000, tax: "Berpajak" },
  { id: "FP/2026/10/0091", supplier: "PT Medika Utama", po: "PO/2026/10/0091", date: "15 Okt 2026", due: "29 Okt 2026", total: 12400000, paid: 0, tax: "Non-pajak" },
];

export default function SupplierOperationsPage() {
  const [tab, setTab] = useState<"PO Supplier" | "Faktur Supplier">("PO Supplier");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  useEffect(() => { const sync = () => { if (window.location.hash === "#invoices") window.requestAnimationFrame(() => setTab("Faktur Supplier")); else if (!window.location.hash) window.requestAnimationFrame(() => setTab("PO Supplier")); }; sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, []);
  const filteredPOs = poRows.filter(x => `${x.id} ${x.so} ${x.supplier} ${x.customer}`.toLowerCase().includes(query.toLowerCase()));
  const filteredInvoices = invoiceRows.filter(x => `${x.id} ${x.supplier} ${x.po}`.toLowerCase().includes(query.toLowerCase()));

  return <main className="page-wrap">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Transaksi · Pembelian drop-ship</p><h1 className="page-title">Order & faktur supplier</h1><p className="page-description">Pesan ke supplier untuk dikirim langsung ke alamat pelanggan; Jena tidak menerima atau menyimpan barang.</p></div><button className="primary-button" onClick={() => setShowForm(v => !v)}>＋ {tab === "PO Supplier" ? "Buat order supplier" : "Catat faktur supplier"}</button></div>
    <div className="demo-banner mb-5"><strong>Mode prototipe.</strong> Data di bawah adalah contoh. PO, faktur supplier dan pembayaran belum tersimpan ke sistem.</div>
    <section className="mb-5 grid gap-3 sm:grid-cols-3"><Kpi label="PO terbuka" value="6"/><Kpi label="Faktur belum lunas" value={money(26900000)}/><Kpi label="Pembayaran supplier jatuh tempo" value="2"/></section>
    {showForm && <section className="card card-pad mb-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Draft {tab === "PO Supplier" ? "order supplier" : "faktur supplier"}</h2><p className="mt-1 text-xs text-[var(--muted)]">Form UI untuk validasi alur; penyimpanan transaksi belum aktif.</p></div><button className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div>
      {tab === "PO Supplier" ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Pesanan pelanggan" placeholder="Pilih SO"/><Field label="Supplier" placeholder="Pilih supplier"/><Field label="Alamat kirim pelanggan" placeholder="Terisi dari pelanggan"/><Field label="Tanggal diperlukan" placeholder="dd/mm/yyyy"/><label className="text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-4">Catatan untuk supplier<textarea className="field mt-1 min-h-20 py-2" placeholder="Instruksi pengiriman langsung ke pelanggan"/></label></div>
      : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Supplier" placeholder="Pilih supplier"/><Field label="Nomor faktur supplier" placeholder="Nomor faktur asli"/><Field label="Tanggal faktur" placeholder="dd/mm/yyyy"/><Field label="Jatuh tempo" placeholder="dd/mm/yyyy"/><Field label="PO terkait" placeholder="Pilih PO"/><Field label="Status pajak" placeholder="Berpajak / Non-pajak"/><Field label="Mode harga" placeholder="Termasuk / belum termasuk PPN"/><Field label="Diskon faktur" placeholder="Persen atau nominal"/><p className="text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-4">Modal aktual dihitung setelah diskon item dan alokasi diskon faktur. PPN masukan ditampilkan terpisah dari modal.</p></div>}
      <button className="primary-button mt-4" onClick={() => setShowForm(false)}>Simpan sebagai draf (demo)</button>
    </section>}
    <section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Jenis dokumen supplier">{(["PO Supplier", "Faktur Supplier"] as const).map(t => <button key={t} className="tab-button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setQuery(""); setShowForm(false); }}>{t}</button>)}</div><input className="field sm:w-64" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor, supplier, pelanggan" aria-label="Cari dokumen supplier"/></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{(tab === "PO Supplier" ? ["Nomor PO", "SO pelanggan", "Supplier", "Kirim langsung ke", "Tanggal", "Nilai", "Status"] : ["Nomor faktur", "Supplier", "PO terkait", "Tanggal", "Jatuh tempo", "Total", "Dibayar", "Pajak"]).map(h => <th key={h} className="py-3 pr-3">{h}</th>)}</tr></thead><tbody>
        {tab === "PO Supplier" ? filteredPOs.map(x => <tr className="table-row" key={x.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{x.id}</td><td className="py-4 pr-3">{x.so}</td><td className="py-4 pr-3">{x.supplier}</td><td className="py-4 pr-3">{x.customer}</td><td className="py-4 pr-3">{x.date}</td><td className="py-4 pr-3 text-right tabular-nums">{money(x.total)}</td><td className="py-4 text-right"><span className="status-pill">{x.status}</span></td></tr>) : filteredInvoices.map(x => <tr className="table-row" key={x.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{x.id}</td><td className="py-4 pr-3">{x.supplier}</td><td className="py-4 pr-3">{x.po}</td><td className="py-4 pr-3">{x.date}</td><td className="py-4 pr-3">{x.due}</td><td className="py-4 pr-3 text-right tabular-nums">{money(x.total)}</td><td className="py-4 pr-3 text-right tabular-nums">{money(x.paid)}</td><td className="py-4 text-right"><span className="status-pill">{x.tax}</span></td></tr>)}
      </tbody></table></div>
      <div className="space-y-3 md:hidden">{tab === "PO Supplier" ? filteredPOs.map(x => <article key={x.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{x.id}</p><h3 className="mt-1 text-sm font-semibold">{x.supplier}</h3><p className="mt-1 text-xs text-[var(--muted)]">Kirim langsung ke {x.customer}</p></div><span className="status-pill">{x.status}</span></div><div className="mt-3 flex justify-between text-xs"><span>{x.date} · {x.items} item</span><strong>{money(x.total)}</strong></div></article>) : filteredInvoices.map(x => <article key={x.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{x.id}</p><h3 className="mt-1 text-sm font-semibold">{x.supplier}</h3><p className="mt-1 text-xs text-[var(--muted)]">PO {x.po} · jatuh tempo {x.due}</p></div><span className="status-pill">{x.tax}</span></div><div className="mt-3 flex justify-between text-xs"><span>Dibayar {money(x.paid)}</span><strong>{money(x.total)}</strong></div></article>)}</div>
    </section>
  </main>;
}
function Kpi({ label, value }: { label: string; value: string }) { return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></article>; }
function Field({ label, placeholder }: { label: string; placeholder: string }) { return <label className="text-xs text-[var(--muted)]">{label}<input className="field mt-1" placeholder={placeholder}/></label>; }
