"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { applyThemeMode, isDarkMode, OPEN_SEARCH_EVENT, readThemeMode } from "@/lib/theme";
import { IconDashboard, IconInvoice, IconKeuangan, IconLainnya, IconMasterData, IconMoon, IconOrder, IconPembayaran, IconPesanan, IconSearch, IconSun, IconUser } from "@/app/components/icons";

type NavItem = { label: string; href: string; icon: ReactNode; match: (path: string) => boolean };

const starts = (prefix: string) => (path: string) => path === prefix || path.startsWith(`${prefix}/`);

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <IconDashboard />, match: starts("/dashboard") },
  { label: "Pesanan", href: "/", icon: <IconPesanan />, match: path => path === "/" },
  { label: "Order supplier", href: "/operasional", icon: <IconOrder />, match: starts("/operasional") },
  { label: "Master data", href: "/master-data", icon: <IconMasterData />, match: starts("/master-data") },
  { label: "Invoice", href: "/invoice-pelanggan", icon: <IconInvoice />, match: starts("/invoice-pelanggan") },
  { label: "Pembayaran", href: "/pembayaran", icon: <IconPembayaran />, match: starts("/pembayaran") },
  { label: "Keuangan", href: "/keuangan", icon: <IconKeuangan />, match: starts("/keuangan") },
];

const bottomItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <IconDashboard />, match: starts("/dashboard") },
  { label: "Pesanan", href: "/", icon: <IconPesanan />, match: path => path === "/" },
  { label: "Order", href: "/operasional", icon: <IconOrder />, match: starts("/operasional") },
  { label: "Invoice", href: "/invoice-pelanggan", icon: <IconInvoice />, match: starts("/invoice-pelanggan") },
  { label: "Lainnya", href: "/lainnya", icon: <IconLainnya />, match: path => ["/lainnya", "/pembayaran", "/master-data", "/keuangan"].some(prefix => starts(prefix)(path)) },
];

const searchItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Pesanan Pelanggan", href: "/" },
  { label: "Order ke Supplier", href: "/operasional" },
  { label: "Faktur Supplier", href: "/operasional#invoices" },
  { label: "Invoice Pelanggan", href: "/invoice-pelanggan" },
  { label: "Pembayaran", href: "/pembayaran" },
  { label: "Piutang & Hutang", href: "/pembayaran" },
  { label: "Pelanggan", href: "/master-data#customers" },
  { label: "Supplier", href: "/master-data#suppliers" },
  { label: "Barang", href: "/master-data#products" },
  { label: "Harga per Pelanggan", href: "/master-data#prices" },
  { label: "Daftar Akun", href: "/master-data#accounts" },
  { label: "Jurnal Umum", href: "/keuangan#jurnal" },
  { label: "Buku Besar", href: "/keuangan#buku-besar" },
  { label: "Biaya Operasional", href: "/keuangan#biaya" },
  { label: "Tutup Buku", href: "/keuangan#tutup-buku" },
  { label: "Laba Rugi", href: "/keuangan#laba-rugi" },
  { label: "Neraca", href: "/keuangan#neraca" },
  { label: "Arus Kas", href: "/keuangan#arus-kas" },
  { label: "PPN", href: "/keuangan#ppn" },
  { label: "Lainnya", href: "/lainnya" },
];

const bareRoutes = ["/login", "/set-password"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const matches = useMemo(() => searchItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [query]);
  const bare = bareRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    const mode = readThemeMode();
    const useDark = isDarkMode(mode);
    const frame = window.requestAnimationFrame(() => setDark(useDark));
    document.documentElement.dataset.theme = useDark ? "dark" : "light";
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    const onOpenSearch = () => setPaletteOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch); };
  }, []);

  function toggleTheme() {
    setDark(applyThemeMode(dark ? "light" : "dark"));
  }

  if (bare) return <div className="app-root min-h-screen">{children}</div>;

  return <div className="app-root app-frame">
    <aside className="rail-col">
      <Link href="/dashboard" className="rail-logo" aria-label="Jena Medical Center, Dashboard">J</Link>
      <nav className="rail" aria-label="Menu utama">
        {navItems.map(item => {
          const active = item.match(pathname);
          return <Link key={item.href} href={item.href} className="rail-btn" title={item.label} aria-label={item.label} aria-current={active ? "page" : undefined}>{item.icon}</Link>;
        })}
        <span className="rail-spacer" />
        <button type="button" className="rail-btn" title="Cari (Ctrl+K)" aria-label="Cari menu" onClick={() => setPaletteOpen(true)}><IconSearch /></button>
        <button type="button" className="rail-btn" title={dark ? "Tema terang" : "Tema gelap"} aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"} onClick={toggleTheme}>{dark ? <IconSun /> : <IconMoon />}</button>
        <Link href="/lainnya" className="rail-avatar" title="Akun dan menu lainnya" aria-label="Akun dan menu lainnya"><IconUser /></Link>
      </nav>
    </aside>
    <div className="app-main">{children}</div>
    <nav className="bottom-nav" aria-label="Menu bawah">
      {bottomItems.map(item => {
        const active = item.match(pathname);
        return <Link key={item.href} href={item.href} className="bottom-nav-item" aria-current={active ? "page" : undefined}><span className="bottom-nav-icon">{item.icon}</span>{item.label}</Link>;
      })}
    </nav>
    {paletteOpen && <div className="palette-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setPaletteOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Pencarian menu"><div className="flex items-center gap-3 border-b p-4"><span aria-hidden="true" className="flex"><IconSearch /></span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari menu..." aria-label="Cari menu" className="min-w-0 flex-1 bg-transparent outline-none"/><kbd>ESC</kbd></div><div className="p-2">{matches.length ? matches.map(item => <Link className="command-result" key={`${item.label}-${item.href}`} href={item.href} onClick={() => { setPaletteOpen(false); setQuery(""); }}>{item.label}<span>Buka →</span></Link>) : <p className="p-4 text-sm opacity-60">Tidak ada menu yang cocok.</p>}</div><p className="border-t px-4 py-3 text-xs opacity-60">Gunakan Ctrl/Cmd + K untuk membuka pencarian</p></section></div>}
  </div>;
}
