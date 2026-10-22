"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/error-message";

type Mode = "customers" | "products";
type Customer = { id: string; code: string; legal_name: string; display_name: string | null; default_shipping_address: string | null; contact_name: string | null; phone: string | null; email: string | null; payment_terms_days: number; tax_status: "pkp" | "non_pkp" | "unverified"; is_active: boolean; updated_at: string };
type Product = { id: string; code: string; name: string; category: string | null; unit: string; is_active: boolean; updated_at: string };
type ShipAddress = { id: string; customer_id: string; label: string; address: string; contact_name: string | null; phone: string | null; is_active: boolean };
type Row = Customer | Product;
const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, char => `\\${char}`);
}

export function ReferenceManager({ mode }: { mode: Mode }) {
  const isCustomer = mode === "customers";
  const title = isCustomer ? "Pelanggan" : "Barang";
  const [rows, setRows] = useState<Row[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUpdatedAt, setEditingUpdatedAt] = useState<string | null>(null);
  const [suggestingCode, setSuggestingCode] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
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
  const [taxStatus, setTaxStatus] = useState<"pkp" | "non_pkp" | "unverified">("unverified");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [addressCustomer, setAddressCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<ShipAddress[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [addressText, setAddressText] = useState("");
  const [addressContact, setAddressContact] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const configured = isSupabaseConfigured();
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(""); setRows([]); setTotal(0); setError(`Masuk dengan akun bisnis untuk melihat ${title.toLowerCase()}.`); setLoading(false); return; }
      const businessRole = String(session.user.app_metadata?.business_role ?? ""); setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setRows([]); setTotal(0); setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata."); setLoading(false); return; }
      const from = page * PAGE_SIZE; const to = from + PAGE_SIZE - 1;
      const term = debouncedQuery.trim();
      if (isCustomer) {
        let request = supabase.from("customers").select("id,code,legal_name,display_name,default_shipping_address,contact_name,phone,email,payment_terms_days,tax_status,is_active,updated_at", { count: "exact" });
        if (term) request = request.or(`code.ilike.%${escapeIlike(term)}%,legal_name.ilike.%${escapeIlike(term)}%,display_name.ilike.%${escapeIlike(term)}%`);
        const { data, error: queryError, count } = await request.order("legal_name").range(from, to);
        if (queryError) throw queryError;
        setRows((data ?? []) as Customer[]); setTotal(count ?? 0);
      } else {
        let request = supabase.from("products").select("id,code,name,category,unit,is_active,updated_at", { count: "exact" });
        if (term) request = request.or(`code.ilike.%${escapeIlike(term)}%,name.ilike.%${escapeIlike(term)}%,category.ilike.%${escapeIlike(term)}%`);
        const { data, error: queryError, count } = await request.order("name").range(from, to);
        if (queryError) throw queryError;
        setRows((data ?? []) as Product[]); setTotal(count ?? 0);
      }
    } catch (cause) { setError(friendlyErrorMessage(cause, `Gagal memuat data ${title.toLowerCase()}.`)); }
    finally { setLoading(false); }
  }, [configured, isCustomer, title, page, debouncedQuery]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query); setPage(0); }, SEARCH_DEBOUNCE_MS); return () => window.clearTimeout(timer); }, [query]);

  function resetFields() { setCode(""); setLegalName(""); setDisplayName(""); setAddress(""); setContact(""); setPhone(""); setEmail(""); setTerms("0"); setTaxStatus("unverified"); setCategory(""); setUnit("pcs"); }

  async function suggestCode() {
    setError(""); setSuggestingCode(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc("generate_master_data_code", {
        p_table: isCustomer ? "customers" : "products",
        p_prefix: isCustomer ? "CUS" : "MED",
        p_pad: 4,
      });
      if (rpcError) throw rpcError;
      setCode(String(data));
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal mengusulkan kode.")); }
    finally { setSuggestingCode(false); }
  }

  function startEdit(row: Row) {
    setError(""); setNotice("");
    setEditingId(row.id); setEditingUpdatedAt(row.updated_at); setShowForm(true);
    setCode(row.code);
    if (isCustomer) {
      const customer = row as Customer;
      setLegalName(customer.legal_name); setDisplayName(customer.display_name ?? ""); setAddress(customer.default_shipping_address ?? "");
      setContact(customer.contact_name ?? ""); setPhone(customer.phone ?? ""); setEmail(customer.email ?? "");
      setTerms(String(customer.payment_terms_days)); setTaxStatus(customer.tax_status ?? "unverified");
    } else {
      const product = row as Product;
      setLegalName(product.name); setCategory(product.category ?? ""); setUnit(product.unit);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk mengubah master data.");
      if (!editingId && !code.trim()) throw new Error("Kode wajib diisi.");
      if (!editingId && !/^[A-Za-z0-9_-]+$/.test(code.trim())) throw new Error("Kode hanya boleh berisi huruf, angka, strip, dan garis bawah.");
      if (!legalName.trim()) throw new Error(isCustomer ? "Nama legal wajib diisi." : "Nama barang wajib diisi.");
      if (isCustomer && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Format email tidak valid.");
      if (isCustomer && (!Number.isFinite(Number(terms)) || Number(terms) < 0)) throw new Error("Termin pembayaran harus berupa angka tidak negatif.");
      const supabase = getSupabaseBrowserClient();
      if (isCustomer) {
        const payload = {
          legal_name: legalName.trim(), display_name: displayName.trim() || null,
          default_shipping_address: address.trim() || null, contact_name: contact.trim() || null,
          phone: phone.trim() || null, email: email.trim() || null,
          payment_terms_days: Number(terms), tax_status: taxStatus,
        };
        if (editingId) {
          let request = supabase.from("customers").update(payload).eq("id", editingId);
          if (editingUpdatedAt) request = request.eq("updated_at", editingUpdatedAt);
          const { data: updated, error: writeError } = await request.select("id");
          if (writeError) throw writeError;
          if (!updated || updated.length === 0) throw new Error("Data sudah diperbarui pengguna lain. Muat ulang halaman sebelum menyimpan kembali.");
        } else {
          const { error: writeError } = await supabase.from("customers").insert({ ...payload, code: code.trim() });
          if (writeError) throw writeError;
        }
      } else {
        if (!unit.trim()) throw new Error("Satuan wajib diisi.");
        const payload = { name: legalName.trim(), category: category.trim() || null, unit: unit.trim() };
        if (editingId) {
          let request = supabase.from("products").update(payload).eq("id", editingId);
          if (editingUpdatedAt) request = request.eq("updated_at", editingUpdatedAt);
          const { data: updated, error: writeError } = await request.select("id");
          if (writeError) throw writeError;
          if (!updated || updated.length === 0) throw new Error("Data sudah diperbarui pengguna lain. Muat ulang halaman sebelum menyimpan kembali.");
        } else {
          const { error: writeError } = await supabase.from("products").insert({ ...payload, code: code.trim() });
          if (writeError) throw writeError;
        }
      }
      resetFields(); setShowForm(false); const edited = editingId != null; setEditingId(null); setEditingUpdatedAt(null);
      setNotice(`${title} ${edited ? "diperbarui" : "tersimpan"} di Supabase.`); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, `Gagal menyimpan ${title.toLowerCase()}.`)); }
    finally { setSaving(false); }
  }

  function cancelForm() { setShowForm(false); setEditingId(null); setEditingUpdatedAt(null); resetFields(); }

  async function toggle(row: Row) {
    setError(""); setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = isCustomer
        ? await supabase.from("customers").update({ is_active: !row.is_active }).eq("id", row.id)
        : await supabase.from("products").update({ is_active: !row.is_active }).eq("id", row.id);
      if (updateError) throw updateError;
      setNotice(`${rowName(row, isCustomer)} ${row.is_active ? "dinonaktifkan" : "diaktifkan"}.`); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memperbarui status master data.")); }
  }

  async function openAddresses(customer: Customer) {
    setAddressCustomer(customer); setAddresses([]); setShowAddressForm(false); setEditingAddressId(null); setError(""); setNotice("");
    setAddressLoading(true);
    try {
      const { data, error: queryError } = await getSupabaseBrowserClient().from("customer_shipping_addresses").select("id,customer_id,label,address,contact_name,phone,is_active").eq("customer_id", customer.id).order("created_at");
      if (queryError) throw queryError;
      setAddresses((data ?? []) as ShipAddress[]);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memuat alamat kirim.")); }
    finally { setAddressLoading(false); }
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk mengubah alamat kirim.");
      const supabase = getSupabaseBrowserClient();
      const payload = { label: addressLabel.trim(), address: addressText.trim(), contact_name: addressContact.trim() || null, phone: addressPhone.trim() || null };
      const { error: writeError } = editingAddressId
        ? await supabase.from("customer_shipping_addresses").update(payload).eq("id", editingAddressId)
        : await supabase.from("customer_shipping_addresses").insert({ ...payload, customer_id: addressCustomer?.id });
      if (writeError) throw writeError;
      setShowAddressForm(false); setEditingAddressId(null); setAddressLabel(""); setAddressText(""); setAddressContact(""); setAddressPhone("");
      setNotice(`Alamat kirim ${editingAddressId ? "diperbarui" : "tersimpan"}.`);
      if (addressCustomer) await openAddresses(addressCustomer);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal menyimpan alamat kirim.")); }
    finally { setSaving(false); }
  }

  async function toggleAddress(target: ShipAddress) {
    setError(""); setNotice("");
    try {
      const { error: updateError } = await getSupabaseBrowserClient().from("customer_shipping_addresses").update({ is_active: !target.is_active }).eq("id", target.id);
      if (updateError) throw updateError;
      if (addressCustomer) await openAddresses(addressCustomer);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memperbarui status alamat.")); }
  }

  async function deleteAddress(target: ShipAddress) {
    setError(""); setNotice("");
    if (!window.confirm(`Hapus alamat "${target.label}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const { error: deleteError } = await getSupabaseBrowserClient().from("customer_shipping_addresses").delete().eq("id", target.id);
      if (deleteError) throw deleteError;
      setNotice("Alamat kirim dihapus.");
      if (addressCustomer) await openAddresses(addressCustomer);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal menghapus alamat kirim.")); }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const formTitle = editingId ? `Edit ${title.toLowerCase()}` : `Tambah ${title.toLowerCase()}`;
  const taxLabel = (status: string) => status === "pkp" ? "PKP" : status === "non_pkp" ? "Non-PKP" : "Belum diverifikasi";
  return <main className="page-wrap"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Master Data · Supabase</p><h1 className="page-title">{title}</h1><p className="page-description">{isCustomer ? "Referensi pelanggan, tujuan kirim dan termin pembayaran yang disalin sebagai snapshot SO." : "Referensi barang dan satuan; aplikasi tidak mencatat stok fisik."}</p></div>{canWrite && <button className="primary-button" onClick={() => { if (showForm) cancelForm(); else { setEditingId(null); setEditingUpdatedAt(null); resetFields(); setShowForm(true); } setError(""); }}>{showForm ? "Tutup formulir" : `＋ Tambah ${isCustomer ? "Pelanggan" : "Barang"}`}</button>}</div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="demo-banner"><strong>Terhubung ke database.</strong> Data yang tampil berasal dari Supabase; tidak ada data contoh.</div><Link className="tab-button" href="/master-data#prices">← Master Data lainnya</Link></div>{error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}{notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {showForm && <form className="card card-pad mb-5" onSubmit={save}><h2 className="font-semibold">{formTitle}</h2><p className="mt-1 text-xs text-[var(--muted)]">{editingId ? "Kode tidak dapat diubah; data lain boleh diperbaiki." : "Kode harus unik dan tidak dapat diubah setelah tersimpan."}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label={isCustomer ? "Kode pelanggan" : "Kode barang"} value={code} setValue={setCode} required placeholder={isCustomer ? "CUS001" : "MED001"} disabled={editingId != null}>{!editingId && <button type="button" className="tab-button mt-1" disabled={suggestingCode} onClick={() => void suggestCode()}>{suggestingCode ? "Mengusulkan…" : "Usulkan kode"}</button>}</Field><Field label={isCustomer ? "Nama legal" : "Nama barang"} value={legalName} setValue={setLegalName} required placeholder={isCustomer ? "Nama sesuai dokumen" : "Nama produk"}/>{isCustomer ? <><Field label="Nama tampilan" value={displayName} setValue={setDisplayName} placeholder="Opsional"/><label className="text-xs text-[var(--muted)]">Status pajak<select className="field mt-1" value={taxStatus} onChange={e => setTaxStatus(e.target.value as typeof taxStatus)}><option value="unverified">Belum diverifikasi</option><option value="pkp">PKP</option><option value="non_pkp">Non-PKP</option></select></label><Field label="Alamat kirim default" value={address} setValue={setAddress} placeholder="Alamat lengkap"/><Field label="Nama kontak" value={contact} setValue={setContact} placeholder="Kontak penerima"/><Field label="Telepon" value={phone} setValue={setPhone} placeholder="08…"/><Field label="Email" value={email} setValue={setEmail} type="email" placeholder="opsional@pelanggan.id"/><Field label="Termin (hari)" value={terms} setValue={setTerms} type="number" min="0" placeholder="0"/></> : <><Field label="Kategori" value={category} setValue={setCategory} placeholder="Opsional"/><Field label="Satuan" value={unit} setValue={setUnit} required placeholder="pcs"/></>}</div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button className="tab-button" type="button" onClick={cancelForm}>Batal</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Menyimpan…" : editingId ? "Simpan Perubahan" : `Simpan ${isCustomer ? "Pelanggan" : "Barang"}`}</button></div></form>}
    {addressCustomer && <section className="card card-pad mb-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Alamat kirim · {addressCustomer.legal_name}</h2><p className="mt-1 text-xs text-[var(--muted)]">Daftar alamat tujuan drop-ship untuk pelanggan ini; dipilih saat membuat pesanan.</p></div><div className="flex gap-2">{canWrite && <button className="primary-button" onClick={() => { setShowAddressForm(v => !v); setEditingAddressId(null); setAddressLabel(""); setAddressText(""); setAddressContact(""); setAddressPhone(""); }}>{showAddressForm ? "Tutup" : "＋ Tambah alamat"}</button>}<button className="tab-button" onClick={() => setAddressCustomer(null)}>Tutup panel</button></div></div>{addressLoading && <p className="mt-3 text-xs text-[var(--muted)]">Memuat…</p>}{showAddressForm && <form className="mt-4 rounded-xl border border-[var(--border)] p-4" onSubmit={saveAddress}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Label" value={addressLabel} setValue={setAddressLabel} required placeholder="Gudang utama / Kantor"/><Field label="Alamat lengkap" value={addressText} setValue={setAddressText} required placeholder="Alamat tujuan"/><Field label="Kontak" value={addressContact} setValue={setAddressContact} placeholder="Opsional"/><Field label="Telepon" value={addressPhone} setValue={setAddressPhone} placeholder="Opsional"/></div><div className="mt-3 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => { setShowAddressForm(false); setEditingAddressId(null); }}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan alamat"}</button></div></form>}<div className="mt-4 space-y-2">{addresses.map(item => <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--border)] p-3" key={item.id}><div><p className="text-sm font-semibold">{item.label}{!item.is_active && <span className="status-pill ml-2">Nonaktif</span>}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.address}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.contact_name ?? "—"} · {item.phone ?? "—"}</p></div>{canWrite && <div className="flex gap-2"><button className="tab-button" onClick={() => { setEditingAddressId(item.id); setShowAddressForm(true); setAddressLabel(item.label); setAddressText(item.address); setAddressContact(item.contact_name ?? ""); setAddressPhone(item.phone ?? ""); }}>Edit</button><button className="tab-button" onClick={() => void toggleAddress(item)}>{item.is_active ? "Nonaktifkan" : "Aktifkan"}</button><button className="tab-button" onClick={() => void deleteAddress(item)}>Hapus</button></div>}</div>)}{!addressLoading && !addresses.length && <p className="text-sm text-[var(--muted)]">Belum ada alamat tersimpan; alamat kirim default pada data pelanggan tetap dipakai.</p>}</div></section>}
    <section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar {title.toLowerCase()}</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? "Memuat…" : `${total} data · halaman ${page + 1} dari ${totalPages}`}</p></div><input className="field sm:w-72" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Cari kode atau nama ${title.toLowerCase()}`} aria-label={`Cari ${title.toLowerCase()}`}/></div><div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{(isCustomer ? ["Kode","Nama","Status pajak","Alamat default","Kontak","Termin","Status","Aksi"] : ["Kode","Nama barang","Kategori","Satuan","Status","Aksi"]).map(item => <th key={item} className="py-3 pr-3">{item}</th>)}</tr></thead><tbody>{rows.map(row => isCustomer ? <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.code}</td><td className="py-4 pr-3 font-medium">{(row as Customer).legal_name}{(row as Customer).display_name && <div className="mt-1 text-xs text-[var(--muted)]">{(row as Customer).display_name}</div>}</td><td className="py-4 pr-3 text-xs">{taxLabel((row as Customer).tax_status)}</td><td className="max-w-64 py-4 pr-3 text-xs">{(row as Customer).default_shipping_address ?? "—"}</td><td className="py-4 pr-3 text-xs">{(row as Customer).contact_name ?? "—"}<div className="mt-1 text-[var(--muted)]">{(row as Customer).phone ?? "—"}</div></td><td className="py-4 pr-3">{(row as Customer).payment_terms_days} hari</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td><td className="py-4 text-right">{canWrite && <span className="inline-flex gap-2"><button className="tab-button" onClick={() => void openAddresses(row as Customer)}>Alamat</button><button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></span>}</td></tr> : <tr className="table-row" key={row.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{row.code}</td><td className="py-4 pr-3 font-medium">{(row as Product).name}</td><td className="py-4 pr-3">{(row as Product).category ?? "—"}</td><td className="py-4 pr-3">{(row as Product).unit}</td><td className="py-4 pr-3"><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></td><td className="py-4 text-right">{canWrite && <span className="inline-flex gap-2"><button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></span>}</td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{rows.map(row => <article className="rounded-xl border border-[var(--border)] p-3" key={row.id}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{row.code}</p><h3 className="mt-1 text-sm font-semibold">{rowName(row, isCustomer)}</h3></div><span className="status-pill">{row.is_active ? "Aktif" : "Nonaktif"}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{isCustomer ? `${taxLabel((row as Customer).tax_status)} · ${(row as Customer).default_shipping_address ?? "Alamat belum diatur"} · Termin ${(row as Customer).payment_terms_days} hari` : `${(row as Product).category ?? "Tanpa kategori"} · ${(row as Product).unit}`}</p>{canWrite && <div className="mt-3 flex flex-wrap gap-2">{isCustomer && <button className="tab-button" onClick={() => void openAddresses(row as Customer)}>Alamat</button>}<button className="tab-button" onClick={() => startEdit(row)}>Edit</button><button className="tab-button" onClick={() => void toggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</button></div>}</article>)}</div>{!loading && !rows.length && !error && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada data {title.toLowerCase()}.</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--muted)]">Halaman {page + 1} dari {totalPages} · {total} {title.toLowerCase()}</p><div className="flex gap-2"><button type="button" className="tab-button" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))}>Sebelumnya</button><button type="button" className="tab-button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(current => current + 1)}>Berikutnya</button></div></div></section>
  </main>;
}
function rowName(row: Row, isCustomer: boolean) { return isCustomer ? (row as Customer).legal_name : (row as Product).name; }
function Field({ label, value, setValue, placeholder, type = "text", required, min, disabled, children }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string; type?: string; required?: boolean; min?: string; disabled?: boolean; children?: React.ReactNode }) { return <label className="text-xs text-[var(--muted)]">{label}<input className="field mt-1" type={type} min={min} required={required} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} disabled={disabled}/>{children}</label>; }
