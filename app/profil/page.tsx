"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Me = { name: string; email: string; role: string };
const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", viewer: "Viewer" };

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setDark(document.documentElement.dataset.theme === "dark");
      if (!isSupabaseConfigured()) { setMessage("Supabase belum dikonfigurasi pada environment ini."); return; }
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        if (!session) { setMessage("Masuk untuk melihat profil."); return; }
        const meta = session.user.user_metadata ?? {};
        const name = String(meta.full_name ?? meta.name ?? session.user.email?.split("@")[0] ?? "");
        setMe({ name, email: session.user.email ?? "", role: String(session.user.app_metadata?.business_role ?? "") });
      } catch {
        setMessage("Profil tidak dapat dimuat. Coba masuk kembali.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function setTheme(next: "light" | "dark") {
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("jena-theme", next);
    setDark(next === "dark");
  }

  async function signOut() {
    if (!isSupabaseConfigured() || signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      router.push("/login");
    } catch {
      setMessage("Keluar belum berhasil. Coba lagi.");
      setSigningOut(false);
    }
  }

  return <main className="page-wrap pf-wrap">
    <h1 className="pf-title">Profil</h1>
    {message && <p role="status" className="pf-msg">{message}{message.includes("Masuk") && <> <Link href="/login" className="underline">Masuk</Link></>}</p>}
    {me && <section className="pf-card" aria-label="Akun">
      <span className="pf-avatar" aria-hidden="true">{(me.name[0] ?? "?").toUpperCase()}</span>
      <div><strong>{me.name}</strong><p>{me.email}</p>{ROLE[me.role] && <span className="chip-mint">{ROLE[me.role]}</span>}</div>
    </section>}

    <h2 className="pf-h2">Pengaturan</h2>
    <div className="pf-list">
      <Link href="/pengaturan-usaha" className="pf-row"><div><strong>Pengaturan usaha</strong><p>Ringkasan konfigurasi usaha dan akses modul</p></div><span className="chip-mint">Buka →</span></Link>
      <div className="pf-row"><div><strong>Tampilan</strong><p>Terang atau gelap</p></div>
        <div role="group" aria-label="Tema" className="pf-seg"><button type="button" aria-pressed={!dark} onClick={() => setTheme("light")}>Terang</button><button type="button" aria-pressed={dark} onClick={() => setTheme("dark")}>Gelap</button></div></div>
    </div>
    <button type="button" className="pf-out" onClick={() => void signOut()} disabled={!me || signingOut}>{signingOut ? "Keluar…" : "Keluar"}</button>
    <p className="pf-note">Modul lain dibuka dari Akses cepat di Home.</p>
  </main>;
}
