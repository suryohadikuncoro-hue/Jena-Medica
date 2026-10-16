"use client";

import { useEffect, useState } from "react";
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
    <p className="page-kicker">Tahap berikutnya</p>
    <h2 className="mt-1 text-lg font-semibold">Pembayaran & piutang belum terhubung</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Belum ada transaksi pembayaran atau saldo piutang yang ditampilkan. Modul ini akan mengikuti keputusan invoice pelanggan, alokasi pembayaran, dan perlakuan akuntansi; angka contoh sengaja tidak ditampilkan sebagai data nyata.</p>
  </section>;
}
