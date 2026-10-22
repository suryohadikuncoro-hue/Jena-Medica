"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/error-message";

type Account = { id: string; account_code: string; account_name: string; account_type: "asset" | "liability" | "equity" | "revenue" | "expense"; description: string | null; is_active: boolean };
const typeLabel: Record<Account["account_type"], string> = { asset: "Aset", liability: "Liabilitas", equity: "Ekuitas", revenue: "Pendapatan", expense: "Beban" };
const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, char => `\\${char}`);
}


export function AccountReference() {
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
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
      const from = page * PAGE_SIZE; const to = from + PAGE_SIZE - 1;
      const term = debouncedQuery.trim();
      let request = supabase.from("chart_of_accounts").select("id,account_code,account_name,account_type,description,is_active", { count: "exact" });
      if (term) request = request.or(`account_code.ilike.%${escapeIlike(term)}%,account_name.ilike.%${escapeIlike(term)}%,description.ilike.%${escapeIlike(term)}%`);
      const { data, error: queryError, count } = await request.order("account_code", { ascending: true }).range(from, to);
      if (queryError) throw queryError;
      setRows((data ?? []) as Account[]); setTotal(count ?? 0);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memuat daftar akun dari Supabase.")); }
    finally { setLoading(false); }
  }, [configured, page, debouncedQuery]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query); setPage(0); }, SEARCH_DEBOUNCE_MS); return () => window.clearTimeout(timer); }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <main className="page-wrap"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Master Data · Supabase</p><h1 className="page-title">Daftar Akun</h1><p className="page-description">Bagan akun (COA) resmi yang dipakai jurnal akuntansi; dikelola dari modul Keuangan.</p></div></div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="demo-banner"><strong>Satu sumber kebenaran.</strong> Data tampil langsung dari tabel chart_of_accounts. Tambah, ubah, atau nonaktifkan akun lewat tab Jurnal umum di halaman Keuangan.</div><Link className="tab-button" href="/keuangan#ledger">Kelola di Keuangan</Link></div>{error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}<section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Bagan akun</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? "Memuat…" : `${total} akun · halaman ${page + 1} dari ${totalPages}`}</p></div><input className="field sm:w-72" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari kode atau nama akun" aria-label="Cari akun"/></div><div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Kode","Nama akun","Kelompok","Status"].map(h => <th className="py-3 pr-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.account_code}</td><td className="py-4 pr-3 font-medium">{row.account_name}{row.description && <div className="mt-1 text-xs text-[var(--muted)]">{row.description}</div>}</td><td className="py-4 pr-3">{typeLabel[row.account_type]}</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{rows.map(row => <article className="rounded-xl border border-[var(--border)] p-3" key={row.id}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.account_code}</p><h3 className="mt-1 text-sm font-semibold">{row.account_name}</h3></div><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{typeLabel[row.account_type]}</p></article>)}</div>{!loading && !error && rows.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada akun. Buat COA melalui tab Jurnal umum di halaman Keuangan.</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--muted)]">Halaman {page + 1} dari {totalPages} · {total} akun</p><div className="flex gap-2"><button type="button" className="tab-button" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))}>Sebelumnya</button><button type="button" className="tab-button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(current => current + 1)}>Berikutnya</button></div></div></section></main>;
}
