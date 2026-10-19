"use client";

import { useEffect, useState } from "react";
import { AuthStatus } from "@/app/components/auth-status";
import { IconKeuangan, IconMasterData, IconPembayaran, IconSearch } from "@/app/components/icons";
import { Card, ListRow, ListStack, SegmentedTabs } from "@/app/components/ui";
import { applyThemeMode, openGlobalSearch, readThemeMode, type ThemeMode } from "@/lib/theme";

const modes = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "auto", label: "Otomatis" },
] satisfies { value: ThemeMode; label: string }[];

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
    <Card className="mt-5" aria-label="Akun"><AuthStatus compact /></Card>
    <ListStack className="mt-4" aria-label="Menu lainnya">
      <ListRow href="/pembayaran" icon={<IconPembayaran />} tone="pink" title="Pembayaran" subtitle="Piutang, hutang, dan catat pembayaran" chevron />
      <ListRow href="/master-data" icon={<IconMasterData />} tone="yellow" title="Master Data" subtitle="Pelanggan, supplier, barang, harga khusus" chevron />
      <ListRow href="/keuangan" icon={<IconKeuangan />} tone="mint" title="Keuangan" subtitle="Buku besar, biaya, dan laporan" chevron />
      <ListRow onClick={openGlobalSearch} icon={<IconSearch />} tone="shell" title="Cari menu" subtitle="Pintasan Ctrl/Cmd + K" chevron />
    </ListStack>
    <section className="mt-6" aria-labelledby="tampilan-heading">
      <h2 id="tampilan-heading" className="text-lg font-bold tracking-tight">Tampilan</h2>
      <SegmentedTabs className="mt-3" label="Tema tampilan" items={modes} value={mode} onChange={chooseMode} />
    </section>
  </main>;
}
