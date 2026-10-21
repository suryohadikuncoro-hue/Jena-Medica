"use client";

import Link from "next/link";
import { AccountingLedgerManager } from "@/app/components/accounting-ledger-manager";
import { FinancialReportManager, type FinancialReportTab } from "@/app/components/financial-report-manager";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const tabs = ["Ikhtisar", "Laba rugi", "Neraca", "Jurnal umum", "Buku Besar", "Tutup Buku", "PPN", "Hutang & piutang"] as const;
type Tab = typeof tabs[number];
type StatusData = { salesDrafts: number; salesDraftValue: number; supplierDrafts: number; supplierReportedValue: number; role: string };
const empty: StatusData = { salesDrafts: 0, salesDraftValue: 0, supplierDrafts: 0, supplierReportedValue: 0, role: "" };
const currency = (n: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
const pathByTab: Record<Tab, string> = { "Ikhtisar": "", "Laba rugi": "laba-rugi", "Neraca": "neraca", "Jurnal umum": "jurnal", "Buku Besar": "buku-besar", "Tutup Buku": "tutup-buku", "PPN": "ppn", "Hutang & piutang": "hutang-piutang" };

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
        if (sales.error) throw sales.error; if (supplier.error) throw supplier.error;
        const salesDrafts = (sales.data ?? []).filter(row => row.status === "draft");
        const supplierDrafts = (supplier.data ?? []).filter(row => row.status === "draft");
        if (live) setData({ salesDrafts: salesDrafts.length, salesDraftValue: salesDrafts.reduce((sum, row) => sum + Number(row.total_amount), 0), supplierDrafts: supplierDrafts.length, supplierReportedValue: supplierDrafts.reduce((sum, row) => sum + Number(row.invoice_total_reported), 0), role });
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : "Status keuangan tidak dapat dimuat."); }
      finally { if (live) setLoading(false); }
    }
    void load(); return () => { live = false; };
  }, []);
  const tabBlurb = useMemo(() => ({
    "Ikhtisar": "Ringkasan saldo dan aktivitas berdasarkan jurnal yang sudah diposting.",
    "Laba rugi": "Pendapatan dan beban yang sudah diposting dalam rentang tanggal terpilih.",
    "Neraca": "Saldo kumulatif ledger sampai tanggal laporan; setup ini tidak memasukkan saldo awal.",
    "Jurnal umum": "Konfigurasi COA, kebijakan, periode, dan jurnal berimbang; posting tetap terkunci sampai persetujuan dicatat.",
    "Buku Besar": "Mutasi kronologis dan saldo berjalan dari jurnal posted untuk akun yang dipilih.",
    "Tutup Buku": "Status periode akuntansi dan pengingat kontrol sebelum penutupan.",
    "PPN": "Ringkasan akun kontrol PPN dari angka yang dimasukkan dan diposting; bukan pelaporan pajak.",
    "Hutang & piutang": "Saldo akun kontrol AR/AP berdasarkan jurnal posted; bukan analisis umur tagihan.",
  } as Record<Tab, string>)[tab], [tab]);
  function choose(next: Tab) { setTab(next); const slug = pathByTab[next]; window.history.replaceState(null, "", `${window.location.pathname}${slug ? `#${slug}` : ""}`); }
  return <main className="page-wrap">
    <div className="mb-6"><p className="page-kicker">Akuntansi & laporan</p><h1 className="page-title">Keuangan</h1><p className="page-description">Laporan internal berbasis jurnal posted; bukan pengganti review akuntan atau pelaporan pajak.</p></div>
    <div className="demo-banner mb-5"><strong>Sumber angka: buku besar.</strong> Hanya jurnal yang sudah diposting masuk ke laporan. Draft invoice, capture faktur supplier, dan pembayaran yang belum diposting bukan saldo akuntansi. Ringkasan PPN bukan SPT/e-Faktur.</div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Draft invoice pelanggan" value={loading ? "…" : String(data.salesDrafts)} detail="Bukan piutang" href="/invoice-pelanggan" />
      <Stat label="Nilai draft pelanggan" value={loading ? "…" : currency(data.salesDraftValue)} detail="Tanpa PPN; bukan pendapatan" href="/invoice-pelanggan" />
      <Stat label="Capture faktur supplier" value={loading ? "…" : String(data.supplierDrafts)} detail="Bukan hutang/AP" href="/operasional#invoices" />
      <Stat label="Nilai faktur terlapor" value={loading ? "…" : currency(data.supplierReportedValue)} detail="Sesuai dokumen; bukan HPP" href="/operasional#invoices" />
    </section>
    <section className="card card-pad"><div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Laporan dan buku">{tabs.map(item => <button className="tab-button" key={item} role="tab" aria-selected={tab === item} onClick={() => choose(item)}>{item}</button>)}</div>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{tab === "Ikhtisar" ? "Ikhtisar keuangan" : tab}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">{tabBlurb}</p></div><span className="status-pill">{loading ? "Memuat" : tab === "Jurnal umum" ? "Setup & posting" : "Data ledger"}</span></div>
      {tab === "Jurnal umum" ? <AccountingLedgerManager/> : <FinancialReportManager tab={tab as FinancialReportTab}/>}
    </section>
    <p className="mt-4 text-xs leading-5 text-[var(--muted-soft)]">UAT pada akun owner/admin/viewer tetap diperlukan. Angka ini belum mencakup rekonsiliasi bank, jurnal penyesuaian, perhitungan HPP otomatis, backup/restore, atau pelaporan SPT/e-Faktur; tinjau setiap selisih sebelum tutup periode.</p>
  </main>;
}
function Stat({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) { return <Link href={href} className="card card-pad transition hover:shadow-md"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-lg font-bold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-[var(--muted-soft)]">{detail}</p></Link>; }
