"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;

    let active = true;
    const supabase = getSupabaseBrowserClient();
    const applySession = (session: Session | null) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setEmail(session?.user.email ?? "");
      setLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      applySession(data.session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (password.length < 8) {
      setMessage("Kata sandi harus minimal 8 karakter.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Konfirmasi kata sandi belum sama.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmation("");
      setSuccess(true);
      setMessage("Kata sandi berhasil disimpan. Anda dapat menggunakan email dan kata sandi ini untuk masuk berikutnya.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kata sandi belum dapat diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-wrap flex min-h-[70vh] items-center justify-center">
      <section className="card card-pad w-full max-w-md">
        <p className="page-kicker">Jena Medical Center</p>
        <h1 className="page-title">Atur kata sandi</h1>
        <p className="page-description">Gunakan halaman ini setelah membuka tautan undangan atau pemulihan akun dari email.</p>

        {!configured ? (
          <div className="demo-banner mt-5">Koneksi Supabase belum dikonfigurasi. Periksa environment aplikasi.</div>
        ) : loading ? (
          <p className="mt-5 text-sm text-[var(--muted)]">Memeriksa sesi akun…</p>
        ) : !hasSession ? (
          <div className="mt-5 space-y-3">
            <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Sesi undangan atau pemulihan belum aktif. Buka tautan terbaru dari email terlebih dahulu, lalu kembali ke halaman ini.
            </p>
            <Link className="primary-button inline-flex" href="/login">Kembali ke halaman masuk</Link>
          </div>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            {email && <p className="text-sm text-[var(--muted)]">Akun: <span className="font-medium text-[var(--foreground)]">{email}</span></p>}
            <label className="block text-xs text-[var(--muted)]">
              Kata sandi baru
              <input className="field mt-1" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="Minimal 8 karakter" />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Ulangi kata sandi baru
              <input className="field mt-1" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Ketik ulang kata sandi" />
            </label>
            {message && <p role={success ? "status" : "alert"} className={`rounded-lg border p-3 text-sm ${success ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-800"}`}>{message}</p>}
            <button className="primary-button w-full" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan kata sandi"}</button>
          </form>
        )}

        {success && <Link className="mt-4 inline-block text-sm text-[var(--accent)]" href="/">Lanjut ke pesanan →</Link>}
        <p className="mt-4 text-xs text-[var(--muted)]">Jangan bagikan tautan undangan atau kata sandi kepada siapa pun.</p>
      </section>
    </main>
  );
}
