"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Snapshot = { customers: number; openOrders: number; supplierDrafts: number; salesDrafts: number; customerPayments: number; supplierPayments: number };
const empty: Snapshot = { customers: 0, openOrders: 0, supplierDrafts: 0, salesDrafts: 0, customerPayments: 0, supplierPayments: 0 };
const cards: { key: keyof Snapshot; label: string; hint: string; href: string }[] = [
  { key: "customers", label: "Pelanggan aktif", hint: "Master pelanggan", href: "/master-data#customers" },
  { key: "openOrders", label: "SO terkonfirmasi", hint: "Menunggu proses berikutnya", href: "/" },
  { key: "customerPayments", label: "Penerimaan tercatat", hint: "Belum tentu sudah dialokasikan atau dibukukan", href: "/pembayaran" },
  { key: "supplierPayments", label: "Pembayaran supplier tercatat", hint: "Belum tentu sudah dialokasikan atau dibukukan", href: "/pembayaran" },
  { key: "supplierDrafts", label: "Draft faktur supplier", hint: "Capture dokumen saja; belum AP", href: "/operasional#invoices" },
  { key: "salesDrafts", label: "Draft invoice pelanggan", hint: "Belum diterbitkan atau diposting", href: "/invoice-pelanggan" },
];

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    async function load() {
      if (!isSupabaseConfigured()) { setMessage("Supabase belum dikonfigurasi pada environment ini."); setLoading(false); return; }
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setMessage("Masuk untuk melihat ringkasan transaksi yang aktual."); setLoading(false); return; }
        const role = String(session.user.app_metadata?.business_role ?? "");
        if (!["owner", "admin", "viewer"].includes(role)) { setMessage("Akun ini belum memiliki role bisnis yang valid."); setLoading(false); return; }
        const [customers, orders, invoices, supplierInvoices, customerPayments, supplierPayments] = await Promise.all([
          supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("sales_orders").select("status").limit(2000),
          supabase.from("sales_invoices").select("status").limit(2000),
          supabase.from("supplier_invoices").select("id,status").limit(2000),
          supabase.from("customer_payments").select("id,status").limit(2000),
          supabase.from("supplier_payments").select("id,status").limit(2000),
        ]);
        for (const result of [customers, orders, invoices, supplierInvoices, customerPayments, supplierPayments]) if (result.error) throw result.error;
        if (!live) return;
        setSnapshot({
          customers: customers.count ?? 0,
          openOrders: (orders.data ?? []).filter(row => row.status === "confirmed").length,
          supplierDrafts: (supplierInvoices.data ?? []).filter(row => row.status === "draft").length,
          salesDrafts: (invoices.data ?? []).filter(row => row.status === "draft").length,
          customerPayments: (customerPayments.data ?? []).filter(row => row.status === "recorded").length,
          supplierPayments: (supplierPayments.data ?? []).filter(row => row.status === "recorded").length,
        });
      } catch (cause) { if (live) setMessage(cause instanceof Error ? cause.message : "Ringkasan tidak dapat dimuat dari Supabase."); }
      finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; };
  }, []);
  return <main className="page-wrap">
    <div className="mb-6"><p className="page-kicker">Jena Medical Center · Manajemen</p><h1 className="page-title">Dashboard</h1><p className="page-description">Ringkasan operasional dari transaksi tersimpan. Tidak menampilkan saldo keuangan yang belum dibukukan.</p></div>
    {message && <div role="status" className="demo-banner mb-5"><strong>{loading ? "Memuat data." : "Ringkasan belum tersedia."}</strong> {message}{message.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(item => <Link href={item.href} key={item.key} className="card card-pad transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs text-[var(--muted)]">{item.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{loading ? "…" : snapshot[item.key].toLocaleString("id-ID")}</p><p className="mt-1 text-xs text-[var(--muted-soft)]">{item.hint}</p></Link>)}</section>
    <section className="mt-5 grid gap-4 lg:grid-cols-2"><article className="card card-pad"><h2 className="font-semibold">Alur kerja</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Pesanan → PO supplier → Faktur Supplier → invoice manual dari SO terkonfirmasi → pembayaran/alokasi → pembukuan sesuai konfigurasi.</p><div className="mt-4 flex flex-wrap gap-2"><Link className="primary-button" href="/">Buka pesanan pelanggan</Link><Link className="tab-button" href="/invoice-pelanggan">Invoice pelanggan</Link><Link className="tab-button" href="/pembayaran">Pembayaran</Link></div></article><article className="card card-pad"><h2 className="font-semibold">Kontrol keuangan</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Draft invoice dan capture faktur supplier belum menjadi pembukuan. Catatan pembayaran operasional belum tentu sudah dialokasikan atau dibukukan.</p><Link className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)]" href="/keuangan">Lihat status akuntansi →</Link></article></section>
    <p className="mt-5 text-xs text-[var(--muted-soft)]">Angka di atas adalah hitungan dokumen operasional aktual, bukan pendapatan, kas, piutang, hutang, atau laba.</p>
  </main>;
}
