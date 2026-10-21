"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Account = { id: string; account_code: string; account_name: string; account_type: "asset" | "liability" | "equity" | "revenue" | "expense"; description: string | null; is_active: boolean };
const typeLabel: Record<Account["account_type"], string> = { asset: "Aset", liability: "Liabilitas", equity: "Ekuitas", revenue: "Pendapatan", expense: "Beban" };

export function AccountReference() {
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    setError(""); setLoading(true);
    if (!configured) { setError("Koneksi Supabase belum dikonfigurasi. Periksa variabel environment aplikasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRows([]); setError("Masuk dengan akun bisnis untuk melihat Daftar Akun."); setLoading(false); return; }
      const businessRole = String(session.user.app_metadata?.business_role ?? "");
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setRows([]); setError("Akun belum memiliki role business_role. Minta administrator memberi role owner, admin, atau viewer melalui Supabase Auth app_metadata."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.from("chart_of_accounts").select("id,account_code,account_name,account_type,description,is_active").order("account_code", { ascending: true }).limit(500);
      if (queryError) throw queryError;
      setRows((data ?? []) as Account[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat daftar akun dari Supabase."); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  const filtered = rows.filter(row => `${row.account_code} ${row.account_name} ${typeLabel[row.account_type]}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="page-wrap"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Master Data · Supabase</p><h1 className="page-title">Daftar Akun</h1><p className="page-description">Bagan akun (COA) resmi yang dipakai jurnal akuntansi; dikelola dari modul Keuangan.</p></div></div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="demo-banner"><strong>Satu sumber kebenaran.</strong> Data tampil langsung dari tabel chart_of_accounts. Tambah, ubah, atau nonaktifkan akun lewat tab Jurnal umum di halaman Keuangan.</div><Link className="tab-button" href="/keuangan#ledger">Kelola di Keuangan</Link></div>{error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}<section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Bagan akun</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? "Memuat…" : `${filtered.length} akun`}</p></div><input className="field sm:w-72" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari kode atau nama akun" aria-label="Cari akun"/></div><div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Kode","Nama akun","Kelompok","Status"].map(h => <th className="py-3 pr-3" key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(row => <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.account_code}</td><td className="py-4 pr-3 font-medium">{row.account_name}{row.description && <div className="mt-1 text-xs text-[var(--muted)]">{row.description}</div>}</td><td className="py-4 pr-3">{typeLabel[row.account_type]}</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{filtered.map(row => <article className="rounded-xl border border-[var(--border)] p-3" key={row.id}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.account_code}</p><h3 className="mt-1 text-sm font-semibold">{row.account_name}</h3></div><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{typeLabel[row.account_type]}</p></article>)}</div>{!loading && !error && filtered.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada akun. Buat COA melalui tab Jurnal umum di halaman Keuangan.</p>}</section></main>;
}
