"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthStatus } from "@/app/components/auth-status";

const NAV = [
  { key: "home", label: "Home", href: "/dashboard", match: "/dashboard", icon: <path d="M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6" /> },
  { key: "dash", label: "Dashboard", href: "/dashboard-keuangan", match: "/dashboard-keuangan", icon: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></> },
  { key: "pesanan", label: "Pesanan", href: "/", match: "/", exact: true, icon: <><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></> },
  { key: "order", label: "Order supplier", href: "/operasional", match: "/operasional", icon: <><path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></> },
  { key: "supplier-approval", label: "Persetujuan supplier", href: "/pesanan-supplier", match: "/pesanan-supplier", icon: <><path d="M4 5h16v14H4z" /><path d="m8 12 2.5 2.5L16 9" /></> },
  { key: "invoice", label: "Invoice", href: "/invoice-pelanggan", match: "/invoice-pelanggan", icon: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /> },
  { key: "bayar", label: "Pembayaran", href: "/pembayaran", match: "/pembayaran", icon: <><path d="M4 7a2 2 0 012-2h12v4" /><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="16.5" cy="13.5" r="1.2" /></> },
  { key: "master", label: "Master data", href: "/master-data", match: "/master-data", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.6 0 4.5 1.8 4.5 4.5" /></> },
  { key: "keuangan", label: "Keuangan", href: "/keuangan", match: "/keuangan", icon: <path d="M5 20v-7M12 20V5M19 20v-10" /> },
] as const;
const quickActions = [["Pesanan Pelanggan", "/"], ["Order ke Supplier", "/operasional"], ["Persetujuan Supplier", "/pesanan-supplier"], ["Faktur Supplier", "/operasional#invoices"], ["Invoice Pelanggan", "/invoice-pelanggan"], ["Pembayaran", "/pembayaran"], ["Biaya Operasional", "/keuangan#biaya"]] as const;
const mobileMenuItems = [
  { label: "Profil", description: "Akun dan preferensi", href: "/profil", icon: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-7 8-7s8 3 8 7" /> },
  { label: "Persetujuan Supplier", description: "Buat PO, kirim WhatsApp, catat persetujuan", href: "/pesanan-supplier", icon: <><path d="M4 5h16v14H4z" /><path d="m8 12 2.5 2.5L16 9" /></> },
  { label: "Pembayaran", description: "Piutang, hutang, dan catat pembayaran", href: "/pembayaran", icon: <><path d="M4 7a2 2 0 012-2h12v4" /><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="16.5" cy="13.5" r="1.2" /></> },
  { label: "Master Data", description: "Pelanggan, supplier, dan barang", href: "/master-data", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.6 0 4.5 1.8 4.5 4.5" /></> },
  { label: "Keuangan", description: "Buku besar, biaya, dan laporan", href: "/keuangan", icon: <path d="M5 20v-7M12 20V5M19 20v-10" /> },
  { label: "Pengaturan usaha", description: "Konfigurasi usaha dan akses modul", href: "/pengaturan-usaha", icon: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.5" /></> },
] as const;
const searchItems = [
  ...NAV.map(n => ({ label: n.label, href: n.href })),
  ...["Pelanggan:/master-data#customers", "Supplier:/master-data#suppliers", "Barang:/master-data#products", "Harga per Pelanggan:/master-data#prices", "Daftar Akun:/master-data#accounts", "Jurnal Umum:/keuangan#jurnal", "Buku Besar:/keuangan#buku-besar", "Laba Rugi:/keuangan#laba-rugi", "Neraca:/keuangan#neraca", "Tutup Buku:/keuangan#tutup-buku", "PPN:/keuangan#ppn", "Piutang & Hutang:/pembayaran"].map(s => { const i = s.indexOf(":"); return { label: s.slice(0, i), href: s.slice(i + 1) }; }),
];

function NavIcon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const matches = useMemo(() => searchItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [query]);
  const dashActive = pathname.startsWith("/dashboard-keuangan");
  const menuActive = ["/lainnya", "/profil", "/pembayaran", "/pesanan-supplier", "/master-data", "/keuangan", "/pengaturan-usaha"].some(route => pathname === route || pathname.startsWith(`${route}/`));
  const homeActive = !dashActive && !menuActive;
  const isActive = (n: (typeof NAV)[number]) => ("exact" in n && n.exact ? pathname === n.match : pathname === n.match || pathname.startsWith(`${n.match}/`));

  useEffect(() => {
    const saved = window.localStorage.getItem("jena-theme");
    const useDark = saved ? saved === "dark" : false; // Desain awal terang; tema gelap hanya jika dipilih pengguna.
    const frame = window.requestAnimationFrame(() => setDark(useDark));
    document.documentElement.dataset.theme = useDark ? "dark" : "light";
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "Escape") { setPaletteOpen(false); setCreateOpen(false); setMobileMenuOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCreateOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMobileMenuOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("jena-theme", next ? "dark" : "light");
  }

  return <div className="app-root app-frame min-h-screen">
    <a href="#konten-utama" className="skip-link">Lewati ke konten</a>
    <aside className="nav-rail" aria-label="Menu utama">
      <Link href="/dashboard" className="nav-rail-logo" aria-label="Jena Medical Center — Home">J</Link>
      <nav className="nav-rail-list">
        {NAV.map(n => <Link key={n.key} href={n.href} title={n.label} aria-label={n.label} aria-current={isActive(n) ? "page" : undefined} className={`nav-rail-btn ${isActive(n) ? "nav-rail-btn-on" : ""}`}><NavIcon>{n.icon}</NavIcon></Link>)}
      </nav>
      <button type="button" className="nav-rail-btn" aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"} onClick={toggleTheme}><span aria-hidden="true">{dark ? "☼" : "◐"}</span></button>
    </aside>

    <div className="app-main">
      <header className="app-head">
        <button className="search-trigger" type="button" onClick={() => setPaletteOpen(true)}><span aria-hidden="true">⌕</span><span className="hidden sm:inline">Cari menu…</span><kbd className="hidden sm:inline">⌘ K</kbd></button>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button type="button" className="pill-button pill-button-solid" onClick={() => setCreateOpen(v => !v)} aria-expanded={createOpen}>＋ <span className="hidden sm:inline">Buat Baru</span></button>
            {createOpen && <div className="action-popover">{quickActions.map(([label, href]) => <Link key={label} href={href} onClick={() => setCreateOpen(false)}>{label}</Link>)}</div>}
          </div>
          <button type="button" className="icon-button relative" aria-label="Notifikasi" onClick={() => setNotice("Notifikasi akan menampilkan tindakan yang perlu ditinjau.")}>♧<span className="notification-dot" /></button>
          <AuthStatus />
        </div>
      </header>
      {notice && <div role="status" className="notice-banner mx-auto mt-3 max-w-[1500px] px-4 lg:px-8">{notice}<button className="ml-3 font-semibold" onClick={() => setNotice("")}>Tutup</button></div>}
      <div id="konten-utama" tabIndex={-1} className="pb-24 lg:pb-0">{children}</div>
    </div>

    {mobileMenuOpen && <div className="mobile-menu-backdrop lg:hidden" role="presentation" onMouseDown={() => setMobileMenuOpen(false)} />}
    {mobileMenuOpen && <section id="mobile-menu-panel" className="mobile-menu-panel lg:hidden" role="dialog" aria-label="Menu aplikasi">
      <div className="mobile-menu-head"><div><p className="mobile-menu-eyebrow">Jena Medica</p><h2>Menu</h2></div><button type="button" className="mobile-menu-close" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)}>×</button></div>
      <div className="mobile-menu-list">
        {mobileMenuItems.map(item => <Link key={item.href} href={item.href} className={`mobile-menu-row ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "mobile-menu-row-on" : ""}`} onClick={() => setMobileMenuOpen(false)}><span className="mobile-menu-icon"><NavIcon>{item.icon}</NavIcon></span><span className="mobile-menu-copy"><strong>{item.label}</strong><small>{item.description}</small></span><span className="mobile-menu-chevron" aria-hidden="true">›</span></Link>)}
        <button type="button" className="mobile-menu-row" onClick={() => { setMobileMenuOpen(false); setPaletteOpen(true); }}><span className="mobile-menu-icon mobile-menu-icon-shell"><NavIcon>{<path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 110-14.4 7.2 7.2 0 010 14.4z" />}</NavIcon></span><span className="mobile-menu-copy"><strong>Cari menu</strong><small>Temukan halaman dan transaksi</small></span><span className="mobile-menu-chevron" aria-hidden="true">⌕</span></button>
      </div>
    </section>}
    <nav className="mbar lg:hidden" aria-label="Menu bawah">
      <Link href="/dashboard" aria-label="Home" aria-current={homeActive ? "page" : undefined} className={`mbar-i ${homeActive ? "mbar-i-on" : ""}`}><NavIcon>{NAV[0].icon}</NavIcon><span>Home</span></Link>
      <Link href="/dashboard-keuangan" aria-label="Dashboard" aria-current={dashActive ? "page" : undefined} className={`mbar-c ${dashActive ? "mbar-c-on" : ""}`}><span className="mbar-ci"><NavIcon size={26}>{NAV[1].icon}</NavIcon></span><span>Dashboard</span></Link>
      <button type="button" aria-label="Menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-menu-panel" className={`mbar-i mbar-menu-button ${menuActive || mobileMenuOpen ? "mbar-i-on" : ""}`} onClick={() => setMobileMenuOpen(v => !v)}><NavIcon><path d="M4 6h16M4 12h16M4 18h16" /></NavIcon><span>Menu</span></button>
    </nav>

    {paletteOpen && <div className="palette-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setPaletteOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Pencarian global"><div className="flex items-center gap-3 border-b p-4"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari menu dan transaksi..." aria-label="Cari menu dan transaksi" className="min-w-0 flex-1 bg-transparent outline-none" /><kbd>ESC</kbd></div><div className="p-2">{matches.length ? matches.map(item => <Link className="command-result" key={`${item.label}-${item.href}`} href={item.href} onClick={() => { setPaletteOpen(false); setQuery(""); }}>{item.label}<span>Buka →</span></Link>) : <p className="p-4 text-sm opacity-60">Tidak ada hasil. Pencarian data transaksi aktif setelah sumber data terhubung.</p>}</div><p className="border-t px-4 py-3 text-xs opacity-60">Gunakan Ctrl/Cmd + K untuk membuka pencarian</p></section></div>}
  </div>;
}
