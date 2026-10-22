"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/error-message";

type Supplier = { id: string; code: string; legal_name: string; display_name: string | null; tax_status: "pkp" | "non_pkp" | "unverified"; tax_identifier: string | null; email: string | null; phone: string | null; payment_terms_days: number; is_active: boolean };
type SupplierDraft = { code: string; legal_name: string; display_name: string; tax_status: Supplier["tax_status"]; tax_identifier: string; email: string; phone: string; payment_terms_days: string };
type BankAccount = { id: string; supplier_id: string; bank_name: string; account_number: string; account_name: string; note: string | null; is_active: boolean };
const emptyDraft: SupplierDraft = { code: "", legal_name: "", display_name: "", tax_status: "unverified", tax_identifier: "", email: "", phone: "", payment_terms_days: "0" };
const columns = "id,code,legal_name,display_name,tax_status,tax_identifier,email,phone,payment_terms_days,is_active";
const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, char => `\\${char}`);
}

function suggestSupplierCode(rows: Supplier[]) {
  const numbers = rows.map(row => { const match = /^SUP(\d+)$/i.exec(row.code); return match ? Number(match[1]) : 0; });
  return `SUP${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, "0")}`;
}

export function SupplierManager() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bankSupplier, setBankSupplier] = useState<Supplier | null>(null);
  const [bankRows, setBankRows] = useState<BankAccount[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankNote, setBankNote] = useState("");
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
      const from = page * PAGE_SIZE; const to = from + PAGE_SIZE - 1;
      const term = debouncedQuery.trim();
      let request = supabase.from("suppliers").select(columns, { count: "exact" });
      if (term) request = request.or(`code.ilike.%${escapeIlike(term)}%,legal_name.ilike.%${escapeIlike(term)}%,display_name.ilike.%${escapeIlike(term)}%,email.ilike.%${escapeIlike(term)}%,phone.ilike.%${escapeIlike(term)}%`);
      const { data, error: queryError, count } = await request.order("legal_name", { ascending: true }).range(from, to);
      if (queryError) throw queryError;
      setRows((data ?? []) as Supplier[]); setTotal(count ?? 0);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memuat supplier dari Supabase.")); }
    finally { setLoading(false); }
  }, [configured, page, debouncedQuery]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query); setPage(0); }, SEARCH_DEBOUNCE_MS); return () => window.clearTimeout(timer); }, [query]);

  function startEdit(supplier: Supplier) {
    setError(""); setNotice("");
    setEditingId(supplier.id); setShowForm(true);
    setDraft({
      code: supplier.code, legal_name: supplier.legal_name, display_name: supplier.display_name ?? "",
      tax_status: supplier.tax_status, tax_identifier: supplier.tax_identifier ?? "",
      email: supplier.email ?? "", phone: supplier.phone ?? "", payment_terms_days: String(supplier.payment_terms_days),
    });
  }

  function cancelForm() { setShowForm(false); setEditingId(null); setDraft(emptyDraft); }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk mengubah Supplier.");
      if (!editingId && !draft.code.trim()) throw new Error("Kode supplier wajib diisi.");
      if (!editingId && !/^[A-Za-z0-9_-]+$/.test(draft.code.trim())) throw new Error("Kode hanya boleh berisi huruf, angka, strip, dan garis bawah.");
      if (!draft.legal_name.trim()) throw new Error("Nama legal supplier wajib diisi.");
      if (draft.email.trim() && !/^\S+@\S+\.\S+$/.test(draft.email.trim())) throw new Error("Format email tidak valid.");
      if (!Number.isFinite(Number(draft.payment_terms_days)) || Number(draft.payment_terms_days) < 0) throw new Error("Termin pembayaran harus berupa angka tidak negatif.");
      const supabase = getSupabaseBrowserClient();
      const payload = {
        legal_name: draft.legal_name.trim(), display_name: draft.display_name.trim() || null,
        tax_status: draft.tax_status, tax_identifier: draft.tax_identifier.trim() || null,
        email: draft.email.trim() || null, phone: draft.phone.trim() || null,
        payment_terms_days: Number(draft.payment_terms_days),
      };
      const { error: writeError } = editingId
        ? await supabase.from("suppliers").update(payload).eq("id", editingId)
        : await supabase.from("suppliers").insert({ ...payload, code: draft.code.trim() });
      if (writeError) throw writeError;
      const edited = editingId != null;
      cancelForm();
      setNotice(`Supplier ${edited ? "diperbarui" : "tersimpan"} di Supabase.`); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal menyimpan supplier.")); }
    finally { setSaving(false); }
  }

  async function toggleActive(supplier: Supplier) {
    setError(""); setNotice("");
    try {
      const { error: updateError } = await getSupabaseBrowserClient().from("suppliers").update({ is_active: !supplier.is_active }).eq("id", supplier.id);
      if (updateError) throw updateError;
      setNotice(`${supplier.legal_name} ${supplier.is_active ? "dinonaktifkan" : "diaktifkan"}.`); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memperbarui status supplier.")); }
  }

  async function openBankAccounts(supplier: Supplier) {
    setBankSupplier(supplier); setBankRows([]); setShowBankForm(false); setEditingBankId(null); setError(""); setNotice("");
    setBankLoading(true);
    try {
      const { data, error: queryError } = await getSupabaseBrowserClient().from("supplier_bank_accounts").select("id,supplier_id,bank_name,account_number,account_name,note,is_active").eq("supplier_id", supplier.id).order("created_at");
      if (queryError) throw queryError;
      setBankRows((data ?? []) as BankAccount[]);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memuat rekening supplier.")); }
    finally { setBankLoading(false); }
  }

  async function saveBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk menyimpan rekening supplier.");
      if (!bankName.trim() || !bankNumber.trim() || !bankHolder.trim()) throw new Error("Nama bank, nomor rekening, dan nama pemilik wajib diisi.");
      if (!/^[0-9-]+$/.test(bankNumber.trim())) throw new Error("Nomor rekening hanya boleh berisi angka dan strip.");
      const supabase = getSupabaseBrowserClient();
      const payload = { bank_name: bankName.trim(), account_number: bankNumber.trim(), account_name: bankHolder.trim(), note: bankNote.trim() || null };
      const { error: writeError } = editingBankId
        ? await supabase.from("supplier_bank_accounts").update(payload).eq("id", editingBankId)
        : await supabase.from("supplier_bank_accounts").insert({ ...payload, supplier_id: bankSupplier?.id });
      if (writeError) throw writeError;
      setShowBankForm(false); setEditingBankId(null); setBankName(""); setBankNumber(""); setBankHolder(""); setBankNote("");
      setNotice(`Rekening ${editingBankId ? "diperbarui" : "tersimpan"}.`);
      if (bankSupplier) await openBankAccounts(bankSupplier);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal menyimpan rekening supplier.")); }
    finally { setSaving(false); }
  }

  async function toggleBankAccount(target: BankAccount) {
    setError(""); setNotice("");
    try {
      const { error: updateError } = await getSupabaseBrowserClient().from("supplier_bank_accounts").update({ is_active: !target.is_active }).eq("id", target.id);
      if (updateError) throw updateError;
      if (bankSupplier) await openBankAccounts(bankSupplier);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memperbarui status rekening.")); }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const formTitle = editingId ? "Edit supplier" : "Supplier baru";
  return <main className="page-wrap"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Master Data · Supabase</p><h1 className="page-title">Supplier</h1><p className="page-description">Supplier mengirim langsung ke alamat pelanggan melalui PO drop-ship.</p></div>{canWrite && <button className="primary-button" onClick={() => { if (showForm) cancelForm(); else { setEditingId(null); setDraft(emptyDraft); setShowForm(true); } setError(""); }}>{showForm ? "Tutup formulir" : "＋ Tambah Supplier"}</button>}</div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="demo-banner"><strong>Terhubung ke database.</strong> Akses dilindungi Supabase Auth dan RLS; tidak ada data contoh yang dimuat.</div><Link className="tab-button" href="/master-data#prices">← Master Data lainnya</Link></div>{error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{!configured && <span className="ml-2">Lihat <code>.env.example</code>.</span>}{!role && configured && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}{notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}{showForm && <form className="card card-pad mb-5" onSubmit={saveSupplier}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{formTitle}</h2><p className="mt-1 text-xs text-[var(--muted)]">{editingId ? "Kode tidak dapat diubah; data lain boleh diperbaiki." : "Rekening bank diisi terpisah di panel Rekening, hanya terlihat oleh owner/admin."}</p></div><button type="button" className="tab-button" onClick={cancelForm}>Tutup</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-[var(--muted)]">Kode supplier<input required className="field mt-1" value={draft.code} onChange={event => setDraft(d => ({ ...d, code: event.target.value }))} placeholder="SUP001" disabled={editingId != null}/>{editingId == null && <button type="button" className="tab-button mt-1" onClick={() => setDraft(d => ({ ...d, code: suggestSupplierCode(rows) }))}>Usulkan kode</button>}</label><Field label="Nama legal" required value={draft.legal_name} onChange={value => setDraft(d => ({ ...d, legal_name: value }))} placeholder="Nama sesuai dokumen"/><Field label="Nama tampilan" value={draft.display_name} onChange={value => setDraft(d => ({ ...d, display_name: value }))} placeholder="Opsional"/><label className="text-xs text-[var(--muted)]">Status pajak<select className="field mt-1" value={draft.tax_status} onChange={e => setDraft(d => ({ ...d, tax_status: e.target.value as SupplierDraft["tax_status"] }))}><option value="unverified">Belum diverifikasi</option><option value="pkp">PKP</option><option value="non_pkp">Non-PKP</option></select></label><Field label="NPWP (opsional)" value={draft.tax_identifier} onChange={value => setDraft(d => ({ ...d, tax_identifier: value }))} placeholder="Nomor pajak"/><Field label="Email" type="email" value={draft.email} onChange={value => setDraft(d => ({ ...d, email: value }))} placeholder="purchasing@supplier.id"/><Field label="Telepon / WhatsApp" value={draft.phone} onChange={value => setDraft(d => ({ ...d, phone: value }))} placeholder="08…"/><Field label="Termin supplier (hari)" type="number" min="0" value={draft.payment_terms_days} onChange={value => setDraft(d => ({ ...d, payment_terms_days: value }))} placeholder="0"/></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button className="tab-button" type="button" onClick={cancelForm}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : editingId ? "Simpan Perubahan" : "Simpan Supplier"}</button></div></form>}{bankSupplier && <section className="card card-pad mb-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Rekening · {bankSupplier.legal_name}</h2><p className="mt-1 text-xs text-[var(--muted)]">Data pembayaran sensitif: hanya terlihat dan dapat diubah oleh owner/admin, tidak tampil untuk role viewer.</p></div><div className="flex gap-2">{canWrite && <button className="primary-button" onClick={() => { setShowBankForm(v => !v); setEditingBankId(null); setBankName(""); setBankNumber(""); setBankHolder(""); setBankNote(""); }}>{showBankForm ? "Tutup" : "＋ Tambah rekening"}</button>}<button className="tab-button" onClick={() => setBankSupplier(null)}>Tutup panel</button></div></div>{bankLoading && <p className="mt-3 text-xs text-[var(--muted)]">Memuat…</p>}{showBankForm && <form className="mt-4 rounded-xl border border-[var(--border)] p-4" onSubmit={saveBankAccount}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Nama bank" required value={bankName} onChange={setBankName} placeholder="Bank Central Asia"/><Field label="Nomor rekening" required value={bankNumber} onChange={setBankNumber} placeholder="1234567890"/><Field label="Nama pemilik rekening" required value={bankHolder} onChange={setBankHolder} placeholder="Sesuai buku tabungan"/><Field label="Catatan" value={bankNote} onChange={setBankNote} placeholder="Opsional"/></div><div className="mt-3 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => { setShowBankForm(false); setEditingBankId(null); }}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan rekening"}</button></div></form>}<div className="mt-4 space-y-2">{bankRows.map(item => <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--border)] p-3" key={item.id}><div><p className="text-sm font-semibold">{item.bank_name}{!item.is_active && <span className="status-pill ml-2">Nonaktif</span>}</p><p className="mt-1 font-mono text-xs">{item.account_number}</p><p className="mt-1 text-xs text-[var(--muted)]">a.n. {item.account_name}{item.note ? ` · ${item.note}` : ""}</p></div>{canWrite && <div className="flex gap-2"><button className="tab-button" onClick={() => { setEditingBankId(item.id); setShowBankForm(true); setBankName(item.bank_name); setBankNumber(item.account_number); setBankHolder(item.account_name); setBankNote(item.note ?? ""); }}>Edit</button><button className="tab-button" onClick={() => void toggleBankAccount(item)}>{item.is_active ? "Nonaktifkan" : "Aktifkan"}</button></div>}</div>)}{!bankLoading && !bankRows.length && <p className="text-sm text-[var(--muted)]">Belum ada rekening tercatat untuk supplier ini.</p>}</div></section>}<section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar supplier</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? "Memuat…" : `${total} supplier · halaman ${page + 1} dari ${totalPages}`}</p></div><input className="field sm:w-72" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari kode, nama atau kontak" aria-label="Cari supplier"/></div><div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Kode","Nama Legal","Pajak","Kontak","Termin","Status","Aksi"].map(h => <th className="py-3 pr-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.code}</td><td className="py-4 pr-3 font-medium">{row.legal_name}{row.display_name && <div className="mt-1 text-xs text-[var(--muted)]">{row.display_name}</div>}</td><td className="py-4 pr-3">{taxLabel(row.tax_status)}{row.tax_identifier && <div className="text-[10px] text-[var(--muted)]">NPWP tercatat</div>}</td><td className="py-4 pr-3">{row.email ?? "—"}<div className="mt-1 text-xs text-[var(--muted)]">{row.phone ?? "—"}</div></td><td className="py-4 pr-3">{row.payment_terms_days} hari</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td><td className="py-4 text-right">{canWrite && <span className="inline-flex gap-2"><button className="tab-button" onClick={() => void openBankAccounts(row)}>Rekening</button><button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggleActive(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></span>}</td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{rows.map(row => <article className="rounded-xl border border-[var(--border)] p-3" key={row.id}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.code}</p><h3 className="mt-1 text-sm font-semibold">{row.legal_name}</h3></div><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></div><div className="mt-2 text-xs text-[var(--muted)]">{taxLabel(row.tax_status)} · Termin {row.payment_terms_days} hari<br/>{row.email ?? "—"} · {row.phone ?? "—"}</div>{canWrite && <div className="mt-3 flex flex-wrap gap-2"><button className="tab-button" onClick={() => void openBankAccounts(row)}>Rekening</button><button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggleActive(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></div>}</article>)}</div>{!loading && !error && rows.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada supplier. Tambahkan data master atau periksa filter.</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--muted)]">Halaman {page + 1} dari {totalPages} · {total} supplier</p><div className="flex gap-2"><button type="button" className="tab-button" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))}>Sebelumnya</button><button type="button" className="tab-button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(current => current + 1)}>Berikutnya</button></div></div></section></main>;
}
function taxLabel(status: Supplier["tax_status"]) { return status === "pkp" ? "PKP" : status === "non_pkp" ? "Non-PKP" : "Belum diverifikasi"; }
function Field({ label, value, onChange, placeholder, required, type = "text", min, disabled }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string; min?: string; disabled?: boolean }) { return <label className="text-xs text-[var(--muted)]">{label}<input className="field mt-1" type={type} min={min} required={required} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}/></label>; }