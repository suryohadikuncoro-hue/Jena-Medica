"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthStatus } from "@/app/components/auth-status";

const groups = [
  { title: "Transaksi", items: [["Pesanan Pelanggan", "/"], ["Order ke Supplier", "/operasional"], ["Faktur Supplier", "/operasional#invoices"], ["Invoice Pelanggan", "/invoice-pelanggan"], ["Pembayaran", "/pembayaran"]] },
  { title: "Master Data", items: [["Pelanggan", "/master-data#customers"], ["Supplier", "/master-data#suppliers"], ["Barang", "/master-data#products"], ["Harga per Pelanggan", "/master-data#prices"], ["Daftar Akun", "/master-data#accounts"]] },
  { title: "Akuntansi", items: [["Jurnal Umum", "/keuangan#jurnal"], ["Buku Besar", "/keuangan#buku-besar"], ["Biaya Operasional", "/keuangan#biaya"], ["Tutup Buku", "/keuangan#tutup-buku"]] },
  { title: "Laporan", items: [["Laba Rugi", "/keuangan#laba-rugi"], ["Neraca", "/keuangan#neraca"], ["Arus Kas", "/keuangan#arus-kas"], ["Piutang & Hutang", "/pembayaran"], ["PPN", "/keuangan#ppn"]] },
] as const;
const quickActions = [["Pesanan Pelanggan", "/"], ["Order ke Supplier", "/operasional"], ["Faktur Supplier", "/operasional#invoices"], ["Invoice Pelanggan", "/invoice-pelanggan"], ["Pembayaran", "/pengiriman-piutang#payments"], ["Biaya Operasional", "/keuangan#biaya"]] as const;
const searchItems = [...groups.flatMap(g => g.items.map(([label, href]) => ({ label, href }))), { label: "Dashboard", href: "/dashboard" }];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const matches = useMemo(() => searchItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [query]);

  useEffect(() => {
    const saved = window.localStorage.getItem("jena-theme");
    const useDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const frame = window.requestAnimationFrame(() => setDark(useDark));
    document.documentElement.dataset.theme = useDark ? "dark" : "light";
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "Escape") { setPaletteOpen(false); setMobileOpen(false); setCreateOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("jena-theme", next ? "dark" : "light");
  }

  return <div className="app-root min-h-screen">
    <header className="app-topbar sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-3 px-4 lg:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="Jena Medical Center — Dashboard"><span className="brand-mark">J</span><span className="hidden leading-tight sm:block"><span className="block text-sm font-bold">Jena Medical Center</span><span className="block text-[11px] opacity-65">Business Suite</span></span></Link>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Navigasi utama">
          <Link className={`top-link ${pathname === "/dashboard" ? "top-link-active" : ""}`} href="/dashboard">Dashboard</Link>
          {groups.map(group => <details key={group.title} className="nav-menu"><summary className="top-link cursor-pointer">{group.title}<span aria-hidden="true" className="ml-1 text-xs">⌄</span></summary><div className="nav-popover">{group.items.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</div></details>)}
          <Link className={`top-link ${pathname === "/pengiriman-piutang" ? "top-link-active" : ""}`} href="/pengiriman-piutang">Pengiriman</Link>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <button className="search-trigger hidden sm:flex" type="button" onClick={() => setPaletteOpen(true)}><span aria-hidden="true">⌕</span><span className="hidden xl:inline">Cari transaksi…</span><kbd>⌘ K</kbd></button>
          <div className="relative"><button type="button" className="primary-button hidden sm:inline-flex" onClick={() => setCreateOpen(v => !v)}>＋ Buat Baru</button>{createOpen && <div className="action-popover">{quickActions.map(([label, href]) => <Link key={label} href={href} onClick={() => setCreateOpen(false)}>{label}</Link>)}</div>}</div>
          <button type="button" className="icon-button relative" aria-label="Notifikasi" onClick={() => setNotice("Notifikasi akan menampilkan tindakan yang perlu ditinjau.")}>♧<span className="notification-dot" /></button>
          <button type="button" className="icon-button hidden sm:inline-flex" aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"} onClick={toggleTheme}>{dark ? "☼" : "◐"}</button>
          <AuthStatus />
          <button type="button" className="avatar-button hidden sm:inline-flex" aria-label="Profil pengguna">JM</button>
          <button type="button" className="icon-button lg:hidden" aria-label="Buka menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}>☰</button>
        </div>
      </div>
      {mobileOpen && <div className="mobile-menu lg:hidden"><div className="mb-3 flex gap-2"><button className="search-trigger flex-1" type="button" onClick={() => { setPaletteOpen(true); setMobileOpen(false); }}>⌕ Cari transaksi</button><button className="icon-button" onClick={toggleTheme} aria-label="Ganti tema">◐</button></div><Link href="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</Link>{groups.map(g => <details key={g.title} className="mobile-menu-group"><summary>{g.title}</summary>{g.items.map(([label, href]) => <Link key={label} href={href} onClick={() => setMobileOpen(false)}>{label}</Link>)}</details>)}<AuthStatus compact/><Link href="/pengiriman-piutang" onClick={() => setMobileOpen(false)}>Pengiriman</Link><button className="primary-button mt-3 w-full" onClick={() => { setMobileOpen(false); setCreateOpen(v => !v); }}>＋ Buat Baru</button></div>}
    </header>
    {notice && <div role="status" className="notice-banner mx-auto mt-3 max-w-[1500px] px-4 lg:px-8">{notice}<button className="ml-3 font-semibold" onClick={() => setNotice("")}>Tutup</button></div>}
    <div className="pb-20 lg:pb-0">{children}</div>
    <nav className="bottom-bar lg:hidden" aria-label="Aksi utama"><Link href="/dashboard">⌂<span>Dashboard</span></Link><Link href="/">＋<span>Pesanan</span></Link><Link href="/invoice-pelanggan">▤<span>Invoice</span></Link><Link href="/pengiriman-piutang#payments">↗<span>Bayar</span></Link></nav>
    {paletteOpen && <div className="palette-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setPaletteOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Pencarian global"><div className="flex items-center gap-3 border-b p-4"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari menu dan transaksi..." aria-label="Cari menu dan transaksi" className="min-w-0 flex-1 bg-transparent outline-none"/><kbd>ESC</kbd></div><div className="p-2">{matches.length ? matches.map(item => <Link className="command-result" key={`${item.label}-${item.href}`} href={item.href} onClick={() => { setPaletteOpen(false); setQuery(""); }}>{item.label}<span>Buka →</span></Link>) : <p className="p-4 text-sm opacity-60">Tidak ada hasil. Pencarian data transaksi aktif setelah sumber data terhubung.</p>}</div><p className="border-t px-4 py-3 text-xs opacity-60">Gunakan Ctrl/Cmd + K untuk membuka pencarian</p></section></div>}
  </div>;
}
