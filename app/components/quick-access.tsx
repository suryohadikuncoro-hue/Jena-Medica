import Link from "next/link";
import type { ReactNode } from "react";

type Counts = { confirmedOrders: number; supplierInvoiceDrafts: number; customerInvoiceDrafts: number; customerPayments: number };
const Glyph = ({ children }: { children: ReactNode }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;

/** Pintu masuk ke modul pada layar HP; pelanggan dibuka lewat Master data. */
export function QuickAccess({ counts, loading }: { counts: Counts; loading: boolean }) {
  const n = (v: number, unit: string) => (loading ? "Memuat…" : `${new Intl.NumberFormat("id-ID").format(v)} ${unit}`);
  const items: { label: string; href: string; hint: string; tone: "pink" | "yellow" | "mint"; icon: ReactNode }[] = [
    { label: "Pesanan", href: "/", hint: n(counts.confirmedOrders, "terkonfirmasi"), tone: "pink", icon: <><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></> },
    { label: "Order supplier", href: "/operasional", hint: n(counts.supplierInvoiceDrafts, "faktur draf"), tone: "yellow", icon: <><path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></> },
    { label: "Invoice", href: "/invoice-pelanggan", hint: n(counts.customerInvoiceDrafts, "draf"), tone: "mint", icon: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /> },
    { label: "Pembayaran", href: "/pembayaran", hint: n(counts.customerPayments, "tercatat"), tone: "pink", icon: <><path d="M4 7a2 2 0 012-2h12v4" /><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="16.5" cy="13.5" r="1.2" /></> },
    { label: "Master data", href: "/master-data", hint: "Pelanggan, supplier, barang", tone: "yellow", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.6 0 4.5 1.8 4.5 4.5" /></> },
    { label: "Keuangan", href: "/keuangan", hint: "Laporan dan pembukuan", tone: "mint", icon: <path d="M5 20v-7M12 20V5M19 20v-10" /> },
  ];
  return <section className="qa-section home-hp-quick" aria-labelledby="qa-title">
    <div className="home-hp-section-heading"><h2 id="qa-title" className="qa-title">Akses cepat</h2><span className="qa-sub">Geser untuk melihat</span></div>
    <nav className="home-hp-quick-list" aria-label="Akses cepat">
      {items.map(item => <Link key={item.label} href={item.href} className={`home-hp-quick-item home-hp-quick-${item.tone}`}><span className="home-hp-quick-icon"><Glyph>{item.icon}</Glyph></span><b>{item.label}</b><small>{item.hint}</small></Link>)}
    </nav>
  </section>;
}
