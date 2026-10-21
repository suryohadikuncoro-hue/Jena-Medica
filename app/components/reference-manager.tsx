"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Mode = "customers" | "products";
type Customer = { id: string; code: string; legal_name: string; display_name: string | null; default_shipping_address: string | null; contact_name: string | null; phone: string | null; email: string | null; payment_terms_days: number; is_active: boolean };
type Product = { id: string; code: string; name: string; category: string | null; unit: string; is_active: boolean };
type Row = Customer | Product;

export function ReferenceManager({ mode }: { mode: Mode }) {
  const isCustomer = mode === "customers";
  const title = isCustomer ? "Pelanggan" : "Barang";
  const [rows, setRows] = useState<Row[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState("0");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("pcs");
  const configured = isSupabaseConfigured();
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(""); setRows([]); setError(`Masuk dengan akun bisnis untuk melihat ${title.toLowerCase()}.`); setLoading(false); return; }
      const businessRole = String(session.user.app_metadata?.business_role ?? ""); setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setRows([]); setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata."); setLoading(false); return; }
      if (isCustomer) {
        const { data, error: queryError } = await supabase.from("customers").select("id,code,legal_name,display_name,default_shipping_address,contact_name,phone,email,payment_terms_days,is_active").order("legal_name").limit(500);
        if (queryError) throw queryError;
        setRows((data ?? []) as Customer[]);
      } else {
        const { data, error: queryError } = await supabase.from("products").select("id,code,name,category,unit,is_active").order("name").limit(500);
        if (queryError) throw queryError;
        setRows((data ?? []) as Product[]);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Gagal memuat data ${title.toLowerCase()}.`); }
    finally { setLoading(false); }
  }, [configured, isCustomer, title]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  function resetFields() { setCode(""); setLegalName(""); setDisplayName(""); setAddress(""); setContact(""); setPhone(""); setEmail(""); setTerms("0"); setCategory(""); setUnit("pcs"); }

  function startEdit(row: Row) {
    setError(""); setNotice("");
    setEditingId(row.id); setShowForm(true);
    setCode(row.code);
    if (isCustomer) {
      const customer = row as Customer;
      setLegalName(customer.legal_name); setDisplayName(customer.display_name ?? ""); setAddress(customer.default_shipping_address ?? "");
      setContact(customer.contact_name ?? ""); setPhone(customer.phone ?? ""); setEmail(customer.email ?? "");
      setTerms(String(customer.payment_terms_days));
    } else {
      const product = row as Product;
      setLegalName(product.name); setCategory(product.category ?? ""); setUnit(product.unit);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk mengubah master data.");
      const supabase = getSupabaseBrowserClient();
      if (isCustomer) {
        const payload = {
          legal_name: legalName.trim(), display_name: displayName.trim() || null,
          default_shipping_address: address.trim() || null, contact_name: contact.trim() || null,
          phone: phone.trim() || null, email: email.trim() || null,
          payment_terms_days: Number(terms),
        };
        const { error: writeError } = editingId
          ? await supabase.from("customers").update(payload).eq("id", editingId)
          : await supabase.from("customers").insert({ ...payload, code: code.trim() });
        if (writeError) throw writeError;
      } else {
        const payload = { name: legalName.trim(), category: category.trim() || null, unit: unit.trim() };
        const { error: writeError } = editingId
          ? await supabase.from("products").update(payload).eq("id", editingId)
          : await supabase.from("products").insert({ ...payload, code: code.trim() });
        if (writeError) throw writeError;
      }
      resetFields(); setShowForm(false); const edited = editingId != null; setEditingId(null);
      setNotice(`${title} ${edited ? "diperbarui" : "tersimpan"} di Supabase.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Gagal menyimpan ${title.toLowerCase()}.`); }
    finally { setSaving(false); }
  }

  function cancelForm() { setShowForm(false); setEditingId(null); resetFields(); }

  async function toggle(row: Row) {
    setError(""); setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = isCustomer
        ? await supabase.from("customers").update({ is_active: !row.is_active }).eq("id", row.id)
        : await supabase.from("products").update({ is_active: !row.is_active }).eq("id", row.id);
      if (updateError) throw updateError;
      setNotice(`${rowName(row, isCustomer)} ${row.is_active ? "dinonaktifkan" : "diaktifkan"}.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memperbarui status master data."); }
  }

  const filtered = rows.filter(row => `${row.code} ${rowName(row, isCustomer)} ${isCustomer ? (row as Customer).email ?? "" : (row as Product).category ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const formTitle = editingId ? `Edit ${title.toLowerCase()}` : `Tambah ${title.toLowerCase()}`;
  return <main className="page-wrap"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Master Data · Supabase</p><h1 className="page-title">{title}</h1><p className="page-description">{isCustomer ? "Referensi pelanggan, tujuan kirim dan termin pembayaran yang disalin sebagai snapshot SO." : "Referensi barang dan satuan; aplikasi tidak mencatat stok fisik."}</p></div>{canWrite && <button className="primary-button" onClick={() => { if (showForm) cancelForm(); else { setEditingId(null); resetFields(); setShowForm(true); } setError(""); }}>{showForm ? "Tutup formulir" : `＋ Tambah ${isCustomer ? "Pelanggan" : "Barang"}`}</button>}</div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="demo-banner"><strong>Terhubung ke database.</strong> Data yang tampil berasal dari Supabase; tidak ada data contoh.</div><Link className="tab-button" href="/master-data#prices">← Master Data lainnya</Link></div>{error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}{notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {showForm && <form className="card card-pad mb-5" onSubmit={save}><h2 className="font-semibold">{formTitle}</h2><p className="mt-1 text-xs text-[var(--muted)]">{editingId ? "Kode tidak dapat diubah; data lain boleh diperbaiki." : "Kode harus unik dan tidak dapat diubah setelah tersimpan."}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label={isCustomer ? "Kode pelanggan" : "Kode barang"} value={code} setValue={setCode} required placeholder={isCustomer ? "CUS001" : "MED001"} disabled={editingId != null}/><Field label={isCustomer ? "Nama legal" : "Nama barang"} value={legalName} setValue={setLegalName} required placeholder={isCustomer ? "Nama sesuai dokumen" : "Nama produk"}/>{isCustomer ? <><Field label="Nama tampilan" value={displayName} setValue={setDisplayName} placeholder="Opsional"/><Field label="Alamat kirim default" value={address} setValue={setAddress} placeholder="Alamat lengkap"/><Field label="Nama kontak" value={contact} setValue={setContact} placeholder="Kontak penerima"/><Field label="Telepon" value={phone} setValue={setPhone} placeholder="08…"/><Field label="Email" value={email} setValue={setEmail} type="email" placeholder="opsional@pelanggan.id"/><Field label="Termin (hari)" value={terms} setValue={setTerms} type="number" min="0" placeholder="0"/></> : <><Field label="Kategori" value={category} setValue={setCategory} placeholder="Opsional"/><Field label="Satuan" value={unit} setValue={setUnit} required placeholder="pcs"/></>}</div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button className="tab-button" type="button" onClick={cancelForm}>Batal</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Menyimpan…" : editingId ? "Simpan Perubahan" : `Simpan ${isCustomer ? "Pelanggan" : "Barang"}`}</button></div></form>}
    <section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar {title.toLowerCase()}</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? "Memuat…" : `${filtered.length} data`}</p></div><input className="field sm:w-72" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Cari kode atau nama ${title.toLowerCase()}`} aria-label={`Cari ${title.toLowerCase()}`}/></div><div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{(isCustomer ? ["Kode","Nama","Alamat default","Kontak","Termin","Status","Aksi"] : ["Kode","Nama barang","Kategori","Satuan","Status","Aksi"]).map(item => <th key={item} className="py-3 pr-3">{item}</th>)}</tr></thead><tbody>{filtered.map(row => isCustomer ? <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.code}</td><td className="py-4 pr-3 font-medium">{(row as Customer).legal_name}{(row as Customer).display_name && <div className="mt-1 text-xs text-[var(--muted)]">{(row as Customer).display_name}</div>}</td><td className="max-w-64 py-4 pr-3 text-xs">{(row as Customer).default_shipping_address ?? "—"}</td><td className="py-4 pr-3 text-xs">{(row as Customer).contact_name ?? "—"}<div className="mt-1 text-[var(--muted)]">{(row as Customer).phone ?? "—"}</div></td><td className="py-4 pr-3">{(row as Customer).payment_terms_days} hari</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td><td className="py-4 text-right">{canWrite && <span className="inline-flex gap-2"><button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></span>}</td></tr> : <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.code}</td><td className="py-4 pr-3 font-medium">{(row as Product).name}</td><td className="py-4 pr-3">{(row as Product).category ?? "—"}</td><td className="py-4 pr-3">{(row as Product).unit}</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td><td className="py-4 text-right">{canWrite && <span className="inline-flex gap-2"><button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></span>}</td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{filtered.map(row => <article className="rounded-xl border border-[var(--border)] p-3" key={row.id}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.code}</p><h3 className="mt-1 text-sm font-semibold">{rowName(row, isCustomer)}</h3></div><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{isCustomer ? `${(row as Customer).default_shipping_address ?? "Alamat belum diatur"} · Termin ${(row as Customer).payment_terms_days} hari` : `${(row as Product).category ?? "Tanpa kategori"} · ${(row as Product).unit}`}</p>{canWrite && <div className="mt-3 flex gap-2"><button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></div>}</article>)}</div>{!loading && !filtered.length && !error && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada data {title.toLowerCase()}.</p>}</section>
  </main>;
}
function rowName(row: Row, isCustomer: boolean) { return isCustomer ? (row as Customer).legal_name : (row as Product).name; }
function Field({ label, value, setValue, placeholder, type = "text", required, min, disabled }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string; type?: string; required?: boolean; min?: string; disabled?: boolean }) { return <label className="text-xs text-[var(--muted)]">{label}<input className="field mt-1" type={type} min={min} required={required} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} disabled={disabled}/></label>; }
