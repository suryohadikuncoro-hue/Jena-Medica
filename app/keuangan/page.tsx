"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountingLedgerManager } from "@/app/components/accounting-ledger-manager";
import { FinancialReportManager, type FinancialReportTab } from "@/app/components/financial-report-manager";
import { SegmentedTabs } from "@/app/components/ui/segmented-tabs";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const tabs = ["Ikhtisar", "Laba rugi", "Neraca", "Jurnal umum", "Buku Besar", "Tutup Buku", "PPN", "Hutang & piutang"] as const;
type Tab = typeof tabs[number];
type StatusData = { salesDrafts: number; salesDraftValue: number; supplierDrafts: number; supplierReportedValue: number; role: string };
const empty: StatusData = { salesDrafts: 0, salesDraftValue: 0, supplierDrafts: 0, supplierReportedValue: 0, role: "" };
const currency = (n: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
const pathByTab: Record<Tab, string> = { "Ikhtisar": "", "Laba rugi": "laba-rugi", "Neraca": "neraca", "Jurnal umum": "jurnal", "Buku Besar": "buku-besar", "Tutup Buku": "tutup-buku", "PPN": "ppn", "Hutang & piutang": "hutang-piutang" };
const tabHelp: Record<Tab, string> = {
  "Ikhtisar": "Pantau ringkasan pembukuan dan kesiapan periode dari jurnal yang sudah dibukukan.",
  "Laba rugi": "Pendapatan dan beban yang sudah dibukukan dalam rentang tanggal terpilih.",
  "Neraca": "Saldo kumulatif buku besar sampai tanggal laporan; belum memasukkan saldo awal.",
  "Jurnal umum": "Kelola akun, kebijakan, periode, dan jurnal berimbang. Pencatatan ke pembukuan mengikuti persetujuan.",
  "Buku Besar": "Lihat mutasi kronologis dan saldo berjalan berdasarkan akun.",
  "Tutup Buku": "Periksa status periode dan kontrol yang perlu ditinjau sebelum penutupan.",
  "PPN": "Bandingkan akun kontrol PPN dengan dokumen yang sudah dicatat. Bukan pelaporan pajak.",
  "Hutang & piutang": "Tinjau saldo terbuka dan umur tagihan berdasarkan dokumen serta jurnal.",
};

export default function FinanceReportsPage() {
  const [tab, setTab] = useState<Tab>("Ikhtisar");
  const [data, setData] = useState<StatusData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => { const slug = window.location.hash.slice(1); const match = tabs.find(t => pathByTab[t] === slug); if (match) setTab(match); };
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    let live = true;
    async function load() {
      if (!isSupabaseConfigured()) { setError("Supabase belum dikonfigurasi pada environment ini."); setLoading(false); return; }
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Masuk untuk melihat status dokumen aktual.");
        const role = String(session.user.app_metadata?.business_role ?? "");
        if (!["owner", "admin", "viewer"].includes(role)) throw new Error("Akun ini belum memiliki role bisnis yang valid.");
        const [sales, supplier] = await Promise.all([
          supabase.from("sales_invoices").select("status,total_amount").limit(2000),
          supabase.from("supplier_invoices").select("status,invoice_total_reported").limit(2000),
        ]);
        if (sales.error) throw sales.error;
        if (supplier.error) throw supplier.error;
        const salesDrafts = (sales.data ?? []).filter(row => row.status === "draft");
        const supplierDrafts = (supplier.data ?? []).filter(row => row.status === "draft");
        if (live) setData({ salesDrafts: salesDrafts.length, salesDraftValue: salesDrafts.reduce((sum, row) => sum + Number(row.total_amount), 0), supplierDrafts: supplierDrafts.length, supplierReportedValue: supplierDrafts.reduce((sum, row) => sum + Number(row.invoice_total_reported), 0), role });
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : "Status keuangan tidak dapat dimuat."); }
      finally { if (live) setLoading(false); }
    }
    void load(); return () => { live = false; };
  }, []);

  function choose(next: Tab) {
    setTab(next);
    const slug = pathByTab[next];
    window.history.replaceState(null, "", `${window.location.pathname}${slug ? `#${slug}` : ""}`);
  }

  const items = useMemo(() => tabs.map(value => ({ value, label: value })), []);
  return <main className="page-wrap finance-page">
    <header className="finance-heading">
      <div>
        <p className="page-kicker">Laporan & pembukuan</p>
        <h1 className="page-title">Keuangan</h1>
        <p className="page-description">Ringkasan keuangan internal Jena Medical Center.</p>
      </div>
      <div className="finance-heading-status"><span className="finance-live-dot" aria-hidden="true" />Pembukuan internal</div>
    </header>

    <div className="finance-notice" role="note">
      <span className="finance-notice-mark" aria-hidden="true">i</span>
      <p><strong>Angka laporan bersumber dari jurnal yang sudah dibukukan.</strong> Draf invoice dan capture faktur supplier belum menjadi pendapatan, piutang, atau hutang. Ringkasan PPN bukan SPT/e-Faktur.</p>
    </div>

    {error && <p role="alert" className="finance-error">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}

    <section className="finance-documents" aria-labelledby="finance-documents-title">
      <div className="finance-section-heading">
        <div><h2 id="finance-documents-title">Dokumen belum dibukukan</h2><p>Informasi operasional, terpisah dari saldo buku besar.</p></div>
        <span className="finance-outline-pill">Status dokumen</span>
      </div>
      <div className="finance-stat-grid">
        <Stat label="Draf invoice pelanggan" value={loading ? "…" : String(data.salesDrafts)} detail="Jumlah dokumen · belum menjadi piutang" href="/invoice-pelanggan" tone="pink" />
        <Stat label="Nilai draf pelanggan" value={loading ? "…" : currency(data.salesDraftValue)} detail="Belum termasuk PPN · bukan pendapatan" href="/invoice-pelanggan" tone="yellow" />
        <Stat label="Draf faktur supplier" value={loading ? "…" : String(data.supplierDrafts)} detail="Belum menjadi hutang usaha" href="/operasional#invoices" tone="mint" />
        <Stat label="Nilai tercetak faktur" value={loading ? "…" : currency(data.supplierReportedValue)} detail="Mengikuti dokumen · bukan HPP" href="/operasional#invoices" tone="gray" />
      </div>
    </section>

    <section className="finance-report-shell" aria-label="Laporan keuangan">
      <div className="finance-report-top">
        <div className="finance-report-title"><span className="finance-report-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16M8 15v-4m4 4V7m4 8V9m4 6v-3" /></svg></span><div><h2>Laporan keuangan</h2><p>Pilih laporan untuk melihat ringkasan dan rincian.</p></div></div>
        <span className="finance-source-status"><span aria-hidden="true" />{loading ? "Memuat data" : "Buku besar"}</span>
      </div>
      <SegmentedTabs items={items} value={tab} onChange={choose} label="Pilih laporan keuangan" className="finance-tabs" />
      <div className="finance-tab-context"><div><h3>{tab === "Ikhtisar" ? "Ikhtisar" : tab}</h3><p>{tabHelp[tab]}</p></div><span className="finance-period-note">{tab === "Jurnal umum" ? "Konfigurasi" : "Data aktual"}</span></div>
      {tab === "Jurnal umum" ? <AccountingLedgerManager /> : <FinancialReportManager tab={tab as FinancialReportTab} />}
    </section>

    <footer className="finance-footnote">Pembukuan internal saja. Belum termasuk rekonsiliasi bank, saldo awal, dan perhitungan HPP otomatis. Tinjau selisih sebelum tutup periode; angka pajak bukan pelaporan resmi.</footer>
  </main>;
}

function Stat({ label, value, detail, href, tone }: { label: string; value: string; detail: string; href: string; tone: "pink" | "yellow" | "mint" | "gray" }) {
  return <Link href={href} className={`finance-stat finance-stat-${tone}`}>
    <span className="finance-stat-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H5V5a2 2 0 0 1 2-2Zm7 0v5h5M8 13h8M8 17h5" /></svg></span>
    <span className="finance-stat-copy"><span className="finance-stat-label">{label}</span><strong className="finance-stat-value">{value}</strong><span className="finance-stat-detail">{detail}</span></span>
    <span className="finance-stat-arrow" aria-hidden="true">↗</span>
  </Link>;
}
