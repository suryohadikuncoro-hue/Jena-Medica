"use client";

import { useMemo, useState } from "react";

type Customer = { code: string; name: string; type: "Apotek" | "Klinik" | "Rumah sakit"; city: string; phone: string; creditLimit: number; active: boolean };
type Item = { code: string; name: string; category: string; unit: string; price: number; stock: number; active: boolean };

const seedCustomers: Customer[] = [
  { code: "AP0001", name: "Apotek Sehat Sentosa", type: "Apotek", city: "Lamongan", phone: "—", creditLimit: 15000000, active: true },
  { code: "KMU001", name: "Klinik Medika Utama", type: "Klinik", city: "Gresik", phone: "—", creditLimit: 12000000, active: true },
  { code: "RSA003", name: "RS Anugerah", type: "Rumah sakit", city: "Surabaya", phone: "—", creditLimit: 25000000, active: true },
  { code: "APK004", name: "Apotek Kencana", type: "Apotek", city: "Lamongan", phone: "—", creditLimit: 10000000, active: true },
  { code: "KBS006", name: "Klinik Bina Sehat", type: "Klinik", city: "Tuban", phone: "—", creditLimit: 10000000, active: true },
  { code: "AMH008", name: "Apotek Mitra Husada", type: "Apotek", city: "Bojonegoro", phone: "—", creditLimit: 10000000, active: true },
];
const seedItems: Item[] = [
  { code: "AMX-500", name: "Amoxicillin 500 mg", category: "Obat", unit: "Strip", price: 15000, stock: 2400, active: true },
  { code: "PCM-500", name: "Paracetamol 500 mg", category: "Obat", unit: "Box", price: 12500, stock: 3200, active: true },
  { code: "VTC-500", name: "Vitamin C 500 mg", category: "Obat", unit: "Box", price: 22000, stock: 850, active: true },
  { code: "OMP-020", name: "Omeprazole 20 mg", category: "Obat", unit: "Box", price: 30000, stock: 640, active: true },
];

const money = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8F24A]";

export default function MasterDataPage() {
  const [tab, setTab] = useState<"Pelanggan" | "Barang">("Pelanggan");
  const [customers, setCustomers] = useState(seedCustomers);
  const [items, setItems] = useState(seedItems);
  const [search, setSearch] = useState("");
  const [customerType, setCustomerType] = useState("Semua jenis");
  const [itemCategory, setItemCategory] = useState("Semua kategori");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");

  const filteredCustomers = useMemo(() => customers.filter((c) =>
    (customerType === "Semua jenis" || c.type === customerType) &&
    `${c.code} ${c.name} ${c.city} ${c.type}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [customers, customerType, search]);
  const filteredItems = useMemo(() => items.filter((i) =>
    (itemCategory === "Semua kategori" || i.category === itemCategory) &&
    `${i.code} ${i.name} ${i.category} ${i.unit}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [items, itemCategory, search]);

  function saveRecord() {
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanName || !cleanCode) { setNotice("Kode dan nama wajib diisi."); return; }
    const duplicate = tab === "Pelanggan"
      ? customers.some((c) => c.code.toLowerCase() === cleanCode.toLowerCase() || c.name.toLowerCase() === cleanName.toLowerCase())
      : items.some((i) => i.code.toLowerCase() === cleanCode.toLowerCase() || i.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) { setNotice("Kode atau nama sudah digunakan."); return; }
    if (tab === "Pelanggan") {
      setCustomers((prev) => [...prev, { code: cleanCode, name: cleanName, type: "Apotek", city: "Belum diisi", phone: "—", creditLimit: 0, active: true }]);
    } else {
      setItems((prev) => [...prev, { code: cleanCode, name: cleanName, category: "Obat", unit: "Pcs", price: 0, stock: 0, active: true }]);
    }
    setName(""); setCode(""); setShowForm(false);
    setNotice(`${tab} ditambahkan ke data simulasi. Belum tersimpan ke database.`);
  }

  return (
    <main className="min-h-screen bg-[#ECEBFA] p-3 text-[#14172F] [background-image:radial-gradient(900px_circle_at_8%_0%,rgba(122,105,246,.2),transparent_60%),radial-gradient(700px_circle_at_96%_100%,rgba(184,242,74,.18),transparent_55%)]">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1600px] flex-col gap-5 rounded-[32px] bg-[#F8F8FF]/90 p-4 shadow-[0_24px_80px_rgba(62,50,160,.14)] ring-1 ring-white/80 backdrop-blur-xl sm:p-6">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8F24A] text-lg font-extrabold">J</span><div><p className="text-sm font-bold">Jena Medical Center</p><p className="text-[11px] text-[#5E6488]">Distribusi alat & obat medis</p></div></div>
          <nav aria-label="Navigasi utama" className="ml-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-[#14172B] p-1">
            <a href="/" className={`rounded-full px-4 py-2 text-[13px] font-medium text-slate-300 hover:bg-white/10 ${focus}`}>Penjualan</a>
            <span aria-current="page" className="rounded-full bg-[#5B45F0] px-4 py-2 text-[13px] font-medium text-white">Master data</span>
          </nav>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#6D55F2]">Data operasional</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Master data</h1><p className="mt-1 text-sm text-[#5E6488]">Kelola referensi pelanggan dan barang untuk alur transaksi berikutnya.</p></div>
          <button onClick={() => { setShowForm((v) => !v); setNotice(""); }} className={`rounded-full bg-[#5B45F0] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(91,69,240,.25)] hover:bg-[#4A36DB] ${focus}`}>＋ Tambah {tab.toLowerCase()}</button>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Total pelanggan</p><p className="mt-1 text-2xl font-semibold">{customers.length}</p><p className="mt-1 text-xs text-[#8A8FB0]">Termasuk data contoh</p></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Total barang</p><p className="mt-1 text-2xl font-semibold">{items.length}</p><p className="mt-1 text-xs text-[#8A8FB0]">Belum terhubung ke stok batch</p></article>
          <article className="rounded-2xl border border-[#E6E6F5] bg-white p-4"><p className="text-sm text-[#5E6488]">Status sumber data</p><p className="mt-1 text-lg font-semibold">Mode simulasi</p><p className="mt-1 text-xs text-[#8A8FB0]">Perubahan hilang saat halaman dimuat ulang</p></article>
        </section>

        {notice && <p role="status" className="rounded-xl border border-[#D8D2FF] bg-[#F0EDFF] px-4 py-3 text-sm text-[#4636C9]">{notice}</p>}

        {showForm && <section className="rounded-2xl border border-[#D8D2FF] bg-white p-4 sm:p-5">
          <h2 className="font-semibold">Tambah {tab.toLowerCase()} · data simulasi</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <label className="text-xs font-medium text-[#5E6488]">Kode<input value={code} onChange={(e) => setCode(e.target.value)} placeholder={tab === "Pelanggan" ? "Mis. AP0009" : "Mis. PCM-650"} className="mt-1 block h-11 w-full rounded-xl border border-[#E6E6F5] px-3 text-sm text-[#14172F] outline-none focus:border-[#5B45F0]" /></label>
            <label className="text-xs font-medium text-[#5E6488]">Nama<input value={name} onChange={(e) => setName(e.target.value)} placeholder={tab === "Pelanggan" ? "Nama badan usaha" : "Nama barang"} className="mt-1 block h-11 w-full rounded-xl border border-[#E6E6F5] px-3 text-sm text-[#14172F] outline-none focus:border-[#5B45F0]" /></label>
            <button onClick={saveRecord} className={`self-end rounded-xl bg-[#14172B] px-5 py-3 text-sm font-semibold text-white ${focus}`}>Simpan simulasi</button>
          </div>
        </section>}

        <section className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[28px] bg-[#14172B] p-4 text-white shadow-[0_24px_60px_rgba(20,23,43,.25)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full bg-white/10 p-1" role="tablist" aria-label="Jenis master data">
              {(["Pelanggan", "Barang"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSearch(""); setNotice(""); setShowForm(false); }} className={`rounded-full px-5 py-2 text-sm font-medium ${focus} ${tab === t ? "bg-[#5B45F0] text-white" : "text-slate-300 hover:bg-white/10"}`}>{t}</button>)}
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {tab === "Pelanggan" ? <select aria-label="Filter jenis pelanggan" value={customerType} onChange={(e) => setCustomerType(e.target.value)} className="h-10 rounded-full border border-white/15 bg-[#20243D] px-4 text-sm text-white"><option>Semua jenis</option><option>Apotek</option><option>Klinik</option><option>Rumah sakit</option></select> : <select aria-label="Filter kategori barang" value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className="h-10 rounded-full border border-white/15 bg-[#20243D] px-4 text-sm text-white"><option>Semua kategori</option><option>Obat</option><option>Alat kesehatan</option><option>Bahan medis</option></select>}
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode, nama, atau lokasi" aria-label="Cari master data" className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[#B8F24A] sm:w-64 sm:flex-none" />
            </div>
          </div>

          {tab === "Pelanggan" ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-xs text-slate-400">{["Kode", "Nama pelanggan", "Jenis", "Kota", "Limit kredit", "Status"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{filteredCustomers.map((c) => <tr key={c.code} className="border-b border-white/[.07] transition hover:bg-white/[.04]"><td className="px-3 py-4 font-mono text-xs text-[#B8F24A]">{c.code}</td><td className="px-3 py-4 font-medium">{c.name}<p className="mt-1 text-xs text-slate-400">{c.phone}</p></td><td className="px-3 py-4 text-slate-300">{c.type}</td><td className="px-3 py-4 text-slate-300">{c.city}</td><td className="px-3 py-4 tabular-nums">{money(c.creditLimit)}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${c.active ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-slate-400"}`}>{c.active ? "Aktif" : "Nonaktif"}</span></td></tr>)}</tbody></table>{filteredCustomers.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Tidak ada pelanggan yang cocok. Ubah pencarian atau filter.</p>}</div>
          : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-xs text-slate-400">{["Kode barang", "Nama barang", "Kategori", "Satuan", "Harga jual contoh", "Stok contoh", "Status"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{filteredItems.map((i) => <tr key={i.code} className="border-b border-white/[.07] transition hover:bg-white/[.04]"><td className="px-3 py-4 font-mono text-xs text-[#B8F24A]">{i.code}</td><td className="px-3 py-4 font-medium">{i.name}</td><td className="px-3 py-4 text-slate-300">{i.category}</td><td className="px-3 py-4 text-slate-300">{i.unit}</td><td className="px-3 py-4 tabular-nums">{money(i.price)}</td><td className="px-3 py-4 tabular-nums">{new Intl.NumberFormat("id-ID").format(i.stock)}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${i.active ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-slate-400"}`}>{i.active ? "Aktif" : "Nonaktif"}</span></td></tr>)}</tbody></table>{filteredItems.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Tidak ada barang yang cocok. Ubah pencarian atau filter.</p>}</div>}
          <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">Data master masih berupa simulasi. Limit kredit, harga, dan stok belum tervalidasi serta tidak digunakan untuk transaksi aktual.</p>
        </section>
      </div>
    </main>
  );
}
