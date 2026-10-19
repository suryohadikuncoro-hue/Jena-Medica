"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AuthStatus } from "@/app/components/auth-status";
import { IconChevron, IconKeuangan, IconMasterData, IconPembayaran, IconSearch } from "@/app/components/icons";
import { applyThemeMode, openGlobalSearch, readThemeMode, type ThemeMode } from "@/lib/theme";

const menu: { label: string; description: string; href: string; icon: ReactNode; tone: string }[] = [
  { label: "Pembayaran", description: "Piutang, hutang, dan catat pembayaran", href: "/pembayaran", icon: <IconPembayaran />, tone: "var(--pink)" },
  { label: "Master Data", description: "Pelanggan, supplier, barang, harga khusus", href: "/master-data", icon: <IconMasterData />, tone: "var(--yellow)" },
  { label: "Keuangan", description: "Buku besar, biaya, dan laporan", href: "/keuangan", icon: <IconKeuangan />, tone: "var(--mint)" },
];

const modes: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "auto", label: "Otomatis" },
];

export default function LainnyaPage() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMode(readThemeMode()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function chooseMode(next: ThemeMode) {
    setMode(next);
    applyThemeMode(next);
  }

  return <main className="page-wrap lainnya-wrap">
    <h1 className="page-title">Lainnya</h1>
    <section className="card card-pad mt-5" aria-label="Akun"><AuthStatus compact /></section>
    <nav className="menu-list mt-4" aria-label="Menu lainnya">
      {menu.map(item => <Link key={item.href} href={item.href} className="menu-row"><span className="menu-row-icon" style={{ background: item.tone }}>{item.icon}</span><span className="menu-row-text"><strong>{item.label}</strong><small>{item.description}</small></span><span className="menu-row-chevron"><IconChevron /></span></Link>)}
      <button type="button" className="menu-row" onClick={openGlobalSearch}><span className="menu-row-icon" style={{ background: "var(--shell)" }}><IconSearch /></span><span className="menu-row-text"><strong>Cari menu</strong><small>Pintasan Ctrl/Cmd + K</small></span><span className="menu-row-chevron"><IconChevron /></span></button>
    </nav>
    <section className="mt-6" aria-labelledby="tampilan-heading">
      <h2 id="tampilan-heading" className="text-lg font-bold tracking-tight">Tampilan</h2>
      <div className="seg mt-3" role="group" aria-label="Tema tampilan">{modes.map(item => <button key={item.value} type="button" aria-pressed={mode === item.value} className="seg-item" onClick={() => chooseMode(item.value)}>{item.label}</button>)}</div>
    </section>
  </main>;
}
