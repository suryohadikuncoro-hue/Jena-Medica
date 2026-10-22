"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ActionBanner, ButtonLink } from "@/app/components/ui";

const PERIODS = ["Hari", "Minggu", "Bulan", "3 bulan", "6 bulan", "Tahun"] as const;
type Docs = { salesDrafts: number; salesDraftValue: number; supplierDrafts: number; supplierReportedValue: number };
const emptyDocs: Docs = { salesDrafts: 0, salesDraftValue: 0, supplierDrafts: 0, supplierReportedValue: 0 };
const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.abs(n))};

export default function FinanceDashboardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Bulan");
  const [docs, setDocs] = useState<Docs>(emptyDocs);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    const run = async () => {
      if (!isSupabaseConfigured()) { setMessage("Supabase belum dikonfigurasi pada environment ini."); setLoading(false); return; }
      try {
        const db = getSupabaseBrowserClient();
        const { data: { session } } = await db.auth.getSession();
        if (!session) throw new Error("Masuk untuk melihat laporan keuangan.");
        const role = String(session.user.app_metadata?.business_role ?? "");
        if (!["owner", "admin", "viewer"].includes(role)) throw new Error("Akun ini belum memiliki role bisnis yang valid.");
        const [sales, supplier] = await Promise.all([
          db.from("sales_invoices").select("status,total_amount").limit(2000),
          db.from("supplier_invoices").select("status,invoice_total_reported").limit(2000),
        ]);
        if (sales.error) throw sales.error;
        if (supplier.error) throw supplier.error;
        const sd = (sales.data ?? []).filter(row => row.status === "draft");
        const pd = (supplier.data ?? []).filter(row => row.status === "draft");
        if (live) setDocs({
          salesDrafts: sd.length,
          salesDraftValue: sd.reduce((sum, row) => sum + Number(row.total_amount), 0),
          supplierDrafts: pd.length,
          supplierReportedValue: pd.reduce((sum, row) => sum + Number(row.invoice_total_reported), 0),
        });
      } catch (error) {
        if (live) setMessage(error instanceof Error ? error.message : "Laporan keuangan tidak dapat dimuat.");
      } finally { if (live) setLoading(false); }
    };
    const timer = window.setTimeout(() => void run(), 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, []);

  const count = (value: number) => loading ? "…" : new Intl.NumberFormat("id-ID").format(value);
  const money = (value: number) => loading ? "…" : rp(value);

  return <main className="page-wrap dk-wrap">
    <header className="dk-head">
      <div><p className="page-kicker">Ringkasan bisnis</p><h1 className="dk-title">Dashboard keuangan</h1><p className="dk-sub">Angka keuangan hanya ditampilkan setelah jurnal dibukukan.</p></div>
      <div className="dk-periods" role="group" aria-label="Rentang waktu">{PERIODS.map(item => <button key={item} type="button" aria-pressed={period === item} className={`dk-pill ${period === item ? "dk-pill-on" : ""}`} onClick={() => setPeriod(item)}>{item}</button>)}</div>
    </header>

    {message && <ActionBanner className="dk-message" action={message.includes("Masuk") ? <ButtonLink href="/login" variant="solid" size="sm">Masuk</ButtonLink> : undefined}><b>{loading ? "Memuat data." : "Laporan belum tersedia."}</b> {message}</ActionBanner>}

    <section aria-labelledby="dk-docs" className="dk-docs">
      <div className="dk-section-head"><div><h2 id="dk-docs" className="dk-h2">Dokumen belum dibukukan</h2><p className="dk-sub">Dokumen operasional bukan saldo kas, pendapatan, piutang, hutang, atau laba.</p></div><span className="dk-label">Data aktual</span></div>
      <div className="dk-kpis">
        <Link href="/invoice-pelanggan" className="dk-kpi chip-pink"><span>Draf invoice pelanggan</span><strong>{count(docs.salesDrafts)}</strong><small>Belum menjadi piutang</small></Link>
        <Link href="/invoice-pelanggan" className="dk-kpi chip-yellow"><span>Nilai draf pelanggan</span><strong>{money(docs.salesDraftValue)}</strong><small>Belum termasuk PPN, bukan pendapatan</small></Link>
        <Link href="/operasional#invoices" className="dk-kpi chip-mint"><span>Draf faktur supplier</span><strong>{count(docs.supplierDrafts)}</strong><small>Belum menjadi hutang usaha</small></Link>
        <Link href="/operasional#invoices" className="dk-kpi chip-pink"><span>Nilai tercetak faktur</span><strong>{money(docs.supplierReportedValue)}</strong><small>Nilai dokumen, bukan HPP</small></Link>
      </div>
    </section>

    {!loading && !message && <div className="dk-empty" role="status"><span className="dk-empty-mark" aria-hidden="true">i</span><div><strong>Ringkasan keuangan belum tersedia</strong><p>Dashboard ini belum terhubung ke snapshot jurnal terposting. Kas dan bank, grafik pendapatan/pengeluaran, laba bersih, komposisi biaya, dan progres akan muncul setelah sumber laporan diverifikasi. Tidak ada angka contoh yang ditampilkan.</p><Link href="/keuangan#tutup-buku" className="dk-link">Periksa kesiapan pembukuan →</Link></div></div>}

    <div className="dk-grid3" aria-label="Bagian laporan keuangan yang menunggu integrasi data">
      <section className="dk-card"><h2 className="dk-h2">Kas dan bank</h2><p className="dk-sub">Saldo dari jurnal dan rekonsiliasi.</p><div className="dk-placeholder">Menunggu data buku besar</div></section>
      <section className="dk-card"><h2 className="dk-h2">Pendapatan dan pengeluaran</h2><p className="dk-sub">Tren berdasarkan jurnal yang sudah dibukukan.</p><div className="dk-placeholder">Grafik akan tampil setelah data terverifikasi</div></section>
      <section className="dk-card"><h2 className="dk-h2">Laba, biaya, dan progres</h2><p className="dk-sub">Perlu sumber laporan terposting yang tervalidasi.</p><div className="dk-placeholder">Belum ada angka keuangan untuk ditampilkan</div><Link href="/keuangan#jurnal" className="dk-link">Buka jurnal umum →</Link></section>
    </div>
    <p className="dk-note dk-foot">Pembukuan internal. Belum termasuk rekonsiliasi bank, saldo awal, dan HPP otomatis. Angka pajak bukan pelaporan resmi.</p>
  </main>;
}
