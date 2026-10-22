"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type State = { email: string; role: string; profile: string; accounts: number; mappings: number; periods: number };
const labels: Record<string,string> = { owner:"Owner", admin:"Admin", viewer:"Viewer" };

export default function PengaturanUsahaPage() {
  const [state,setState]=useState<State|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try {
        if(!isSupabaseConfigured()) throw new Error("Supabase belum dikonfigurasi.");
        const db=getSupabaseBrowserClient();
        const {data:{session}}=await db.auth.getSession();
        if(!session) throw new Error("Masuk untuk melihat pengaturan usaha.");
        const role=String(session.user.app_metadata?.business_role??"");
        if(!["owner","admin","viewer"].includes(role)) throw new Error("Akun belum memiliki role bisnis yang valid.");
        const results=await Promise.all([
          db.from("accounting_posting_profile").select("status").eq("singleton",true).maybeSingle(),
          db.from("chart_of_accounts").select("id",{count:"exact",head:true}).eq("is_active",true),
          db.from("accounting_account_mappings").select("mapping_key"),
          db.from("accounting_periods").select("id",{count:"exact",head:true})
        ]);
        for(const r of results) if(r.error) throw r.error;
        if(active) setState({email:session.user.email??"",role,profile:results[0].data?.status??"belum disiapkan",accounts:results[1].count??0,mappings:results[2].data?.length??0,periods:results[3].count??0});
      } catch(e) { if(active) setError(e instanceof Error?e.message:"Pengaturan tidak dapat dimuat."); }
      finally { if(active) setLoading(false); }
    };
    const timer=window.setTimeout(()=>void load(),0);
    return()=>{active=false;window.clearTimeout(timer);};
  },[]);
  return <main className="page-wrap">
    <header className="mb-6"><p className="page-kicker">Konfigurasi usaha</p><h1 className="page-title">Pengaturan usaha</h1><p className="mt-2 text-sm opacity-70">Ringkasan status konfigurasi dan akses ke modul yang tersedia.</p></header>
    {loading&&<p role="status">Memuat status konfigurasi…</p>}
    {error&&<div role="alert" className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">{error}{error.includes("Masuk")&&<> <Link href="/login" className="underline">Masuk</Link></>}</div>}
    {state&&<section className="mb-6 rounded-3xl border p-5"><p className="text-sm opacity-70">Akun aktif</p><h2 className="mt-1 text-lg font-bold">{state.email}</h2><p className="mt-1 text-sm">Role: <strong>{labels[state.role]??state.role}</strong></p><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-2xl bg-[var(--shell)] p-3"><span className="text-xs opacity-70">Profil pembukuan</span><p className="mt-1 font-semibold">{state.profile==="approved"?"Disetujui":state.profile}</p></div><div className="rounded-2xl bg-[var(--shell)] p-3"><span className="text-xs opacity-70">Akun aktif</span><p className="mt-1 font-semibold">{state.accounts}</p></div><div className="rounded-2xl bg-[var(--shell)] p-3"><span className="text-xs opacity-70">Pemetaan akun</span><p className="mt-1 font-semibold">{state.mappings}/10</p></div><div className="rounded-2xl bg-[var(--shell)] p-3"><span className="text-xs opacity-70">Periode tercatat</span><p className="mt-1 font-semibold">{state.periods}</p></div></div></section>}
    <h2 className="mb-3 text-lg font-bold">Modul yang tersedia</h2>
    <div className="grid gap-3 md:grid-cols-2">
      <Link href="/keuangan" className="rounded-2xl border p-4"><strong>Akun dan pembukuan</strong><p className="mt-1 text-sm opacity-70">Bagan akun, jurnal, laporan, dan proses tutup buku.</p><span className="mt-3 inline-block text-sm font-semibold">Buka modul →</span></Link>
      <Link href="/dashboard-keuangan" className="rounded-2xl border p-4"><strong>Dashboard keuangan</strong><p className="mt-1 text-sm opacity-70">Ringkasan dari jurnal terposting dan dokumen aktual.</p><span className="mt-3 inline-block text-sm font-semibold">Buka dashboard →</span></Link>
      <Link href="/keuangan#ppn" className="rounded-2xl border p-4"><strong>Referensi pajak</strong><p className="mt-1 text-sm opacity-70">Buka bagian perpajakan pada modul keuangan.</p><span className="mt-3 inline-block text-sm font-semibold">Buka bagian pajak →</span></Link>
      <Link href="/profil" className="rounded-2xl border p-4"><strong>Akun dan tampilan</strong><p className="mt-1 text-sm opacity-70">Lihat akun login dan ubah tema aplikasi.</p><span className="mt-3 inline-block text-sm font-semibold">Buka profil →</span></Link>
    </div>
    <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong>Belum tersedia sebagai formulir tersimpan:</strong> profil legal usaha, status PKP, preferensi pajak, dan administrasi pengguna. Halaman ini menampilkan status data yang benar-benar tersedia; belum menyimpan pengaturan baru.</section>
  </main>;
}
