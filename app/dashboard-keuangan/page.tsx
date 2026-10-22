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
type Snapshot = { accounts: Account[]; mappings: Mapping[]; entries: Entry[]; lines: Line[]; draftSalesCount: number; draftSalesValue: number; draftSupplierCount: number; draftSupplierValue: number; postingProfileStatus: string; accountingPeriodCount: number };
const empty: Snapshot = { accounts: [], mappings: [], entries: [], lines: [], draftSalesCount: 0, draftSalesValue: 0, draftSupplierCount: 0, draftSupplierValue: 0, postingProfileStatus: "unknown", accountingPeriodCount: 0 };
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
        const [accounts,mappings,entries,lines,sales,suppliers,profile,periods]=await Promise.all([
          readPages<Account>((from,to)=>db.from("chart_of_accounts").select("id,account_code,account_name,account_type,is_active").eq("is_active",true).range(from,to)),
          readPages<Mapping>((from,to)=>db.from("accounting_account_mappings").select("mapping_key,account_id").range(from,to)),
          readPages<Entry>((from,to)=>db.from("journal_entries").select("id,entry_date,status").eq("status","posted").order("entry_date").range(from,to)),
          readPages<Line>((from,to)=>db.from("journal_lines").select("journal_entry_id,account_id,debit,credit").range(from,to)),
          readPages<{status:string;total_amount:number|string}>((from,to)=>db.from("sales_invoices").select("status,total_amount").eq("status","draft").range(from,to)),
          readPages<{status:string;invoice_total_reported:number|string}>((from,to)=>db.from("supplier_invoices").select("status,invoice_total_reported").eq("status","draft").range(from,to)),
          db.from("accounting_posting_profile").select("status").eq("singleton",true).maybeSingle(),
          db.from("accounting_periods").select("id",{count:"exact",head:true})
        ]);
        if(profile.error) throw new Error(profile.error.message);
        if(periods.error) throw new Error(periods.error.message);
        if(live) setData({accounts,mappings,entries,lines,draftSalesCount:sales.length,draftSalesValue:sales.reduce((n,r)=>n+Number(r.total_amount||0),0),draftSupplierCount:suppliers.length,draftSupplierValue:suppliers.reduce((n,r)=>n+Number(r.invoice_total_reported||0),0),postingProfileStatus:profile.data?.status??"missing",accountingPeriodCount:periods.count??0});
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
  const mappingReady = data.mappings.length >= 10;
  const periodReady = data.accountingPeriodCount > 0;
  const postingReady = data.postingProfileStatus === "approved";
  const hasCashMapping = data.mappings.some(m=>m.mapping_key==="cash"||m.mapping_key==="bank");
  const mockCard: React.CSSProperties = {padding:20,borderRadius:24,background:"var(--dk-card)",minWidth:0};
  const mockSub: React.CSSProperties = {margin:"3px 0 0",fontSize:12,color:"var(--dk-muted)"};
  const mockTitle: React.CSSProperties = {margin:0,fontSize:20,fontWeight:700,letterSpacing:"-.02em"};
  const mockPill: React.CSSProperties = {display:"inline-flex",alignItems:"center",minHeight:36,padding:"0 15px",borderRadius:999,fontSize:12,fontWeight:650,whiteSpace:"nowrap",background:"var(--dk-shell)",color:"var(--dk-muted)"};
  const statusTag = (good:boolean): React.CSSProperties => ({display:"inline-flex",alignItems:"center",padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:good?"var(--pastel-mint-bg)":"var(--pastel-yellow-bg)",color:good?"var(--pastel-mint-fg)":"var(--pastel-yellow-fg)"});
  const navTabs = [
    ["Ikhtisar", "/dashboard-keuangan", true],
    ["Laba rugi", "/keuangan#laba-rugi", false],
    ["Neraca", "/keuangan#neraca", false],
    ["Jurnal umum", "/keuangan#jurnal", false],
    ["Buku Besar", "/keuangan#buku-besar", false],
    ["Tutup Buku", "/keuangan#tutup-buku", false],
    ["PPN", "/keuangan#ppn", false],
    ["Hutang & piutang", "/pembayaran", false],
  ] as const;
  return <main className="page-wrap dk-wrap">
    <header style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:14,marginBottom:18}}>
      <div><h1 className="dk-title" style={{margin:0,fontSize:30,fontWeight:800,letterSpacing:"-.03em"}}>Dashboard</h1><p style={{...mockSub,fontSize:13}}>Laporan keuangan ringkas · {metrics.start} sampai {metrics.today} · dari jurnal yang sudah dibukukan</p></div>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10}}>
        <Link href="/keuangan" className="dk-mock-search">Cari laporan <span aria-hidden="true">⌕</span></Link>
        <Link href="/pengaturan-usaha" className="dk-mock-user" aria-label="Pengaturan usaha">♧</Link>
      </div>
    </header>

    <nav className="dk-tabs" aria-label="Navigasi laporan keuangan">
      {navTabs.map(([label,href,active])=><Link key={label} href={href} className={`dk-tab ${active?"dk-tab-on":""}`} aria-current={active?"page":undefined}>{label}</Link>)}
    </nav>
    <div role="group" aria-label="Rentang waktu" style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
      {PERIODS.map(item=><button key={item} type="button" aria-pressed={period===item} className={`dk-period-choice ${period===item?"on":""}`} onClick={()=>setPeriod(item)}>{item}</button>)}
    </div>
    {message&&<ActionBanner className="dk-message" action={message.includes("Masuk")?<ButtonLink href="/login" variant="solid" size="sm">Masuk</ButtonLink>:undefined}><b>{loading?"Memuat data.":"Laporan belum tersedia."}</b> {message}</ActionBanner>}

    <div className="dk-mock-grid">
      <div className="dk-mock-col">
        <section style={mockCard}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><h2 style={mockTitle}>Kas dan bank</h2><span style={mockSub}>Per {metrics.today}</span></div>
          <div className="dk-cash-panel">
            <div style={{fontSize:12,opacity:.85}}>Mutasi bersih tercatat</div>
            <div style={{marginTop:4,fontSize:28,fontWeight:800,letterSpacing:"-.02em"}}>{money(metrics.cashBank)}</div>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:22,fontSize:12}}><span>Saldo awal<br/><b style={{fontSize:13}}>Belum terhubung</b></span><span style={{textAlign:"right"}}>Rekonsiliasi<br/><b style={{fontSize:13}}>Belum diverifikasi</b></span></div>
          </div>
          <p style={{...mockSub,marginTop:10,lineHeight:1.6}}>Angka merupakan mutasi jurnal akun kas/bank yang dipetakan, bukan saldo bank hasil rekonsiliasi.</p>
        </section>
        <section style={mockCard}>
          <h2 style={mockTitle}>Pendapatan dan pengeluaran</h2>
          <p style={mockSub}>Periode {period.toLowerCase()} · {metrics.start} — {metrics.today}</p>
          <div style={{display:"flex",gap:14,margin:"14px 0 10px",fontSize:12,color:"var(--dk-muted)"}}><span><i className="dk-dot revenue"/>Pendapatan</span><span><i className="dk-dot expenses"/>Beban</span></div>
          <div className="dk-chart-panel">
            <div className="dk-bar-row"><span>Pendapatan</span><div className="dk-bar-track"><i className="revenue" style={{width:`${Math.max(metrics.revenue,0)/(Math.max(metrics.revenue,metrics.expenses,1))*100}%`}}/></div><b>{money(metrics.revenue)}</b></div>
            <div className="dk-bar-row"><span>Beban</span><div className="dk-bar-track"><i className="expenses" style={{width:`${Math.max(metrics.expenses,0)/(Math.max(metrics.revenue,metrics.expenses,1))*100}%`}}/></div><b>{money(metrics.expenses)}</b></div>
            {emptyPeriod&&<p className="dk-chart-empty">Belum ada jurnal terposting pada periode ini. Grafik akan terisi dari data aktual.</p>}
          </div>
          <p style={{...mockSub,marginTop:8,lineHeight:1.6}}>Beban mencerminkan akun bertipe beban yang telah dibukukan. HPP tidak diperkirakan jika belum tercatat di jurnal.</p>
        </section>
      </div>

      <div className="dk-mock-col">
        <section style={mockCard}>
          <h2 style={mockTitle}>Progres</h2><p style={mockSub}>Kesiapan penagihan dan pembukuan</p>
          <div className="dk-status-list">
            <div><div className="dk-status-line"><span>Profil pembukuan</span><span style={statusTag(postingReady)}>{postingReady?"Disetujui":"Perlu ditinjau"}</span></div><p style={mockSub}>Status konfigurasi posting dari Supabase.</p></div>
            <div><div className="dk-status-line"><span>Pemetaan akun</span><span style={statusTag(mappingReady)}>{data.mappings.length} pemetaan</span></div><div className="dk-progress-track"><i style={{width:`${Math.min(data.mappings.length/10*100,100)}%`}}/></div></div>
            <div><div className="dk-status-line"><span>Periode akuntansi</span><span style={statusTag(periodReady)}>{periodReady?`${data.accountingPeriodCount} periode`:"Belum tersedia"}</span></div></div>
            <div><div className="dk-status-line"><span>Kas/bank terpetakan</span><span style={statusTag(hasCashMapping)}>{hasCashMapping?"Tersedia":"Perlu ditinjau"}</span></div></div>
          </div>
          <Link href="/pengaturan-usaha" className="dk-mock-link">Periksa kesiapan →</Link>
        </section>
        <section style={mockCard}>
          <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"flex-end",gap:10}}><div><h2 style={mockTitle}>Selisih pendapatan dan beban</h2><p style={mockSub}>Periode {period.toLowerCase()}</p></div><div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:800}}>{money(metrics.profit)}</div><div style={{fontSize:12,fontWeight:700,color:metrics.profit>=0?"var(--dk-good)":"var(--dk-bad)"}}>Berdasarkan jurnal aktual</div></div></div>
          <div className="dk-profit-panel"><div className="dk-profit-line"><span>Pendapatan</span><b>{money(metrics.revenue)}</b></div><div className="dk-profit-line"><span>Beban</span><b>{money(metrics.expenses)}</b></div><div className="dk-profit-line total"><span>Selisih</span><b>{money(metrics.profit)}</b></div></div>
          <p style={{...mockSub,marginTop:8,lineHeight:1.6}}>Ini bukan laba bersih final apabila HPP, beban, saldo awal, atau jurnal lain belum lengkap.</p>
        </section>
      </div>

      <div className="dk-mock-col">
        <section style={mockCard}>
          <h2 style={mockTitle}>Dokumen operasional</h2><p style={{...mockSub,marginBottom:12}}>Dokumen yang belum menjadi saldo akuntansi</p>
          <div className="dk-doc-mini"><span>Draf invoice pelanggan</span><b>{number(data.draftSalesCount)}</b><small>{money(data.draftSalesValue)} · belum menjadi piutang</small></div>
          <div className="dk-doc-mini"><span>Draf faktur supplier</span><b>{number(data.draftSupplierCount)}</b><small>{money(data.draftSupplierValue)} · belum menjadi hutang</small></div>
        </section>
        <section style={mockCard}>
          <h2 style={mockTitle}>Biaya</h2><p style={mockSub}>Komposisi biaya periode terpilih</p>
          <div className="dk-empty-visual"><span>Data komposisi belum tersedia</span><p>Belum ada ringkasan kategori biaya yang tervalidasi dari jurnal.</p><Link href="/keuangan">Periksa jurnal biaya →</Link></div>
        </section>
        <section style={mockCard}>
          <h2 style={mockTitle}>Transaksi terbaru</h2>
          <div className="dk-empty-visual"><span>Belum tersedia</span><p>Daftar transaksi terbaru perlu dihubungkan ke sumber jurnal dan pembayaran yang tervalidasi.</p><Link href="/keuangan#jurnal">Lihat jurnal →</Link></div>
        </section>
      </div>
    </div>
    <p className="dk-note dk-foot">Mockup digunakan sebagai acuan tata letak dan gaya. Nilai keuangan ditampilkan dari data Supabase yang tersedia; tidak ada angka contoh. Saldo awal, rekonsiliasi, progres penagihan, komposisi biaya, dan transaksi terbaru tidak direkayasa ketika sumbernya belum tersedia.</p>
  </main>;
}
