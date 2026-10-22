"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
type Customer = { id: string; code: string; legal_name: string };
type Product = { id: string; code: string; name: string; unit: string };
type Price = { id: string; customer_id: string; product_id: string; unit_price: number; valid_from: string; valid_until: string | null; note: string | null; created_at: string };
const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, char => `\\${char}`);
}
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const tomorrowLocal = () => { const d = new Date(Date.now() + 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value)}`;
export function CustomerPriceManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const configured = isSupabaseConfigured();
  const canWrite = role === "owner" || role === "admin";
  const customerById = useMemo(() => new Map(customers.map(item => [item.id, item])), [customers]);
  const productById = useMemo(() => new Map(products.map(item => [item.id, item])), [products]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(""); setCustomers([]); setProducts([]); setPrices([]); setError("Masuk dengan akun bisnis untuk melihat daftar harga."); setLoading(false); return; }
      const businessRole = String(session.user.app_metadata?.business_role ?? ""); setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setCustomers([]); setProducts([]); setPrices([]); setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata."); setLoading(false); return; }
      const [customerResult, productResult] = await Promise.all([
        supabase.from("customers").select("id,code,legal_name").eq("is_active", true).order("legal_name").limit(500),
        supabase.from("products").select("id,code,name,unit").eq("is_active", true).order("name").limit(500),
      ]);
      if (customerResult.error) throw customerResult.error;
      if (productResult.error) throw productResult.error;
      setCustomers((customerResult.data ?? []) as Customer[]);
      setProducts((productResult.data ?? []) as Product[]);
      const from = page * PAGE_SIZE; const to = from + PAGE_SIZE - 1;
      const term = debouncedSearch.trim();
      let priceRequest = supabase.from("customer_product_prices").select("id,customer_id,product_id,unit_price,valid_from,valid_until,note,created_at", { count: "exact" });
      if (term) {
        const escaped = escapeIlike(term);
        const matchingCustomerIds = (customerResult.data ?? []).filter((c: Customer) => `${c.code} ${c.legal_name}`.toLowerCase().includes(term.toLowerCase())).map((c: Customer) => c.id);
        const matchingProductIds = (productResult.data ?? []).filter((p: Product) => `${p.code} ${p.name}`.toLowerCase().includes(term.toLowerCase())).map((p: Product) => p.id);
        const orParts = [`note.ilike.%${escaped}%`];
        if (matchingCustomerIds.length) orParts.push(`customer_id.in.(${matchingCustomerIds.join(",")})`);
        if (matchingProductIds.length) orParts.push(`product_id.in.(${matchingProductIds.join(",")})`);
        priceRequest = priceRequest.or(orParts.join(","));
      }
      const { data: priceData, error: priceError, count } = await priceRequest.order("valid_from", { ascending: false }).range(from, to);
      if (priceError) throw priceError;
      setPrices((priceData ?? []) as Price[]); setTotal(count ?? 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat daftar harga."); }
    finally { setLoading(false); }
  }, [configured, page, debouncedSearch]);
  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search); setPage(0); }, SEARCH_DEBOUNCE_MS); return () => window.clearTimeout(timer); }, [search]);
  function startEditPrice(price: Price) {
    setError(""); setNotice("");
    setEditingPrice(price); setShowForm(true);
    setCustomerId(price.customer_id); setProductId(price.product_id);
    setUnitPrice(String(price.unit_price)); setValidFrom(price.valid_from); setNote(price.note ?? "");
  }
  function cancelForm() { setShowForm(false); setEditingPrice(null); setUnitPrice(""); setNote(""); setCustomerId(""); setProductId(""); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk menetapkan harga.");
      const supabase = getSupabaseBrowserClient();
      if (editingPrice) {
        const { error: rpcError } = await supabase.rpc("update_scheduled_customer_product_price", {
          p_price_id: editingPrice.id, p_unit_price: Number(unitPrice), p_valid_from: validFrom, p_note: note.trim() || null,
        });
        if (rpcError) throw rpcError;
        cancelForm();
        setNotice("Versi harga terjadwal diperbarui. Snapshot SO lama tidak berubah.");
      } else {
        const { error: rpcError } = await supabase.rpc("create_customer_product_price", {
          p_customer_id: customerId, p_product_id: productId, p_unit_price: Number(unitPrice), p_valid_from: validFrom, p_note: note.trim() || null,
        });
        if (rpcError) throw rpcError;
        setUnitPrice(""); setNote(""); setShowForm(false);
        setNotice("Versi harga tersimpan. Versi terbuka sebelumnya diakhiri sehari sebelum tanggal berlaku baru; snapshot SO lama tidak berubah.");
      }
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan versi harga."); }
    finally { setSaving(false); }
  }
  async function endPrice(price: Price) {
    setError(""); setNotice("");
    const label = `${customerById.get(price.customer_id)?.legal_name ?? "Pelanggan"} · ${productById.get(price.product_id)?.name ?? "Barang"}`;
    if (!window.confirm(`Akhiri versi harga ${label} per hari ini? Pesanan dan faktur yang sudah dibuat tidak berubah.`)) return;
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("end_customer_product_price", { p_price_id: price.id });
      if (rpcError) throw rpcError;
      setNotice("Versi harga diakhiri. Harga baru perlu dibuat untuk melanjutkan penjualan dengan harga khusus.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal mengakhiri versi harga."); }
  }
  async function deleteScheduled(price: Price) {
    setError(""); setNotice("");
    if (!window.confirm("Hapus versi harga terjadwal ini? Versi yang belum berlaku dan belum dipakai pesanan dapat dihapus.")) return;
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("delete_scheduled_customer_product_price", { p_price_id: price.id });
      if (rpcError) throw rpcError;
      setNotice("Versi harga terjadwal dihapus.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menghapus versi harga."); }
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const today = todayLocal();
  const statusOf = (price: Price) => price.valid_from > today ? "Terjadwal" : price.valid_until && price.valid_until < today ? "Kedaluwarsa" : "Berlaku";
  return <main className="page-wrap">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Master Data · Supabase</p><h1 className="page-title">Harga per Pelanggan</h1><p className="page-description">Riwayat harga jual efektif per kombinasi pelanggan dan barang. Perubahan tidak mengubah snapshot pada SO lama.</p></div>{canWrite && <button className="primary-button" onClick={() => { if (showForm) cancelForm(); else { setEditingPrice(null); setValidFrom(tomorrowLocal()); setShowForm(true); } setError(""); }}>{showForm ? "Tutup formulir" : "＋ Versi harga baru"}</button>}</div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="demo-banner"><strong>Harga IDR, pra-pajak.</strong> Harga efektif dipilih sebagai default pada pembuatan SO; admin dapat menggantinya dengan harga manual.</div><Link className="tab-button" href="/master-data#accounts">← Master Data lainnya</Link></div>
    <p className="mb-4 text-xs text-[var(--muted)]">Versi baru hanya boleh berlaku mulai hari ini atau tanggal mendatang dan harus setelah versi terakhir. Versi terjadwal yang belum berlaku dan belum dipakai pesanan dapat diperbaiki atau dihapus; versi yang sedang berlaku hanya dapat diakhiri, tidak diubah, agar snapshot transaksi lama tetap utuh.</p>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {showForm && <form className="card card-pad mb-5" onSubmit={save}><h2 className="font-semibold">{editingPrice ? "Koreksi versi harga terjadwal" : "Tambahkan versi harga"}</h2><p className="mt-1 text-xs text-[var(--muted)]">{editingPrice ? "Hanya versi yang belum berlaku dan belum dipakai pesanan/faktur yang dapat dikoreksi." : "Harga lama tetap menjadi riwayat; versi terjadwal dapat dikoreksi atau dihapus dari daftar."}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{editingPrice ? <div className="text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-2"><p>Pelanggan</p><p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{customerById.get(editingPrice.customer_id)?.legal_name ?? "Pelanggan"}</p><p className="mt-1">Barang</p><p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{productById.get(editingPrice.product_id)?.name ?? "Barang"}</p></div> : <><label className="text-xs text-[var(--muted)]">Pelanggan<select required className="field mt-1" value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Pilih pelanggan…</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.code} · {customer.legal_name}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Barang<select required className="field mt-1" value={productId} onChange={event => setProductId(event.target.value)}><option value="">Pilih barang…</option>{products.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name} ({product.unit})</option>)}</select></label></>}<label className="text-xs text-[var(--muted)]">Harga jual/unit (IDR)<input required className="field mt-1" type="number" min="0" step="0.01" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} placeholder="0"/></label><label className="text-xs text-[var(--muted)]">Berlaku mulai<input required className="field mt-1" type="date" min={editingPrice ? tomorrowLocal() : today} value={validFrom} onChange={event => setValidFrom(event.target.value)}/></label><label className="text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-4">Catatan opsional<input className="field mt-1" value={note} onChange={event => setNote(event.target.value)} placeholder="Contoh: revisi harga kuartal"/></label></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" className="tab-button" onClick={cancelForm}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : editingPrice ? "Simpan koreksi" : "Simpan versi harga"}</button></div></form>}
    <section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Riwayat harga</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? "Memuat…" : `${total} versi harga · halaman ${page + 1} dari ${totalPages}`}</p></div><input className="field sm:w-72" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari pelanggan atau barang" aria-label="Cari harga"/></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Pelanggan","Barang","Harga/unit","Berlaku mulai","Berlaku sampai","Status","Catatan","Aksi"].map(item => <th key={item} className="py-3 pr-3">{item}</th>)}</tr></thead><tbody>{prices.map(price => <tr key={price.id} className="table-row"><td className="py-4 pr-3">{customerById.get(price.customer_id)?.legal_name ?? "Pelanggan nonaktif"}</td><td className="py-4 pr-3">{productById.get(price.product_id)?.name ?? "Barang nonaktif"}</td><td className="py-4 pr-3 font-semibold tabular-nums">{rupiah(Number(price.unit_price))}</td><td className="py-4 pr-3">{price.valid_from}</td><td className="py-4 pr-3">{price.valid_until ?? "—"}</td><td className="py-4 pr-3"><span className="status-pill">{statusOf(price)}</span></td><td className="max-w-48 py-4 pr-3 text-xs">{price.note ?? "—"}</td><td className="py-4 text-right">{canWrite && <span className="inline-flex gap-2">{statusOf(price) === "Terjadwal" && <><button className="tab-button" onClick={() => startEditPrice(price)}>Koreksi</button><button className="tab-button" onClick={() => void deleteScheduled(price)}>Hapus</button></>}{statusOf(price) === "Berlaku" && <button className="tab-button" onClick={() => void endPrice(price)}>Akhiri</button>}</span>}</td></tr>)}</tbody></table></div>
      <div className="space-y-3 md:hidden">{prices.map(price => <article key={price.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-[var(--muted)]">{customerById.get(price.customer_id)?.legal_name ?? "Pelanggan nonaktif"}</p><h3 className="mt-1 font-semibold">{productById.get(price.product_id)?.name ?? "Barang nonaktif"}</h3></div><span className="status-pill">{statusOf(price)}</span></div><p className="mt-2 font-semibold">{rupiah(Number(price.unit_price))} / {productById.get(price.product_id)?.unit ?? "unit"}</p><p className="mt-1 text-xs text-[var(--muted)]">{price.valid_from} — {price.valid_until ?? "berlanjut"}</p>{price.note && <p className="mt-1 text-xs">{price.note}</p>}{canWrite && <div className="mt-3 flex flex-wrap gap-2">{statusOf(price) === "Terjadwal" && <><button className="tab-button" onClick={() => startEditPrice(price)}>Koreksi</button><button className="tab-button" onClick={() => void deleteScheduled(price)}>Hapus</button></>}{statusOf(price) === "Berlaku" && <button className="tab-button" onClick={() => void endPrice(price)}>Akhiri versi</button>}</div>}</article>)}</div>
      {!loading && !prices.length && !error && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada harga khusus pelanggan.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--muted)]">Halaman {page + 1} dari {totalPages} · {total} versi harga</p><div className="flex gap-2"><button type="button" className="tab-button" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))}>Sebelumnya</button><button type="button" className="tab-button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(current => current + 1)}>Berikutnya</button></div></div>
    </section>
  </main>;
}