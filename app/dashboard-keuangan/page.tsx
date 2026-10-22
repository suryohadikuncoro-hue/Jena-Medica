"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ActionBanner, ButtonLink } from "@/app/components/ui";

const PERIODS = ["Hari", "Minggu", "Bulan", "3 bulan", "6 bulan", "Tahun"] as const;
type Period = (typeof PERIODS)[number];
type Account = { id: string; account_code: string; account_name: string; account_type: "asset" | "liability" | "equity" | "revenue" | "expense"; is_active: boolean };
type Mapping = { mapping_key: string; account_id: string };
type Entry = { id: string; entry_date: string; status: "posted" | "reversed" };
type Line = { journal_entry_id: string; account_id: string; debit: number | string; credit: number | string };
type Snapshot = { accounts: Account[]; mappings: Mapping[]; entries: Entry[]; lines: Line[]; draftSalesCount: number; draftSalesValue: number; draftSupplierCount: number; draftSupplierValue: number };
const empty: Snapshot = { accounts: [], mappings: [], entries: [], lines: [], draftSalesCount: 0, draftSalesValue: 0, draftSupplierCount: 0, draftSupplierValue: 0 };
const cash = (n: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
const count = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const dateLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
async function readPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from=0;;from+=500) { const {data,error}=await fetchPage(from,from+499); if(error) throw new Error(error.message); const rows=data??[]; all.push(...rows); if(rows.length<500) return all; }
}
function startFor(period: Period) {
  const d=new Date(); d.setHours(0,0,0,0);
  if(period==="Hari") return dateLocal(d);
  if(period==="Minggu") d.setDate(d.getDate()-6);
  else if(period==="Bulan") d.setDate(1);
  else if(period==="3 bulan") d.setMonth(d.getMonth()-2,1);
  else if(period==="6 bulan") d.setMonth(d.getMonth()-5,1);
  else d.setMonth(0,1);
  return dateLocal(d);
}

export default function FinanceDashboardPage() {
  const [period,setPeriod]=useState<Period>("Bulan");
  const [data,setData]=useState<Snapshot>(empty);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let live=true;
    const load=async()=>{
      setLoading(true); setMessage("");
      if(!isSupabaseConfigured()){setMessage("Supabase belum dikonfigurasi pada environment ini.");setLoading(false);return;}
      try{
        const db=getSupabaseBrowserClient();
        const {data:{session}}=await db.auth.getSession();
        if(!session) throw new Error("Masuk untuk melihat laporan keuangan.");
        const role=String(session.user.app_metadata?.business_role??"");
        if(!["owner","admin","viewer"].includes(role)) throw new Error("Akun ini belum memiliki role bisnis yang valid.");
        const [accounts,mappings,entries,lines,sales,suppliers]=await Promise.all([
          readPages<Account>((from,to)=>db.from("chart_of_accounts").select("id,account_code,account_name,account_type,is_active").eq("is_active",true).range(from,to)),
          readPages<Mapping>((from,to)=>db.from("accounting_account_mappings").select("mapping_key,account_id").range(from,to)),
          readPages<Entry>((from,to)=>db.from("journal_entries").select("id,entry_date,status").eq("status","posted").order("entry_date").range(from,to)),
          readPages<Line>((from,to)=>db.from("journal_lines").select("journal_entry_id,account_id,debit,credit").range(from,to)),
          readPages<{status:string;total_amount:number|string}>((from,to)=>db.from("sales_invoices").select("status,total_amount").eq("status","draft").range(from,to)),
          readPages<{status:string;invoice_total_reported:number|string}>((from,to)=>db.from("supplier_invoices").select("status,invoice_total_reported").eq("status","draft").range(from,to))
        ]);
        if(live) setData({accounts,mappings,entries,lines,draftSalesCount:sales.length,draftSalesValue:sales.reduce((n,r)=>n+Number(r.total_amount||0),0),draftSupplierCount:suppliers.length,draftSupplierValue:suppliers.reduce((n,r)=>n+Number(r.invoice_total_reported||0),0)});
      }catch(e){if(live)setMessage(e instanceof Error?e.message:"Data laporan tidak dapat dimuat.");}
      finally{if(live)setLoading(false);}
    };
    const timer=window.setTimeout(()=>void load(),0);
    return()=>{live=false;window.clearTimeout(timer);};
  },[]);

  const metrics=useMemo(()=>{
    const accountById=new Map(data.accounts.map(a=>[a.id,a]));
    const mappingByKey=new Map(data.mappings.map(m=>[m.mapping_key,m.account_id]));
    const posted=new Map(data.entries.map(e=>[e.id,e]));
    const start=startFor(period), today=dateLocal(new Date());
    let cashBank=0,revenue=0,expenses=0,periodDebits=0,periodCredits=0;
    for(const line of data.lines){
      const entry=posted.get(line.journal_entry_id); if(!entry) continue;
      const debit=Number(line.debit||0), credit=Number(line.credit||0);
      const acct=accountById.get(line.account_id); if(!acct) continue;
      if(entry.entry_date<=today && (line.account_id===mappingByKey.get("cash")||line.account_id===mappingByKey.get("bank"))) cashBank+=debit-credit;
      if(entry.entry_date>=start && entry.entry_date<=today){
        periodDebits+=debit; periodCredits+=credit;
        if(acct.account_type==="revenue") revenue+=credit-debit;
        if(acct.account_type==="expense") expenses+=debit-credit;
      }
    }
    return {cashBank,revenue,expenses,profit:revenue-expenses,periodDebits,periodCredits,start,today,postedCount:data.entries.filter(e=>e.entry_date>=start&&e.entry_date<=today).length};
  },[data,period]);

  const emptyPeriod=metrics.postedCount===0;
  const money=(n:number)=>loading?"…":cash(n);
  const number=(n:number)=>loading?"…":count(n);
  return <main className="page-wrap dk-wrap">
    <header className="dk-head"><div><p className="page-kicker">Ringkasan bisnis</p><h1 className="dk-title">Dashboard keuangan</h1><p className="dk-sub">Berdasarkan jurnal terposting di Supabase · {metrics.start} sampai {metrics.today}</p></div><div className="dk-periods" role="group" aria-label="Rentang waktu">{PERIODS.map(item=><button key={item} type="button" aria-pressed={period===item} className={`dk-pill ${period===item?"dk-pill-on":""}`} onClick={()=>setPeriod(item)}>{item}</button>)}</div></header>
    {message&&<ActionBanner className="dk-message" action={message.includes("Masuk")?<ButtonLink href="/login" variant="solid" size="sm">Masuk</ButtonLink>:undefined}><b>{loading?"Memuat data.":"Laporan belum tersedia."}</b> {message}</ActionBanner>}
    <section aria-labelledby="dk-docs" className="dk-docs"><div className="dk-section-head"><div><h2 id="dk-docs" className="dk-h2">Dokumen belum dibukukan</h2><p className="dk-sub">Dokumen operasional bukan saldo kas, pendapatan, piutang, hutang, atau laba.</p></div><span className="dk-label">Data aktual</span></div>
      <div className="dk-kpis">
        <Link href="/invoice-pelanggan" className="dk-kpi chip-pink"><span>Draf invoice pelanggan</span><strong>{number(data.draftSalesCount)}</strong><small>Belum menjadi piutang</small></Link>
        <Link href="/invoice-pelanggan" className="dk-kpi chip-yellow"><span>Nilai draf pelanggan</span><strong>{money(data.draftSalesValue)}</strong><small>Belum termasuk PPN, bukan pendapatan</small></Link>
        <Link href="/operasional#invoices" className="dk-kpi chip-mint"><span>Draf faktur supplier</span><strong>{number(data.draftSupplierCount)}</strong><small>Belum menjadi hutang usaha</small></Link>
        <Link href="/operasional#invoices" className="dk-kpi chip-pink"><span>Nilai draf supplier</span><strong>{money(data.draftSupplierValue)}</strong><small>Nilai dokumen, bukan HPP</small></Link>
      </div>
    </section>
    <section className="dk-grid3" aria-label="Ringkasan jurnal terposting">
      <article className="dk-card"><h2 className="dk-h2">Kas dan bank</h2><p className="dk-sub">Mutasi bersih pada akun kas/bank yang dipetakan.</p><strong className="dk-finance-value">{money(metrics.cashBank)}</strong><p className="dk-note">Akumulasi jurnal yang tersedia; belum termasuk saldo awal di luar jurnal.</p></article>
      <article className="dk-card"><h2 className="dk-h2">Pendapatan dan pengeluaran</h2><p className="dk-sub">Akumulasi pada periode terpilih.</p><div className="dk-finance-row"><span>Pendapatan</span><strong>{money(metrics.revenue)}</strong></div><div className="dk-finance-row"><span>Beban</span><strong>{money(metrics.expenses)}</strong></div><div className="dk-finance-row"><span>Selisih</span><strong>{money(metrics.revenue-metrics.expenses)}</strong></div></article>
      <article className="dk-card"><h2 className="dk-h2">Laba/rugi periode</h2><p className="dk-sub">Pendapatan dikurangi beban dari jurnal terposting.</p><strong className="dk-finance-value">{money(metrics.profit)}</strong><p className="dk-note">Belum termasuk HPP otomatis atau penyesuaian yang belum dijurnal.</p><Link href="/keuangan" className="dk-link">Buka laporan akuntansi →</Link></article>
    </section>
    {!loading&&!message&&emptyPeriod&&<p className="dk-note" role="status">Belum ada jurnal terposting pada rentang waktu ini. Nilai nol ditampilkan berdasarkan data aktual, bukan angka contoh.</p>}
    <p className="dk-note dk-foot">Angka merupakan ringkasan jurnal terposting, bukan laporan pajak resmi. Saldo kas/bank belum memperhitungkan saldo awal dan rekonsiliasi bank. Periksa buku besar sebelum menjadikannya dasar keputusan keuangan.</p>
  </main>;
}
