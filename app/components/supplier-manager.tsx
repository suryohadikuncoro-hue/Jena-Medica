"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Supplier = { id: string; code: string; legal_name: string; display_name: string | null; tax_status: "pkp" | "non_pkp" | "unverified"; tax_identifier: string | null; email: string | null; phone: string | null; payment_terms_days: number; is_active: boolean };
type SupplierDraft = { code: string; legal_name: string; display_name: string; tax_status: Supplier["tax_status"]; tax_identifier: string; email: string; phone: string; payment_terms_days: string };
const emptyDraft: SupplierDraft = { code: "", legal_name: "", display_name: "", tax_status: "unverified", tax_identifier: "", email: "", phone: "", payment_terms_days: "0" };
const columns = "id,code,legal_name,display_name,tax_status,tax_identifier,email,phone,payment_terms_days,is_active";

export function SupplierManager() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<SupplierDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const configured = isSupabaseConfigured();
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setError(""); setLoading(true);
    if (!configured) { setError("Koneksi Supabase belum dikonfigurasi. Periksa variabel environment aplikasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(""); setRows([]); setError("Masuk dengan akun bisnis untuk melihat data Supplier."); setLoading(false); return; }
      const businessRole = String(session.user.app_metadata?.business_role ?? ""); setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setRows([]); setError("Akun belum memiliki role business_role. Minta administrator memberi role owner, admin, atau viewer melalui Supabase Auth app_metadata."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.from("suppliers").select(columns).order("legal_name", { ascending: true }).limit(200);
      if (queryError) throw queryError;
      setRows((data ?? []) as Supplier[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat supplier dari Supabase."); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk menambah Supplier.");
      const supabase = getSupabaseBrowserClient();
      const { error: insertError } = await supabase.from("suppliers").insert({
        code: draft.code.trim(), legal_name: draft.legal_name.trim(), display_name: draft.display_name.trim() || null,
        tax_status: draft.tax_status, tax_identifier: draft.tax_identifier.trim() || null,
        email: draft.email.trim() || null, phone: draft.phone.trim() || null,
        payment_terms_days: Number(draft.payment_terms_days),
      });
      if (insertError) throw insertError;
      setDraft(emptyDraft); setShowForm(false); setNotice("Supplier tersimpan di Supabase."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan supplier."); }
    finally { setSaving(false); }
  }

  async function toggleActive(supplier: Supplier) {
    setError(""); setNotice("");
    try {
      const { error: updateError } = await getSupabaseBrowserClient().from("suppliers").update({ is_active: !supplier.is_active }).eq("id", supplier.id);
      if (updateError) throw updateError;
      setNotice(`${supplier.legal_name} ${supplier.is_active ? "dinonaktifkan" : "diaktifkan"}.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memperbarui status supplier."); }
  }

  const filtered = rows.filter(row => `${row.code} ${row.legal_name} ${row.display_name ?? ""} ${row.phone ?? ""} ${row.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="page-wrap"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Master Data · Supabase</p><h1 className="page-title">Supplier</h1><p className="page-description">Supplier mengirim langsung ke alamat pelanggan melalui PO drop-ship.</p></div>{canWrite && <button className="primary-button" onClick={() => { setShowForm(v => !v); setError(""); }}>＋ Tambah Supplier</button>}</div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="demo-banner"><strong>Terhubung ke database.</strong> Akses dilindungi Supabase Auth dan RLS; tidak ada data contoh yang dimuat.</div><Link className="tab-button" href="/master-data#prices">← Master Data lainnya</Link></div>{error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{!configured && <span className="ml-2">Lihat <code>.env.example</code>.</span>}{!role && configured && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}{notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}{showForm && <form className="card card-pad mb-5" onSubmit={saveSupplier}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Supplier baru</h2><p className="mt-1 text-xs text-[var(--muted)]">Rekening bank tidak diminta pada tahap ini; informasi pembayaran yang sensitif akan ditambahkan dengan kontrol akses khusus.</p></div><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Kode supplier" required value={draft.code} onChange={value => setDraft(d => ({ ...d, code: value }))} placeholder="SUP001"/><Field label="Nama legal" required value={draft.legal_name} onChange={value => setDraft(d => ({ ...d, legal_name: value }))} placeholder="Nama sesuai dokumen"/><Field label="Nama tampilan" value={draft.display_name} onChange={value => setDraft(d => ({ ...d, display_name: value }))} placeholder="Opsional"/><label className="text-xs text-[var(--muted)]">Status pajak<select className="field mt-1" value={draft.tax_status} onChange={e => setDraft(d => ({ ...d, tax_status: e.target.value as SupplierDraft["tax_status"] }))}><option value="unverified">Belum diverifikasi</option><option value="pkp">PKP</option><option value="non_pkp">Non-PKP</option></select></label><Field label="NPWP (opsional)" value={draft.tax_identifier} onChange={value => setDraft(d => ({ ...d, tax_identifier: value }))} placeholder="Nomor pajak"/><Field label="Email" type="email" value={draft.email} onChange={value => setDraft(d => ({ ...d, email: value }))} placeholder="purchasing@supplier.id"/><Field label="Telepon / WhatsApp" value={draft.phone} onChange={value => setDraft(d => ({ ...d, phone: value }))} placeholder="08…"/><Field label="Termin supplier (hari)" type="number" min="0" value={draft.payment_terms_days} onChange={value => setDraft(d => ({ ...d, payment_terms_days: value }))} placeholder="0"/></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end"><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan Supplier"}</button></div></form>}<section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar supplier</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? "Memuat…" : `${filtered.length} supplier`}</p></div><input className="field sm:w-72" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari kode, nama atau kontak" aria-label="Cari supplier"/></div><div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Kode","Nama Legal","Pajak","Kontak","Termin","Status","Aksi"].map(h => <th className="py-3 pr-3" key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(row => <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.code}</td><td className="py-4 pr-3 font-medium">{row.legal_name}{row.display_name && <div className="mt-1 text-xs text-[var(--muted)]">{row.display_name}</div>}</td><td className="py-4 pr-3">{taxLabel(row.tax_status)}{row.tax_identifier && <div className="text-[10px] text-[var(--muted)]">NPWP tercatat</div>}</td><td className="py-4 pr-3">{row.email ?? "—"}<div className="mt-1 text-xs text-[var(--muted)]">{row.phone ?? "—"}</div></td><td className="py-4 pr-3">{row.payment_terms_days} hari</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td><td className="py-4 text-right">{canWrite && <button className="tab-button" onClick={() => void toggleActive(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button>}</td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{filtered.map(row => <article className="rounded-xl border border-[var(--border)] p-3" key={row.id}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.code}</p><h3 className="mt-1 text-sm font-semibold">{row.legal_name}</h3></div><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></div><div className="mt-2 text-xs text-[var(--muted)]">{taxLabel(row.tax_status)} · Termin {row.payment_terms_days} hari<br/>{row.email ?? "—"} · {row.phone ?? "—"}</div>{canWrite && <button className="tab-button mt-3" onClick={() => void toggleActive(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button>}</article>)}</div>{!loading && !error && filtered.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada supplier. Tambahkan data master atau periksa filter.</p>}</section></main>;
}
function taxLabel(status: Supplier["tax_status"]) { return status === "pkp" ? "PKP" : status === "non_pkp" ? "Non-PKP" : "Belum diverifikasi"; }
function Field({ label, value, onChange, placeholder, required, type = "text", min }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string; min?: string }) { return <label className="text-xs text-[var(--muted)]">{label}<input className="field mt-1" type={type} min={min} required={required} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/></label>; }
