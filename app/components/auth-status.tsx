"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthStatus({ compact = false }: { compact?: boolean }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [configured]);

  if (!configured) return <span className={compact ? "mt-3 block text-xs text-[var(--muted)]" : "hidden text-xs text-[var(--muted)] xl:inline"}>Supabase belum dikonfigurasi</span>;
  if (!user) return <Link href="/login" className={compact ? "tab-button mt-3 inline-flex w-full justify-center" : "tab-button hidden sm:inline-flex"}>Masuk Supabase</Link>;

  const role = typeof user.app_metadata?.business_role === "string" ? user.app_metadata.business_role : "tanpa role";
  if (compact) return <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-3"><span className="min-w-0"><span className="block truncate text-xs font-medium">{user.email ?? "Akun"}</span><span className="block text-[10px] capitalize text-[var(--muted)]">{role}</span></span><div className="flex items-center gap-2"><Link href="/set-password" className="tab-button">Atur kata sandi</Link><button type="button" disabled={busy} className="tab-button" onClick={async () => { setBusy(true); await getSupabaseBrowserClient().auth.signOut(); setBusy(false); }}>{busy ? "Keluar…" : "Keluar"}</button></div></div>;

  return <div className="hidden items-center gap-2 sm:flex"><span className="hidden max-w-40 text-right leading-tight xl:block"><span className="block truncate text-xs font-medium">{user.email ?? "Akun"}</span><span className="block text-[10px] capitalize text-[var(--muted)]">{role}</span></span><Link href="/set-password" className="tab-button">Atur kata sandi</Link><button type="button" disabled={busy} className="tab-button" onClick={async () => { setBusy(true); await getSupabaseBrowserClient().auth.signOut(); setBusy(false); }}>{busy ? "Keluar…" : "Keluar"}</button></div>;
}
