"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tidak dapat masuk. Periksa akun dan konfigurasi Supabase.");
    } finally { setBusy(false); }
  }

  return <main className="page-wrap flex min-h-[70vh] items-center justify-center"><section className="card card-pad w-full max-w-md"><p className="page-kicker">Jena Medical Center</p><h1 className="page-title">Masuk ke Business Suite</h1><p className="page-description">Gunakan akun yang sudah dibuat oleh administrator di Supabase Auth.</p>{!configured ? <div className="demo-banner mt-5">Koneksi Supabase belum dikonfigurasi. Isi variabel di `.env.local` sesuai `.env.example`.</div> : <form className="mt-5 space-y-3" onSubmit={handleSubmit}><label className="block text-xs text-[var(--muted)]">Email<input className="field mt-1" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@perusahaan.id"/></label><label className="block text-xs text-[var(--muted)]">Password<input className="field mt-1" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password akun"/></label>{message && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{message}</p>}<button className="primary-button w-full" type="submit" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button></form>}<p className="mt-4 rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">Akses database memerlukan claim `app_metadata.business_role` bernilai `owner`, `admin`, atau `viewer`. Administrator menyiapkan claim melalui Supabase Auth; role dari `user_metadata` tidak digunakan sebagai otorisasi.</p><Link className="mt-4 inline-block text-sm text-[var(--accent)]" href="/">← Kembali ke pesanan</Link></section></main>;
}
