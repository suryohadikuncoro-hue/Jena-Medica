"use client";

import { useEffect, useState } from "react";
import { ShipmentManager } from "@/app/components/shipment-manager";
import { PaymentManager } from "@/app/components/payment-manager";

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
      <p className="page-description">Catat penerimaan pelanggan dan pembayaran supplier yang telah terverifikasi. Alokasi baru dibuka setelah invoice atau faktur terkait diposting.</p>
    </div>
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Modul pengiriman dan pembayaran">
      {(["Pengiriman", "Pembayaran"] as const).map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} className="tab-button" onClick={() => switchTab(item)}>{item}</button>)}
    </div>
    {tab === "Pengiriman" ? <ShipmentManager /> : <PaymentManager />}
  </main>;
}
