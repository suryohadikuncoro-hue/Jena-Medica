"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShipmentManager } from "@/app/components/shipment-manager";

type Tab = "Pengiriman" | "Pembayaran";

export default function ShippingReceivablesPage() {
  const [tab, setTab] = useState<Tab>("Pengiriman");

  useEffect(() => {
    const sync = () => setTab(window.location.hash === "#payments" ? "Pembayaran" : "Pengiriman");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", `${window.location.pathname}${next === "Pembayaran" ? "#payments" : ""}`);
  }

  return <main className="page-wrap">
    <div className="mb-6">
      <p className="page-kicker">Transaksi · Siklus drop-ship</p>
      <h1 className="page-title">Pengiriman & pembayaran</h1>
      <p className="page-description">Pantau kiriman supplier langsung ke pelanggan. Pencatatan pembayaran/piutang akan diaktifkan setelah siklus invoice ditetapkan.</p>
    </div>
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Modul pengiriman dan pembayaran">
      {(["Pengiriman", "Pembayaran"] as const).map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} className="tab-button" onClick={() => switchTab(item)}>{item}</button>)}
    </div>
    {tab === "Pengiriman" ? <ShipmentManager /> : <PaymentPlaceholder />}
  </main>;
}

function PaymentPlaceholder() {
  return <section className="card card-pad">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="page-kicker">Kontrol keuangan</p><h2 className="mt-1 text-lg font-semibold">Pembayaran belum aktif</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Belum ada penerimaan pelanggan atau pembayaran supplier yang dapat dicatat. Invoice pelanggan masih draft dan faktur supplier masih capture dokumen; karena itu belum ada saldo piutang/hutang yang layak dialokasikan.</p></div><span className="status-pill">Tidak ada saldo demo</span></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-[var(--border)] p-4"><h3 className="text-sm font-semibold">Penerimaan pelanggan</h3><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Rencana alokasi parsial/multi-invoice hanya setelah invoice resmi tersedia. Kelebihan pembayaran akan menjadi kredit pelanggan, bukan alokasi berlebih.</p><Link className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)]" href="/invoice-pelanggan">Tinjau draft invoice →</Link></div><div className="rounded-xl border border-[var(--border)] p-4"><h3 className="text-sm font-semibold">Pembayaran supplier</h3><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Faktur supplier saat ini belum diposting sebagai AP. Pembayaran/uang muka belum dapat dibukukan atau dialokasikan.</p><Link className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)]" href="/operasional#invoices">Tinjau capture faktur →</Link></div></div>
    <p className="mt-5 rounded-xl bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--muted)]">Sebelum aktivasi diperlukan aturan ledger/COA, akun bank, role otorisasi, proteksi alokasi bersamaan, reversal dan bukti transaksi. Detail gerbang ada pada <Link className="font-semibold underline" href="/keuangan">status keuangan</Link>.</p>
  </section>;
}
