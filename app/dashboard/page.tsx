"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

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

  const actions = [
    { label: "Pesanan terkonfirmasi", detail: "Periksa progres dan tindak lanjut", count: counts.confirmedOrders, action: "Buka pesanan", href: "/", tone: "accent" },
    { label: "Menunggu balasan", detail: "Order supplier terkirim", count: counts.sentPurchaseOrders, action: "Catat balasan", href: "/operasional", tone: "warning" },
    { label: "Faktur perlu dicek", detail: "Faktur supplier draf", count: counts.supplierInvoiceDrafts, action: "Periksa", href: "/operasional", tone: "danger" },
    { label: "Draft invoice pelanggan", detail: "Belum diterbitkan", count: counts.customerInvoiceDrafts, action: "Tinjau draft", href: "/invoice-pelanggan", tone: "success" },
  ] as const;
  const maxActivity = Math.max(1, ...activity.flatMap(point => [point.orders, point.invoices]));
  const todayLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return <main className="page-wrap dashboard-wrap">
    <div className="dashboard-heading"><div><p className="dashboard-greeting">Halo{name ? `, ${name}` : ""}</p><p className="dashboard-date-line">{todayLabel} · angka dari dokumen operasional</p></div><div className="dashboard-heading-actions"><button type="button" className="tab-button" onClick={() => void load()} disabled={loading}>{loading ? "Memuat…" : "Muat ulang"}</button><Link className="primary-button dashboard-create-button" href="/">＋ Pesanan baru</Link></div></div>
    {message && <div role="status" className="demo-banner mb-5"><strong>{loading ? "Memuat data." : "Ringkasan belum tersedia."}</strong> {message}{message.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</div>}

    <div className="dashboard-layout">
      <aside className="dashboard-left-column">
        <section className="dashboard-panel dashboard-summary" aria-labelledby="summary-heading">
          <div className="dashboard-panel-heading"><div><h2 id="summary-heading">Ringkasan</h2><p>Dokumen yang perlu diproses</p></div></div>
          <SummaryLine label="SO terkonfirmasi" sub="Status pesanan pada periode" count={counts.confirmedOrders} loading={loading} tone="accent" href="/" unit="pesanan" />
          <SummaryLine label="Menunggu supplier" sub="Order terkirim, menunggu tanggapan" count={counts.sentPurchaseOrders} loading={loading} tone="warning" href="/operasional" unit="order" />
          <SummaryLine label="Faktur perlu dicek" sub="Draf faktur supplier" count={counts.supplierInvoiceDrafts} loading={loading} tone="danger" href="/operasional" unit="faktur" />
          <Link href="/" className="dashboard-plus-action" aria-label="Buka pesanan baru">＋</Link>
        </section>
        <section className="dashboard-panel dashboard-billing" aria-labelledby="billing-heading">
          <div className="dashboard-billing-ring"><span>{loading ? "—" : formatCount(counts.issuedInvoices)}<small>invoice<br/>terbit</small></span></div>
          <h2 className="dashboard-billing-title" id="billing-heading">Status invoice</h2>
          <p className="dashboard-billing-subtitle">Jumlah dokumen pada periode pilihan</p>
          <div className="dashboard-billing-pair"><span>Draft<strong>{loading ? "—" : formatCount(counts.customerInvoiceDrafts)}</strong></span><span>Terbit<strong>{loading ? "—" : formatCount(counts.issuedInvoices)}</strong></span></div>
          <div className="dashboard-payment-pair"><Link href="/pembayaran">Penerimaan tercatat<strong>{loading ? "—" : formatCount(counts.customerPayments)}</strong></Link><Link href="/pembayaran">Pembayaran supplier<strong>{loading ? "—" : formatCount(counts.supplierPayments)}</strong></Link></div>
          <div className="dashboard-period-select" role="group" aria-label="Pilih periode">{periodOptions.map(option => <button key={option.key} type="button" aria-pressed={period === option.key} onClick={() => setPeriod(option.key)}>{option.label}</button>)}</div>
        </section>
      </aside>

      <section className="dashboard-center-column">
        <article className="dashboard-panel dashboard-activity" aria-labelledby="activity-heading">
          <div className="dashboard-panel-heading"><div><h2 id="activity-heading">Aktivitas Pesanan</h2><p>Jumlah pesanan terkonfirmasi dan invoice terbit per hari</p></div><span className="dashboard-date-range">{periodCaption("7d")}</span></div>
          <div className="activity-legend"><span><i className="legend-dot legend-orders" />Pesanan</span><span><i className="legend-dot legend-invoices" />Ditagih</span></div>
          {loading ? <div className="activity-skeleton" aria-label="Memuat aktivitas" /> : activity.length ? <div className="activity-chart" role="img" aria-label="Grafik jumlah pesanan terkonfirmasi dan invoice terbit per hari selama tujuh hari terakhir">{activity.map(point => <div className="activity-day" key={point.date}><div className="activity-bars"><span className="activity-bar activity-bar-orders" title={`${point.orders} pesanan`} style={{ height: point.orders ? `${Math.max(5, point.orders / maxActivity * 100)}%` : "0%" }} /><span className="activity-bar activity-bar-invoices" title={`${point.invoices} invoice terbit`} style={{ height: point.invoices ? `${Math.max(5, point.invoices / maxActivity * 100)}%` : "0%" }} /></div><span className="activity-day-label">{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${point.date}T12:00:00`))}</span></div>)}</div> : <p className="dashboard-empty">Data aktivitas belum tersedia.</p>}
          <p className="dashboard-chart-honesty">Grafik menampilkan jumlah dokumen, bukan nilai penjualan atau pendapatan.</p>
        </article>
        <section className="dashboard-panel dashboard-action-panel" aria-labelledby="action-heading">
          <div className="dashboard-panel-heading"><div><h2 id="action-heading">Perlu Tindakan</h2><p>Urut dari yang paling mendesak</p></div></div>
          <div className="dashboard-action-grid">{actions.map(item => <article key={item.label} className={`dashboard-action-card action-${item.tone}`}><span className="dashboard-action-icon" aria-hidden="true">{item.tone === "accent" ? "↗" : item.tone === "warning" ? "◷" : item.tone === "danger" ? "▤" : "＋"}</span><h3>{item.label}</h3><p className="dashboard-action-detail">{item.detail}</p><strong className="dashboard-action-count">{loading ? "—" : formatCount(item.count)} <small>dokumen</small></strong><Link href={item.href} className="dashboard-action-button">{item.action}</Link></article>)}</div>
        </section>
      </section>

      <aside className="dashboard-right-column">
        <section className="dashboard-panel dashboard-monitor" aria-labelledby="monitor-heading">
          <div className="dashboard-panel-heading"><div><h2 id="monitor-heading">Perlu Dipantau</h2><p>Dokumen yang butuh perhatian</p></div></div>
          <MonitorCard color="pink" eyebrow="Faktur supplier" title="Draf untuk diperiksa" count={counts.supplierInvoiceDrafts} loading={loading} href="/operasional" detail="Belum masuk pembukuan" />
          <MonitorCard color="yellow" eyebrow="Invoice pelanggan" title="Masih berupa draf" count={counts.customerInvoiceDrafts} loading={loading} href="/invoice-pelanggan" detail="Belum diterbitkan" />
          <MonitorCard color="mint" eyebrow="Invoice pelanggan" title="Sudah diterbitkan" count={counts.issuedInvoices} loading={loading} href="/invoice-pelanggan" detail="Status invoice, bukan status pembayaran" />
          <p className="dashboard-monitor-note">Pengiriman diurus supplier dan pelanggan, tidak dicatat di sini.</p>
        </section>
      </aside>
    </div>
    <p className="dashboard-honesty-note">Angka pada halaman ini dihitung dari dokumen aktual di Supabase. Angka tersebut bukan saldo kas, piutang, hutang, pendapatan, atau laba.</p>
  </main>;
}

function SummaryLine({ label, sub, count, loading, tone, href, unit }: { label: string; sub: string; count: number; loading: boolean; tone: string; href: string; unit: string }) {
  return <Link href={href} className={`dashboard-summary-line line-${tone}`}><span className="dashboard-summary-copy"><strong>{label}</strong><small>{sub}</small></span><span className="dashboard-summary-count">{loading ? "—" : formatCount(count)}<small>{unit}</small></span></Link>;
}
function MonitorCard({ color, eyebrow, title, count, loading, href, detail }: { color: string; eyebrow: string; title: string; count: number; loading: boolean; href: string; detail: string }) {
  return <Link href={href} className={`dashboard-monitor-card monitor-${color}`}><span className="dashboard-monitor-eyebrow">{eyebrow}</span><strong>{title}<span>{loading ? "—" : formatCount(count)}</span></strong><small>{detail}</small></Link>;
}
