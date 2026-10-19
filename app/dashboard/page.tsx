"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { IconInvoice, IconOrder, IconPembayaran, IconPesanan } from "@/app/components/icons";
import { ActionBanner, Button, ButtonLink, SegmentedTabs, TotalCard, type Tone } from "@/app/components/ui";

type Period = "7d" | "30d" | "ytd";
type Counts = {
  confirmedOrders: number;
  sentPurchaseOrders: number;
  supplierInvoiceDrafts: number;
  customerInvoiceDrafts: number;
  issuedInvoices: number;
  customerPayments: number;
  supplierPayments: number;
};
type DayPoint = { date: string; orders: number; invoices: number };
const emptyCounts: Counts = {
  confirmedOrders: 0,
  sentPurchaseOrders: 0,
  supplierInvoiceDrafts: 0,
  customerInvoiceDrafts: 0,
  issuedInvoices: 0,
  customerPayments: 0,
  supplierPayments: 0,
};
const periodOptions: { key: Period; label: string }[] = [
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "ytd", label: "Tahun ini" },
];

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function sinceDate(period: Period) {
  const date = new Date();
  if (period === "ytd") return `${date.getFullYear()}-01-01`;
  date.setDate(date.getDate() - (period === "7d" ? 6 : 29));
  return localDate(date);
}
function formatCount(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}
function periodCaption(period: Period) {
  const start = new Date(`${sinceDate(period)}T12:00:00`);
  const end = new Date();
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return `${date.format(start)} – ${date.format(end)}`;
}
function greetingName(user: { user_metadata?: Record<string, unknown>; email?: string } | null) {
  const metadata = user?.user_metadata ?? {};
  const name = metadata.full_name ?? metadata.name ?? metadata.display_name;
  if (typeof name === "string" && name.trim()) return name.trim().split(/\s+/)[0];
  return user?.email?.split("@")[0] ?? "";
}

async function exactCount(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  table: string,
  status: string,
  dateColumn: string,
  start: string,
  end = localDate(new Date()),
) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .gte(dateColumn, start)
    .lte(dateColumn, end);
  if (error) throw error;
  return count ?? 0;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [activity, setActivity] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const start = useMemo(() => sinceDate(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    if (!isSupabaseConfigured()) {
      setMessage("Supabase belum dikonfigurasi pada environment ini.");
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage("Masuk untuk melihat ringkasan transaksi aktual.");
        setCounts(emptyCounts);
        setActivity([]);
        setLoading(false);
        return;
      }
      const role = String(session.user.app_metadata?.business_role ?? "");
      if (!["owner", "admin", "viewer"].includes(role)) {
        setMessage("Akun ini belum memiliki role bisnis yang valid.");
        setCounts(emptyCounts);
        setActivity([]);
        setLoading(false);
        return;
      }
      setName(greetingName(session.user));
      const [confirmedOrders, sentPurchaseOrders, supplierInvoiceDrafts, customerInvoiceDrafts, issuedInvoices, customerPayments, supplierPayments] = await Promise.all([
        exactCount(supabase, "sales_orders", "confirmed", "order_date", start),
        exactCount(supabase, "purchase_orders", "sent", "order_date", start),
        exactCount(supabase, "supplier_invoices", "draft", "invoice_date", start),
        exactCount(supabase, "sales_invoices", "draft", "invoice_date", start),
        exactCount(supabase, "sales_invoices", "issued", "invoice_date", start),
        exactCount(supabase, "customer_payments", "recorded", "payment_date", start),
        exactCount(supabase, "supplier_payments", "recorded", "payment_date", start),
      ]);
      setCounts({ confirmedOrders, sentPurchaseOrders, supplierInvoiceDrafts, customerInvoiceDrafts, issuedInvoices, customerPayments, supplierPayments });

      const today = new Date();
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        return localDate(date);
      });
      const points = await Promise.all(days.map(async (date) => {
        const [orders, invoices] = await Promise.all([
          exactCount(supabase, "sales_orders", "confirmed", "order_date", date, date),
          exactCount(supabase, "sales_invoices", "issued", "invoice_date", date, date),
        ]);
        return { date, orders, invoices };
      }));
      setActivity(points);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Ringkasan tidak dapat dimuat dari Supabase.");
      setCounts(emptyCounts);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [start]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const dash = (value: number) => (loading ? "—" : formatCount(value));
  const actions: { label: string; detail: string; count: number; action: string; href: string; tone: Tone; icon: ReactNode }[] = [
    { label: "Pesanan terkonfirmasi", detail: "Periksa progres dan tindak lanjut", count: counts.confirmedOrders, action: "Buka pesanan", href: "/", tone: "yellow", icon: <IconPesanan /> },
    { label: "Menunggu balasan", detail: "Order supplier terkirim", count: counts.sentPurchaseOrders, action: "Catat balasan", href: "/operasional", tone: "yellow", icon: <IconOrder /> },
    { label: "Faktur perlu dicek", detail: "Faktur supplier draf", count: counts.supplierInvoiceDrafts, action: "Periksa", href: "/operasional", tone: "pink", icon: <IconOrder /> },
    { label: "Draf invoice pelanggan", detail: "Belum diterbitkan", count: counts.customerInvoiceDrafts, action: "Tinjau draf", href: "/invoice-pelanggan", tone: "gray", icon: <IconInvoice /> },
  ];
  const quick = [
    { label: "Pesanan", href: "/", tone: "pink", icon: <IconPesanan /> },
    { label: "Order", href: "/operasional", tone: "yellow", icon: <IconOrder /> },
    { label: "Faktur", href: "/operasional", tone: "mint", icon: <IconOrder /> },
    { label: "Invoice", href: "/invoice-pelanggan", tone: "yellow", icon: <IconInvoice /> },
    { label: "Bayar", href: "/pembayaran", tone: "pink", icon: <IconPembayaran /> },
  ];
  const maxActivity = Math.max(1, ...activity.flatMap(point => [point.orders, point.invoices]));
  const todayLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const periodLabel = periodOptions.find(option => option.key === period)?.label ?? "";

  return <main className="page-wrap dash-wrap">
    <header className="dash-header">
      <div><h1 className="dash-greeting">Halo{name ? `, ${name}` : ""}</h1><p className="dash-date">{todayLabel} · angka dari dokumen operasional</p></div>
      <div className="dash-header-actions"><Button size="sm" className="dash-desktop-only" onClick={() => void load()} disabled={loading}>{loading ? "Memuat…" : "Muat ulang"}</Button><ButtonLink variant="solid" href="/">+ Pesanan baru</ButtonLink></div>
    </header>
    {message && <ActionBanner className="dash-message" action={message.includes("Masuk") ? <ButtonLink href="/login" variant="solid" size="sm">Masuk</ButtonLink> : undefined}><b>{loading ? "Memuat data." : "Ringkasan belum tersedia."}</b> {message}</ActionBanner>}

    <div className="dash-mobile-only dash-hero">
      <TotalCard label={`Invoice terbit · ${periodLabel}`} value={dash(counts.issuedInvoices)} note={`${dash(counts.customerInvoiceDrafts)} draf invoice menunggu tinjauan`} />
      <nav className="dash-quick" aria-label="Aksi cepat">{quick.map(item => <Link key={item.label} href={item.href} className="dash-quick-item"><span className={`dash-quick-icon ui-tone-${item.tone}`}>{item.icon}</span>{item.label}</Link>)}</nav>
    </div>

    <div className="dash-grid">
      <div className="dash-col">
        <section className="dash-sec dash-order-1" aria-labelledby="summary-heading">
          <div className="dash-sec-head"><div><h2 id="summary-heading">Ringkasan</h2><p>Dokumen yang perlu diproses</p></div></div>
          <SegmentedTabs label="Pilih periode" items={periodOptions.map(option => ({ value: option.key, label: option.label }))} value={period} onChange={setPeriod} />
          <div className="dash-stat-grid">
            <SummaryCard label="SO terkonfirmasi" note="status pesanan pada periode" unit="pesanan" value={dash(counts.confirmedOrders)} href="/" />
            <SummaryCard label="Menunggu supplier" note="order terkirim, belum dibalas" unit="order" value={dash(counts.sentPurchaseOrders)} href="/operasional" />
            <SummaryCard label="Faktur perlu dicek" note="draf faktur supplier" unit="faktur" value={dash(counts.supplierInvoiceDrafts)} href="/operasional" />
            <SummaryCard label="Draf invoice" note="belum diterbitkan" unit="draf" value={dash(counts.customerInvoiceDrafts)} href="/invoice-pelanggan" />
          </div>
        </section>
        <section className="dash-sec dash-order-5" aria-labelledby="status-heading">
          <div className="dash-sec-head"><div><h2 id="status-heading">Status invoice</h2><p>Jumlah dokumen pada periode pilihan</p></div></div>
          <div className="dash-stat-grid">
            <SummaryCard label="Draf" unit="invoice" value={dash(counts.customerInvoiceDrafts)} href="/invoice-pelanggan" />
            <SummaryCard label="Terbit" unit="invoice" value={dash(counts.issuedInvoices)} href="/invoice-pelanggan" />
            <SummaryCard label="Penerimaan tercatat" unit="pembayaran" value={dash(counts.customerPayments)} href="/pembayaran" />
            <SummaryCard label="Pembayaran supplier" unit="pembayaran" value={dash(counts.supplierPayments)} href="/pembayaran" />
          </div>
        </section>
      </div>

      <div className="dash-col">
        <section className="dash-sec dash-order-4" aria-labelledby="activity-heading">
          <div className="dash-sec-head"><div><h2 id="activity-heading">Aktivitas Pesanan</h2><p>Jumlah pesanan terkonfirmasi dan invoice terbit per hari</p></div><span className="dash-range">{periodCaption("7d")}</span></div>
          <div className="ui-card dash-chart-card">
            <div className="dash-legend"><span><i className="dash-dot dash-dot-orders" />Pesanan</span><span><i className="dash-dot dash-dot-invoices" />Ditagih</span></div>
            {loading ? <div className="dash-chart-skeleton ui-skeleton" aria-label="Memuat aktivitas" /> : activity.length ? <div className="dash-chart" role="img" aria-label="Grafik jumlah pesanan terkonfirmasi dan invoice terbit per hari selama tujuh hari terakhir">{activity.map(point => <div className="dash-day" key={point.date}><div className="dash-bars"><span className="dash-bar dash-bar-orders" title={`${point.orders} pesanan`} style={{ height: point.orders ? `${Math.max(5, point.orders / maxActivity * 100)}%` : "0%" }} /><span className="dash-bar dash-bar-invoices" title={`${point.invoices} invoice terbit`} style={{ height: point.invoices ? `${Math.max(5, point.invoices / maxActivity * 100)}%` : "0%" }} /></div><span className="dash-day-label">{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${point.date}T12:00:00`))}</span></div>)}</div> : <p className="dash-empty">Data aktivitas belum tersedia.</p>}
            <p className="dash-note">Grafik menampilkan jumlah dokumen, bukan nilai penjualan atau pendapatan.</p>
          </div>
        </section>
        <section className="dash-sec dash-order-2" aria-labelledby="action-heading">
          <div className="dash-sec-head"><div><h2 id="action-heading">Perlu Tindakan</h2><p>Urut dari yang paling mendesak</p></div></div>
          <div className="dash-action-list">{actions.map(item => <div key={item.label} className="ui-card dash-action-row"><span className={`ui-row-icon ui-tone-${item.tone}`} aria-hidden="true">{item.icon}</span><span className="ui-row-text"><strong>{item.label}</strong><small>{dash(item.count)} dokumen · {item.detail}</small></span><ButtonLink href={item.href} size="sm">{item.action}</ButtonLink></div>)}</div>
        </section>
      </div>

      <div className="dash-col">
        <section className="dash-sec dash-order-3" aria-labelledby="monitor-heading">
          <div className="dash-sec-head"><div><h2 id="monitor-heading">Perlu Dipantau</h2><p>Dokumen yang butuh perhatian</p></div></div>
          <div className="dash-monitor-list">
            <MonitorCard tone="pink" eyebrow="Faktur supplier" title="Draf untuk diperiksa" count={dash(counts.supplierInvoiceDrafts)} href="/operasional" detail="Belum masuk pembukuan" />
            <MonitorCard tone="yellow" eyebrow="Invoice pelanggan" title="Masih berupa draf" count={dash(counts.customerInvoiceDrafts)} href="/invoice-pelanggan" detail="Belum diterbitkan" />
            <MonitorCard tone="mint" eyebrow="Invoice pelanggan" title="Sudah diterbitkan" count={dash(counts.issuedInvoices)} href="/invoice-pelanggan" detail="Status invoice, bukan status pembayaran" />
          </div>
          <p className="dash-note">Pengiriman diurus supplier dan pelanggan, tidak dicatat di sini.</p>
        </section>
      </div>
    </div>
    <p className="dash-note dash-footnote">Angka pada halaman ini dihitung dari dokumen aktual di Supabase. Angka tersebut bukan saldo kas, piutang, hutang, pendapatan, atau laba.</p>
  </main>;
}

function SummaryCard({ label, note, unit, value, href }: { label: string; note?: string; unit: string; value: string; href: string }) {
  return <Link href={href} className="ui-card ui-stat"><div className="ui-stat-label">{label}</div><div className="ui-stat-value">{value}<span className="ui-stat-unit"> {unit}</span></div>{note ? <div className="ui-stat-note">{note}</div> : null}</Link>;
}
function MonitorCard({ tone, eyebrow, title, count, href, detail }: { tone: "pink" | "yellow" | "mint"; eyebrow: string; title: string; count: string; href: string; detail: string }) {
  return <Link href={href} className={`dash-monitor-card ui-tone-${tone}`}><span className="dash-monitor-top"><span>{eyebrow}</span><strong>{count}</strong></span><strong className="dash-monitor-title">{title}</strong><small>{detail}</small></Link>;
}
