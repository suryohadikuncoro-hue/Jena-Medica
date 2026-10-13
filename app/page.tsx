"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/* ───────────────────────── Types & data ───────────────────────── */

type Tone = "amber" | "green" | "blue" | "red";
type Status = "Menunggu pembayaran" | "Terkirim" | "Lunas" | "Retur" | "Diproses";
type Line = { product: string; batch: string; qty: string; price: string; subtotal: string };
type Invoice = {
  id: string; date: string; due: string; customer: string; code: string; amount: number;
  status: Status; tone: Tone; shipping: string; shippingTone: Tone; lines: Line[];
};

const L = (product: string, batch: string, qty: string, price: string, subtotal: string): Line => ({ product, batch, qty, price, subtotal });
const AMX = "Amoxicillin 500 mg", PCM = "Paracetamol 500 mg", VTC = "Vitamin C 500 mg", OMP = "Omeprazole 20 mg";

const invoices: Invoice[] = [
  { id: "INV-2026-0148", date: "13 Okt 2026", due: "27 Okt 2026", customer: "Apotek Sehat Sentosa", code: "AP0001", amount: 12450000, status: "Menunggu pembayaran", tone: "amber", shipping: "Belum dikirim", shippingTone: "blue", lines: [
    L(AMX, "AMX-26041", "240 strip", "Rp 15.000", "Rp 3.600.000"), L(PCM, "PCM-26018", "300 box", "Rp 12.500", "Rp 3.750.000"),
    L(VTC, "VTC-26027", "150 box", "Rp 22.000", "Rp 3.300.000"), L(OMP, "OMP-26011", "60 box", "Rp 30.000", "Rp 1.800.000") ] },
  { id: "INV-2026-0147", date: "13 Okt 2026", due: "28 Okt 2026", customer: "Klinik Medika Utama", code: "KMU001", amount: 8750000, status: "Terkirim", tone: "green", shipping: "Terkirim", shippingTone: "green", lines: [
    L(PCM, "PCM-26018", "200 box", "Rp 12.500", "Rp 2.500.000"), L(VTC, "VTC-26027", "125 box", "Rp 22.000", "Rp 2.750.000"), L(OMP, "OMP-26011", "100 box", "Rp 35.000", "Rp 3.500.000") ] },
  { id: "INV-2026-0146", date: "12 Okt 2026", due: "27 Okt 2026", customer: "RS Anugerah", code: "RSA003", amount: 6120000, status: "Lunas", tone: "green", shipping: "Terkirim", shippingTone: "green", lines: [
    L(AMX, "AMX-26041", "200 strip", "Rp 15.000", "Rp 3.000.000"), L(PCM, "PCM-26018", "120 box", "Rp 12.500", "Rp 1.500.000"), L(VTC, "VTC-26027", "60 box", "Rp 27.000", "Rp 1.620.000") ] },
  { id: "INV-2026-0145", date: "11 Okt 2026", due: "26 Okt 2026", customer: "Apotek Kencana", code: "APK004", amount: 7320000, status: "Menunggu pembayaran", tone: "amber", shipping: "Terkirim", shippingTone: "green", lines: [
    L(OMP, "OMP-26011", "100 box", "Rp 30.000", "Rp 3.000.000"), L(VTC, "VTC-26027", "120 box", "Rp 22.000", "Rp 2.640.000"), L(PCM, "PCM-26018", "134 box", "Rp 12.537", "Rp 1.680.000") ] },
  { id: "INV-2026-0144", date: "10 Okt 2026", due: "24 Okt 2026", customer: "Klinik Bina Sehat", code: "KBS006", amount: 5680000, status: "Terkirim", tone: "green", shipping: "Dalam pengiriman", shippingTone: "blue", lines: [
    L(VTC, "VTC-26027", "100 box", "Rp 22.000", "Rp 2.200.000"), L(OMP, "OMP-26011", "60 box", "Rp 30.000", "Rp 1.800.000"), L(AMX, "AMX-26041", "112 strip", "Rp 15.000", "Rp 1.680.000") ] },
  { id: "INV-2026-0143", date: "9 Okt 2026", due: "23 Okt 2026", customer: "Apotek Mitra Husada", code: "AMH008", amount: 4590000, status: "Retur", tone: "red", shipping: "Selesai", shippingTone: "green", lines: [
    L(PCM, "PCM-26018", "160 box", "Rp 12.500", "Rp 2.000.000"), L(VTC, "VTC-26027", "80 box", "Rp 22.000", "Rp 1.760.000"), L(OMP, "OMP-26011", "26 box", "Rp 31.923", "Rp 830.000") ] },
];

const nav = [
  { label: "Dashboard", icon: "home" }, { label: "Penjualan", icon: "receipt" }, { label: "Master data", icon: "box" },
  { label: "Operasional", icon: "bag" }, { label: "Pengiriman & piutang", icon: "wallet" }, { label: "Keuangan", icon: "chart" },
];
const detailTabs = ["Detail barang", "Pembayaran", "Pengiriman", "Aktivitas", "Catatan"];
const quickTabs = ["Semua", "Belum lunas", "Lunas", "Retur"] as const;
const isUnpaid = (invoice: Invoice) => invoice.status === "Menunggu pembayaran" || invoice.status === "Terkirim" || invoice.status === "Diproses";
const monthNumber: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", Mei: "05", Jun: "06", Jul: "07", Agu: "08", Sep: "09", Okt: "10", Nov: "11", Des: "12" };
const invoiceMonth = (date: string) => { const [, month, year] = date.split(" "); return `${year}-${monthNumber[month] ?? "00"}`; };
const periodKey = (period: string) => { const [month, year] = period.split(" "); return `${year}-${monthNumber[month] ?? "00"}`; };
const parseInvoiceDate = (date: string) => {
  const [day, month, year] = date.split(" ");
  return new Date(Number(year), Number(monthNumber[month] ?? "01") - 1, Number(day));
};
const sampleReferenceDate = invoices.reduce((latest, invoice) => {
  const current = parseInvoiceDate(invoice.date);
  return current > latest ? current : latest;
}, parseInvoiceDate(invoices[0].date));
const unpaidAmount = invoices.filter(isUnpaid).reduce((total, invoice) => total + invoice.amount, 0);
const dueSoonAmount = invoices.filter(isUnpaid).filter((invoice) => {
  const daysUntilDue = (parseInvoiceDate(invoice.due).getTime() - sampleReferenceDate.getTime()) / 86400000;
  return daysUntilDue >= 0 && daysUntilDue <= 30;
}).reduce((total, invoice) => total + invoice.amount, 0);
const sampleMonthSales = invoices.filter((invoice) => invoiceMonth(invoice.date) === "2026-10")
  .reduce((total, invoice) => total + invoice.amount, 0);

/* ───────────────────────── Helpers ───────────────────────── */

const money = (v: number) => "Rp " + new Intl.NumberFormat("id-ID").format(v);
const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");
const avatarColors = ["#F4B860", "#7DD3C0", "#F28AA0", "#8EC5FF", "#C4A8FF", "#B8F24A"];
const avatarColor = (code: string) => avatarColors[[...code].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarColors.length];
const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8F24A]";

const paths: Record<string, string> = {
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5", bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  plus: "M12 5v14M5 12h14", filter: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1", calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1", send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2", chevron: "M6 9l6 6 6-6", up: "M7 17L17 7M8 7h9v9", print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z",
  alert: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5M12 16.5v.01", dots: "M5 12v.01M12 12v.01M19 12v.01", back: "M19 12H5M12 19l-7-7 7-7", export: "M12 3v12M7 8l5-5 5 5M5 21h14", check: "M5 13l4 4L19 7",
  home: "M3 11l9-8 9 8M5 10v10h14V10", receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6", bag: "M5 8h14l-1 12H6zM9 8a3 3 0 016 0",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10", wallet: "M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l2-3h12M16 14h2", chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

const dot: Record<Tone, string> = { amber: "bg-amber-300", green: "bg-emerald-300", blue: "bg-sky-300", red: "bg-rose-300" };
const shortStatus = (s: Status) => (s === "Menunggu pembayaran" ? "Belum lunas" : s);

function Pill({ tone, children, variant = "dot" }: { tone: Tone; children: ReactNode; variant?: "dot" | "quiet" | "solid" }) {
  const style = variant === "solid" ? "bg-white text-[#14172B]" : variant === "quiet" ? "bg-white/10 text-slate-300" : "bg-white/15 text-white";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {variant === "dot" && <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />}{children}
    </span>
  );
}

const FX = `
@keyframes jm-rise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes jm-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes jm-reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes jm-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes jm-ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,currentColor 45%,transparent)}100%{box-shadow:0 0 0 9px color-mix(in srgb,currentColor 0%,transparent)}}
@keyframes jm-shine{from{transform:translateX(-130%)}to{transform:translateX(330%)}}
@keyframes jm-drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-22px,16px) scale(1.08)}}
@keyframes jm-toast{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
.jm-rise{animation:jm-rise .65s cubic-bezier(.2,.7,.2,1) backwards}
@keyframes jm-arc{from{stroke-dasharray:0 1}}
@keyframes jm-op{from{opacity:0}}
.jm-arc{animation:jm-arc 1.1s cubic-bezier(.3,.7,.2,1) both}
.jm-op{animation:jm-op .5s ease both}
.jm-bar{transform-origin:bottom;animation:jm-grow .8s cubic-bezier(.2,.8,.2,1) both}
.jm-reveal{animation:jm-reveal 1.1s cubic-bezier(.3,.7,.2,1) .3s both}
.jm-swap{animation:jm-fade .45s cubic-bezier(.2,.7,.2,1) both}
.jm-ring{animation:jm-ring 1.8s ease-out infinite}
.jm-drift{animation:jm-drift 10s ease-in-out infinite}
.jm-toast{animation:jm-toast .35s cubic-bezier(.2,.8,.2,1) both}
.jm-shine{position:relative;overflow:hidden}
.jm-shine::after{content:"";position:absolute;inset:0;width:35%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:translateX(-130%);pointer-events:none}
.jm-shine:hover::after{animation:jm-shine .9s ease}
.jm-spot::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(260px circle at var(--mx,50%) var(--my,0%),rgba(122,105,246,.16),transparent 70%)}
.jm-spot:hover::before{opacity:1}
@media (prefers-reduced-motion:reduce){.jm-rise,.jm-arc,.jm-op,.jm-bar,.jm-reveal,.jm-swap,.jm-ring,.jm-drift,.jm-toast,.jm-shine:hover::after{animation:none!important}}
`;

function useCountUp(target: number, ms = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const MONTHS = ["Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt"];
const smooth = (pts: number[][]) => pts.reduce((d, p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `${d} C${(pts[i - 1][0] + p[0]) / 2} ${pts[i - 1][1]} ${(pts[i - 1][0] + p[0]) / 2} ${p[1]} ${p[0]} ${p[1]}`), "");

/** Kartu label mengambang, seperti label "Option 01" di referensi. */
function Chip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-px text-[11px] leading-[15px] shadow-[0_3px_10px_rgba(60,70,140,.12)] ring-1 ring-[#EEF0FA]">
      <span className="flex min-w-0 items-center gap-1.5 text-[#5E6488]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} /><span className="truncate">{label}</span></span>
      <span className="font-semibold tabular-nums text-[#14172F]">{value}</span>
    </div>
  );
}

/** Ringkasan jatuh tempo dihitung dari faktur contoh, bukan angka ilustrasi. */
const agingBuckets = [
  { label: "Jatuh tempo 0–7 hari", min: 0, max: 7, color: "#22D3EE" },
  { label: "Jatuh tempo 8–14 hari", min: 8, max: 14, color: "#A78BFA" },
  { label: "Jatuh tempo 15–30 hari", min: 15, max: 30, color: "#FB923C" },
].map((bucket) => ({
  ...bucket,
  amount: invoices.filter((invoice) => isUnpaid(invoice)).filter((invoice) => {
    const days = (parseInvoiceDate(invoice.due).getTime() - sampleReferenceDate.getTime()) / 86400000;
    return days >= bucket.min && days <= bucket.max;
  }).reduce((total, invoice) => total + invoice.amount, 0),
}));
function AgingGauge() {
  const total = agingBuckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const arcs = agingBuckets.map((bucket, index) => ({
    r: 54 - index * 12,
    p: total > 0 ? bucket.amount / total : 0,
    a: bucket.color,
    b: bucket.color,
    label: bucket.label,
    value: money(bucket.amount),
  }));
  return (
    <div className="flex h-[64px] items-center gap-3">
      <svg viewBox="0 0 120 64" className="h-[64px] w-[120px] shrink-0 drop-shadow-[0_3px_5px_rgba(59,130,246,.22)]" role="img" aria-label="Ringkasan nilai jatuh tempo faktur belum lunas">
        <defs>{arcs.map((x, i) => <linearGradient key={i} id={`ag${i}`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor={x.a} /><stop offset="1" stopColor={x.b} /></linearGradient>)}</defs>
        {arcs.map((x, i) => {
          const d = `M${60 - x.r} 62 A${x.r} ${x.r} 0 0 1 ${60 + x.r} 62`;
          return (
            <g key={i}>
              <path d={d} pathLength={1} fill="none" stroke="#EEF0FA" strokeWidth="8" strokeLinecap="round" />
              <path className="jm-arc" d={d} pathLength={1} fill="none" stroke={`url(#ag${i})`} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${x.p} 1`} style={{ animationDelay: `${300 + i * 150}ms` }} />
            </g>
          );
        })}
        <text x="60" y="59" textAnchor="middle" fontSize="11" fontWeight="700" fill="#14172F">{total > 0 ? "100%" : "—"}</text>
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">{arcs.map((x) => <Chip key={x.label} color={x.b} label={x.label} value={x.value} />)}</div>
    </div>
  );
}

/** Kartu 2 — batang latar abu, batang gradasi, kurva halus, gelembung nilai pada puncak. */
function DueBars() {
  const data = MONTHS.map((month) => {
    const key = `2026-${monthNumber[month]}`;
    return invoices.filter((invoice) => invoiceMonth(invoice.date) === key)
      .reduce((total, invoice) => total + invoice.amount, 0) / 1_000_000;
  });
  const maxValue = Math.max(...data, 1), H = 44, peak = data.reduce((best, value, index) => value > data[best] ? index : best, 0);
  const barH = (v: number) => (v / maxValue) * 30;
  const pts = data.map((v, i) => [((i + 0.5) / data.length) * 100, H - barH(v) - 3]);
  return (
    <div className="relative h-[64px]">
      <div className="absolute inset-x-0 top-0 flex h-[44px] items-end gap-1.5">
        {data.map((v, i) => {
          const isPeak = i === peak;
          return (
            <div key={i} className="group relative h-full min-w-0 flex-1 rounded-t-[8px] rounded-b-[4px] bg-[#EFF1FA]" aria-label={`${MONTHS[i]} 2026: Rp ${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`}>
              <span className={`jm-bar absolute inset-x-0 bottom-0 rounded-t-[8px] rounded-b-[4px] bg-gradient-to-t transition hover:brightness-110 ${isPeak ? "from-[#6D55F2] to-[#A78BFA]" : "from-[#3B82F6] to-[#22D3EE]"}`} style={{ height: `${barH(v)}px`, animationDelay: `${300 + i * 70}ms` }} />
              <span className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-1.5 py-px text-[10px] font-semibold leading-[14px] text-[#14172F] shadow-[0_4px_12px_rgba(60,70,140,.22)] transition-opacity ${isPeak ? "" : "opacity-0 group-hover:opacity-100"}`} style={{ bottom: `${barH(v) + 4}px` }}>Rp {v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt</span>
            </div>
          );
        })}
      </div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="jm-reveal pointer-events-none absolute inset-x-0 top-0 h-[44px] w-full" aria-hidden="true">
        <path d={smooth(pts)} fill="none" stroke="#6D55F2" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex gap-1.5">{MONTHS.map((m) => <span key={m} className="flex-1 text-center text-[10px] leading-3 text-[#8A8FB0]">{m}</span>)}</div>
    </div>
  );
}

/** Belum ada tanggal pembayaran pada data contoh; jangan tampilkan tren fiktif. */
function PayWave() {
  return (
    <div className="flex h-[64px] items-center justify-center rounded-xl border border-dashed border-[#E6E6F5] bg-[#F8F8FF] px-3 text-center text-xs text-[#8A8FB0]">
      Tren waktu pembayaran akan tersedia setelah tanggal pembayaran dicatat.
    </div>
  );
}

/** Penjualan per periode belum dapat dibandingkan dengan target karena target belum ditetapkan. */
function TargetDonut() {
  return (
    <div className="flex h-[64px] items-center gap-3">
      <div className="relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_8px_20px_rgba(60,70,140,.2),inset_0_-3px_6px_rgba(120,130,200,.14)]" role="img" aria-label="Target penjualan belum ditetapkan">
        <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="30" cy="30" r="23" fill="none" stroke="#EEF0FA" strokeWidth="7" />
        </svg>
        <span className="relative text-[13px] font-bold text-[#8A8FB0]">—</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <Chip color="#3B82F6" label="Penjualan tercatat" value={money(sampleMonthSales)} />
        <Chip color="#CBD0E8" label="Target" value="Belum ditetapkan" />
        <Chip color="#A78BFA" label="Pencapaian" value="Belum tersedia" />
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, delta, good, icon, iconTone, delay = 0, children }: { label: string; value: string; unit?: string; delta?: string; good?: boolean; icon: string; iconTone: string; delay?: number; children: ReactNode }) {
  const v = useCountUp(Number(value.replace(/\D/g, "")));
  const shown = value === "—" ? "—" : value.startsWith("Rp") ? money(Math.round(v)) : String(Math.round(v));
  return (
    <article
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`); }}
      className="jm-rise jm-spot group relative flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#E6E6F5] bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#CFC6FA] hover:shadow-[0_16px_36px_rgba(91,69,240,.16)]"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-[#5E6488]">{label}</p>
          <p className="mt-1 break-words text-2xl font-semibold leading-tight tracking-tight tabular-nums">{shown}{unit && <span className="ml-1 text-base font-normal text-[#8A8FB0]">{unit}</span>}</p>
          {delta && <p className="mt-0.5 text-xs"><span className={`font-semibold ${delta === "Belum tersedia" ? "text-[#8A8FB0]" : good ? "text-emerald-600" : "text-rose-500"}`}>{delta}</span>{delta !== "Belum tersedia" && <span className="text-[#8A8FB0]"> dari bulan lalu</span>}</p>}
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 ${iconTone}`}><Icon name={icon} size={16} /></span>
      </div>
      <div className="relative mt-2.5 [@media(max-height:700px)]:hidden">{children}</div>
    </article>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative min-w-0">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full appearance-none rounded-full border border-[#E6E6F5] bg-white pl-4 pr-9 text-[13px] text-[#3A4066] ${ring}`}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A8FB0]"><Icon name="chevron" size={15} /></span>
    </div>
  );
}

const roundBtn = `flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E6E6F5] bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(91,69,240,.15)] ${ring}`;

/* ───────────────────────── Page ───────────────────────── */

export default function InvoiceWorkspace() {
  const [selectedId, setSelectedId] = useState(invoices[0].id);
  const [quick, setQuick] = useState<(typeof quickTabs)[number]>("Semua");
  const [tab, setTab] = useState(detailTabs[0]);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("Semua pelanggan");
  const [status, setStatus] = useState("Semua status");
  const [period, setPeriod] = useState("Okt 2026");
  const [toast, setToast] = useState("");

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);
  const notify = (label: string) => setToast(`${label} — prototipe, belum ada transaksi yang diproses.`);

  const filteredInvoices = useMemo(() => invoices.filter((i) => {
    const q = search.trim().toLowerCase();
    return (!q || `${i.id} ${i.customer} ${i.code} ${i.status}`.toLowerCase().includes(q))
      && (status === "Semua status" || i.status === status)
      && (customer === "Semua pelanggan" || i.customer === customer)
      && (period === "Semua periode" || invoiceMonth(i.date) === periodKey(period));
  }), [search, status, customer, period]);

  const list = useMemo(() => filteredInvoices.filter((i) =>
    quick === "Semua" || (quick === "Belum lunas" && isUnpaid(i)) || (quick === "Lunas" && i.status === "Lunas") || (quick === "Retur" && i.status === "Retur")
  ), [filteredInvoices, quick]);

  const inv = list.find((i) => i.id === selectedId) ?? list[0] ?? null;
  const paid = inv?.status === "Lunas";
  const activeFilters = (customer !== "Semua pelanggan" ? 1 : 0)
    + (status !== "Semua status" || quick !== "Semua" ? 1 : 0)
    + (period !== "Okt 2026" ? 1 : 0)
    + (search.trim() ? 1 : 0);
  const reset = () => { setQuick("Semua"); setStatus("Semua status"); setCustomer("Semua pelanggan"); setSearch(""); setPeriod("Okt 2026"); setSelectedId(invoices[0].id); setTab(detailTabs[0]); };
  const count = (t: (typeof quickTabs)[number]) => t === "Semua" ? filteredInvoices.length : filteredInvoices.filter((i) => (t === "Belum lunas" ? isUnpaid(i) : i.status === t)).length;
  const shortDate = (d: string) => d.split(" ").slice(0, 2).join(" ");

  return (
    <main className="bg-[#ECEBFA] [background-image:radial-gradient(900px_circle_at_8%_0%,rgba(122,105,246,.2),transparent_60%),radial-gradient(700px_circle_at_96%_100%,rgba(184,242,74,.18),transparent_55%)] p-3 text-[#14172F] xl:h-screen xl:overflow-y-auto" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
      <style>{FX}</style>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 rounded-[32px] bg-[#F8F8FF]/90 p-4 shadow-[0_24px_80px_rgba(62,50,160,.14)] ring-1 ring-white/80 backdrop-blur-xl xl:h-auto xl:min-h-[calc(100vh-24px)]">

        {/* Header */}
        <header className="flex shrink-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8F24A] text-lg font-extrabold">J</span>
            <div className="hidden leading-tight xl:block"><p className="text-sm font-bold">Jena Medical Center</p><p className="text-[11px] text-[#5E6488]">Distribusi alat & obat medis</p></div>
          </div>
          <nav aria-label="Navigasi utama" className="mx-auto flex min-w-0 gap-1 overflow-x-auto rounded-full bg-[#14172B] p-1">
            {nav.map((n) => {
              const active = n.label === "Penjualan";
              if (n.label === "Master data" || n.label === "Operasional" || n.label === "Pengiriman & piutang") return (
                <Link key={n.label} href={n.label === "Master data" ? "/master-data" : n.label === "Operasional" ? "/operasional" : "/pengiriman-piutang"} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${ring} text-slate-300 hover:bg-white/10`}>
                  <Icon name={n.icon} size={15} /><span className="hidden lg:inline">{n.label}</span>
                </Link>
              );
              return (
                <button key={n.label} type="button" aria-current={active ? "page" : undefined} onClick={() => !active && notify(`Modul ${n.label}`)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${ring} ${active ? "bg-[#5B45F0] text-white shadow-[0_4px_14px_rgba(91,69,240,.55)]" : "text-slate-300 hover:bg-white/10"}`}>
                  <Icon name={n.icon} size={15} /><span className={active ? "" : "hidden lg:inline"}>{n.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" aria-label="Notifikasi" onClick={() => notify("Notifikasi")} className={`relative ${roundBtn}`}><Icon name="bell" size={17} /><span className="jm-ring absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 text-rose-500" /></button>
            <button type="button" aria-label="Profil pengguna" onClick={() => notify("Profil pengguna")} className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#E4DFFF] text-xs font-bold text-[#3B2CA8] ${ring}`}>JM</button>
          </div>
        </header>

        {/* Title */}
        <section className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Kembali" onClick={() => notify("Kembali")} className={roundBtn}><Icon name="back" size={17} /></button>
            <div>
              <h1 className="text-[28px] font-semibold leading-none tracking-tight">Faktur penjualan</h1>
              <p className="mt-1 text-[13px] text-[#5E6488]">Kelola dan pantau semua faktur di satu tempat.</p>
              <p className="mt-1 text-[11px] text-[#8A8FB0]">Data faktur masih simulasi; grafik ringkasan belum terhubung ke sumber data.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Reset semua filter" onClick={reset} className={roundBtn}><Icon name="filter" size={17} /></button>
            <button type="button" onClick={() => notify("Buat faktur")} className={`jm-shine flex h-10 items-center gap-2 rounded-full bg-[#5B45F0] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(91,69,240,.35)] transition hover:-translate-y-0.5 hover:bg-[#4A36DB] hover:shadow-[0_12px_26px_rgba(91,69,240,.45)] ${ring}`}><Icon name="plus" size={16} />Buat faktur</button>
          </div>
        </section>

        {/* KPIs */}
        <section aria-label="Ringkasan faktur" className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi delay={0} label="Faktur belum lunas (data contoh)" value={money(unpaidAmount)} icon="alert" iconTone="bg-rose-50 text-rose-500"><AgingGauge /></Kpi>
          <Kpi delay={90} label="Jatuh tempo 30 hari dari faktur terbaru" value={money(dueSoonAmount)} icon="calendar" iconTone="bg-[#EEEAFF] text-[#5B45F0]"><DueBars /></Kpi>
          <Kpi delay={180} label="Rata-rata waktu pembayaran" value="—" delta="Belum tersedia" icon="clock" iconTone="bg-sky-50 text-sky-600"><PayWave /></Kpi>
          <Kpi delay={270} label="Penjualan Oktober 2026 (data contoh)" value={money(sampleMonthSales)} icon="up" iconTone="bg-emerald-50 text-emerald-600"><TargetDonut /></Kpi>
        </section>

        {/* Filters */}
        <section aria-label="Filter faktur" className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[auto_1fr_0.8fr_1fr_1.3fr]">
          <div className="flex h-10 items-center gap-3 px-2 text-sm font-semibold">Filter aktif<span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#14172B] text-xs text-white">{activeFilters}</span></div>
          <Select label="Pelanggan" value={customer} onChange={setCustomer} options={["Semua pelanggan", ...Array.from(new Set(invoices.map((i) => i.customer)))]} />
          <Select label="Periode" value={period} onChange={setPeriod} options={["Okt 2026", "Sep 2026", "Agu 2026", "Semua periode"]} />
          <Select label="Status" value={status} onChange={setStatus} options={["Semua status", "Menunggu pembayaran", "Terkirim", "Lunas", "Retur", "Diproses"]} />
          <label className="flex h-10 items-center gap-2 rounded-full border border-[#E6E6F5] bg-white px-4 text-[#8A8FB0] focus-within:border-[#5B45F0]">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor, pelanggan, kode, atau status" aria-label="Cari faktur" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#14172F] outline-none placeholder:text-[#8A8FB0]" />
            <Icon name="search" size={17} />
          </label>
        </section>

        {/* Workspace */}
        <section className="jm-rise relative flex min-h-[320px] flex-1 flex-col rounded-[32px] bg-[#14172B] p-4 text-white shadow-[0_24px_60px_rgba(20,23,43,.35)]" style={{ animationDelay: "250ms" }}>
          <div className="flex shrink-0 items-center justify-between gap-3">
            <h2 className="px-1 text-base font-semibold">Daftar faktur</h2>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Ekspor daftar" onClick={() => notify("Ekspor daftar")} className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/15 hover:bg-white/10 ${ring}`}><Icon name="export" size={16} /></button>
              <button type="button" aria-label="Opsi lainnya" onClick={() => notify("Opsi lainnya")} className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/15 hover:bg-white/10 ${ring}`}><Icon name="dots" size={16} /></button>
            </div>
          </div>

          <div className="order-first mb-3 flex justify-center xl:pointer-events-none xl:absolute xl:left-1/2 xl:top-0 xl:order-none xl:mb-0 xl:-translate-x-1/2 xl:rounded-b-[26px] xl:bg-[#F8F8FF] xl:px-2 xl:pb-2">
            <div role="tablist" aria-label="Filter cepat" className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1">
              {quickTabs.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={quick === t} onClick={() => setQuick(t)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${ring} ${quick === t ? "bg-[#5B45F0] text-white shadow-[0_4px_12px_rgba(91,69,240,.4)]" : "text-[#3A4066] hover:bg-[#F1F0FC]"}`}>
                  {t}<span className={`rounded-full px-1.5 text-[11px] ${quick === t ? "bg-white/25" : "bg-[#ECEBFA] text-[#5E6488]"}`}>{count(t)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid min-h-[620px] flex-1 gap-3 xl:grid-cols-[minmax(380px,0.78fr)_minmax(0,1.5fr)]">
            {/* List */}
            <ul className="flex max-h-[420px] min-h-0 flex-col gap-2 overflow-y-auto pr-1 xl:max-h-none">
              {list.map((i, idx) => {
                const sel = i.id === inv?.id;
                return (
                  <li key={i.id} className="jm-rise" style={{ animationDelay: `${450 + idx * 70}ms` }}>
                    <button type="button" aria-pressed={sel} onClick={() => { setSelectedId(i.id); setTab(detailTabs[0]); }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${ring} ${sel ? "bg-gradient-to-r from-[#5B45F0] to-[#7A69F6] shadow-[0_8px_22px_rgba(91,69,240,.5)]" : "bg-white/[0.06] hover:translate-x-0.5 hover:bg-white/10"}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[#14172F]" style={{ background: avatarColor(i.code) }}>{initials(i.customer)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold"># {i.id}</span>
                        <span className="block truncate text-xs text-slate-400">Jatuh tempo {shortDate(i.due)}</span>
                      </span>
                      <Pill tone={i.tone} variant={sel ? "solid" : "quiet"}>{shortStatus(i.status)}</Pill>
                      <span className="w-[104px] shrink-0 text-right text-sm font-semibold">{money(i.amount)}</span>
                    </button>
                  </li>
                );
              })}
              {list.length === 0 && (
                <li className="rounded-2xl bg-white/[0.06] px-4 py-8 text-center">
                  <p className="font-semibold">Faktur tidak ditemukan</p>
                  <p className="mt-1 text-sm text-slate-400">Ubah kata kunci atau reset filter.</p>
                  <button type="button" onClick={reset} className={`mt-3 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#14172B] ${ring}`}>Reset filter</button>
                </li>
              )}
            </ul>

            {/* Detail */}
            <article className="relative flex min-h-[620px] min-w-0 flex-col rounded-[28px] bg-gradient-to-br from-[#7A69F6] via-[#5F4BEA] to-[#4636C9] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.3)]">
              {inv ? (<>
              <div aria-hidden="true" className="jm-drift pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#B8F24A]/20 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
              <div key={inv.id} className="jm-swap relative flex min-h-0 flex-1 flex-col">
              <div className="grid shrink-0 gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
                <div>
                  <p className="text-xs text-white/75">Detail faktur</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="text-2xl font-semibold tracking-tight"># {inv.id}</h3><Pill tone={inv.tone}>{inv.status}</Pill></div>
                </div>
                <div>
                  <p className="text-xs text-white/75">Pelanggan</p>
                  <p className="mt-1 truncate text-lg font-semibold leading-tight">{inv.customer}</p>
                  <p className="text-xs text-white/75">{inv.code} · <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${dot[inv.shippingTone]}`} />{inv.shipping}</span></p>
                </div>
                <div>
                  <p className="text-xs text-white/75">Jatuh tempo</p>
                  <p className="mt-1 text-lg font-semibold leading-tight">{inv.due}</p>
                  <p className="text-xs text-white/75">Dibuat {inv.date}</p>
                </div>
              </div>

              <div role="tablist" aria-label="Rincian faktur" className="mt-3 flex shrink-0 gap-1 self-start overflow-x-auto rounded-full bg-black/15 p-1">
                {detailTabs.map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${ring} ${tab === t ? "bg-white text-[#4636C9]" : "text-white/80 hover:bg-white/10"}`}>{t}</button>
                ))}
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                {tab === "Detail barang" && (
                  <ul className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
                    {inv.lines.map((l) => (
                      <li key={l.batch + l.qty} className="rounded-2xl border border-white/15 bg-white/12 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-[0_10px_24px_rgba(20,10,80,.28),inset_0_1px_0_rgba(255,255,255,.3)]">
                        <div className="flex items-start justify-between gap-2"><p className="text-lg font-semibold leading-tight">{l.subtotal}</p><span className="text-white/70"><Icon name="up" size={14} /></span></div>
                        <p className="mt-1 text-[13px] font-medium">{l.product}</p>
                        <p className="mt-1 text-xs text-white/70">{l.qty} × {l.price}</p>
                        <p className="text-xs text-white/70">Batch {l.batch}</p>
                      </li>
                    ))}
                    <li>
                      <button type="button" onClick={() => notify("Tambah barang")} className={`flex h-full min-h-[96px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/40 text-white/85 transition duration-200 hover:border-white/80 hover:bg-white/10 ${ring}`}>
                        <Icon name="plus" size={20} /><span className="text-xs font-medium">Tambah barang</span>
                      </button>
                    </li>
                  </ul>
                )}
                {tab === "Pembayaran" && (
                  <div className="rounded-2xl bg-white/12 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="text-xs text-white/75">Nilai faktur</p><p className="mt-0.5 text-xl font-semibold">{money(inv.amount)}</p></div>
                      <div><p className="text-xs text-white/75">Sudah dibayar</p><p className="mt-0.5 text-xl font-semibold">{paid ? money(inv.amount) : "Rp 0"}</p></div>
                    </div>
                    <p className="mt-3 text-sm text-white/75">{paid ? "Faktur ini sudah lunas." : "Belum ada pembayaran tercatat. Metode: transfer bank."}</p>
                    {!paid && <button type="button" onClick={() => notify("Catat pembayaran")} className={`mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#4636C9] ${ring}`}>Catat pembayaran</button>}
                  </div>
                )}
                {tab === "Pengiriman" && (
                  <div className="rounded-2xl bg-white/12 p-4">
                    <p className="font-semibold">{inv.shipping}</p>
                    <p className="mt-0.5 text-sm text-white/75">Alamat sesuai data pelanggan {inv.customer}.</p>
                    <ol className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      {["Persiapan", "Dikirim", "Diterima"].map((s, n) => {
                        const reached = inv.shipping === "Belum dikirim" ? n === 0 : inv.shipping === "Dalam pengiriman" ? n <= 1 : true;
                        return <li key={s} className={`rounded-xl px-2 py-2.5 font-medium ${reached ? "bg-white text-[#4636C9]" : "bg-white/10 text-white/70"}`}>{s}</li>;
                      })}
                    </ol>
                  </div>
                )}
                {tab === "Aktivitas" && (
                  <ol className="space-y-3 rounded-2xl bg-white/12 p-4">
                    {[["Faktur dibuat", inv.date], ["Status diperbarui", inv.status], ["Pelanggan dipilih", inv.customer]].map(([t, d]) => (
                      <li key={t} className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#4636C9]"><Icon name="check" size={14} /></span><div><p className="text-sm font-medium">{t}</p><p className="text-xs text-white/75">{d}</p></div></li>
                    ))}
                  </ol>
                )}
                {tab === "Catatan" && (
                  <div className="rounded-2xl bg-white/12 p-4">
                    <label htmlFor="note" className="text-sm font-semibold">Catatan internal</label>
                    <textarea id="note" placeholder="Tulis catatan untuk faktur ini" className="mt-2 min-h-20 w-full resize-y rounded-xl border border-white/20 bg-black/15 p-3 text-sm text-white outline-none placeholder:text-white/55 focus:border-white/60" />
                  </div>
                )}
              </div>

              {/* Totals & actions */}
              <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-3">
                <dl className="grid grid-cols-3 gap-x-8">
                  {[["Subtotal", money(inv.amount)], ["Total", money(inv.amount)], ["Sisa tagihan", paid ? "Rp 0" : money(inv.amount)]].map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-white/75">{k}</dt><dd className="text-base font-semibold">{v}</dd></div>
                  ))}
                </dl>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Salin tautan faktur" onClick={() => notify("Salin tautan")} className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/35 hover:bg-white/10 ${ring}`}><Icon name="link" size={16} /></button>
                  <button type="button" aria-label="Jadwalkan pengingat" onClick={() => notify("Jadwalkan pengingat")} className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/35 hover:bg-white/10 ${ring}`}><Icon name="calendar" size={16} /></button>
                  <button type="button" onClick={() => notify("Kirim faktur")} className={`flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#4636C9] hover:bg-[#F1F0FC] ${ring}`}><Icon name="send" size={15} />Kirim faktur</button>
                </div>
              </div>
              </div>
              </>) : (
                <div className="relative flex min-h-[240px] flex-1 flex-col items-center justify-center text-center">
                  <p className="text-lg font-semibold">Tidak ada faktur untuk filter ini</p>
                  <p className="mt-1 max-w-sm text-sm text-white/75">Ubah filter atau kata kunci untuk melihat faktur.</p>
                  <button type="button" onClick={reset} className={`mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#4636C9] ${ring}`}>Reset filter</button>
                </div>
              )}
            </article>
          </div>
        </section>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        {toast && <p key={toast} className="jm-toast rounded-full bg-[#14172B] px-5 py-3 text-sm text-white shadow-lg">{toast}</p>}
      </div>
    </main>
  );
}