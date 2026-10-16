"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const money = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
type Customer = { id: string; code: string; legal_name: string; default_shipping_address: string | null; contact_name: string | null; phone: string | null; payment_terms_days: number };
type Product = { id: string; code: string; name: string; unit: string };
type SalesOrder = { id: string; order_number: string; customer_id: string; order_date: string; due_date: string; status: "draft" | "confirmed" | "cancelled"; total_amount: number };
type OrderLineDraft = { product_id: string; quantity: string; unit_price: string; discount_amount: string; customer_product_price_id: string; price_overridden: boolean };
type CustomerPrice = { id: string; customer_id: string; product_id: string; unit_price: number; valid_from: string; valid_until: string | null };
const emptyLine: OrderLineDraft = { product_id: "", quantity: "1", unit_price: "", discount_amount: "0", customer_product_price_id: "", price_overridden: false };
const statusLabels: Record<SalesOrder["status"], string> = { draft: "Draft", confirmed: "Terkonfirmasi", cancelled: "Dibatalkan" };

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerPrices, setCustomerPrices] = useState<CustomerPrice[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [shipAddress, setShipAddress] = useState("");
  const [shipContact, setShipContact] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLineDraft[]>([{ ...emptyLine }]);
  const configured = isSupabaseConfigured();
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setError(""); setLoading(true);
    if (!configured) { setError("Supabase belum dikonfigurasi. Periksa environment aplikasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(""); setOrders([]); setCustomers([]); setProducts([]); setError("Masuk dengan akun bisnis untuk memuat pesanan."); setLoading(false); return; }
      const businessRole = String(session.user.app_metadata?.business_role ?? ""); setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setOrders([]); setCustomers([]); setProducts([]); setError("Akun belum memiliki role business_role (owner/admin/viewer) pada Supabase Auth app_metadata."); setLoading(false); return; }
      const [customerResult, productResult, orderResult] = await Promise.all([
        supabase.from("customers").select("id,code,legal_name,default_shipping_address,contact_name,phone,payment_terms_days").eq("is_active", true).order("legal_name").limit(500),
        supabase.from("products").select("id,code,name,unit").eq("is_active", true).order("name").limit(500),
        supabase.from("sales_orders").select("id,order_number,customer_id,order_date,due_date,status,total_amount").order("order_date", { ascending: false }).limit(200),
      ]);
      if (customerResult.error) throw customerResult.error;
      if (productResult.error) throw productResult.error;
      if (orderResult.error) throw orderResult.error;
      setCustomers((customerResult.data ?? []) as Customer[]);
      setProducts((productResult.data ?? []) as Product[]);
      setOrders((orderResult.data ?? []) as SalesOrder[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat data pesanan dari Supabase."); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  useEffect(() => {
    if (!customerId || !orderDate || !configured) return;
    let cancelled = false;
    const fetchPrices = async () => {
      try {
        const { data, error: priceError } = await getSupabaseBrowserClient().from("customer_product_prices")
          .select("id,customer_id,product_id,unit_price,valid_from,valid_until")
          .eq("customer_id", customerId).lte("valid_from", orderDate)
          .or(`valid_until.is.null,valid_until.gte.${orderDate}`).order("valid_from", { ascending: false }).limit(500);
        if (priceError) throw priceError;
        if (cancelled) return;
        const available = (data ?? []) as CustomerPrice[];
        setCustomerPrices(available);
        setLines(current => current.map(line => {
          if (!line.product_id || line.price_overridden) return line;
          const match = available.find(price => price.product_id === line.product_id);
          return { ...line, unit_price: match ? String(match.unit_price) : "", customer_product_price_id: match?.id ?? "" };
        }));
      } catch (cause) { if (!cancelled) { setCustomerPrices([]); setError(cause instanceof Error ? cause.message : "Gagal memuat harga pelanggan."); } }
    };
    void fetchPrices();
    return () => { cancelled = true; };
  }, [customerId, orderDate, configured]);

  const customerById = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const filtered = useMemo(() => orders.filter(order => (status === "all" || order.status === status) && `${order.order_number} ${customerById.get(order.customer_id)?.legal_name ?? ""} ${statusLabels[order.status]}`.toLowerCase().includes(query.toLowerCase())), [orders, status, query, customerById]);
  const orderValue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const draftCount = orders.filter(order => order.status === "draft").length;
  const confirmedCount = orders.filter(order => order.status === "confirmed").length;

  function selectCustomer(id: string) {
    setCustomerId(id);
    setCustomerPrices([]);
    setLines(current => current.map(line => ({ ...line, unit_price: "", customer_product_price_id: "", price_overridden: false })));
    const customer = customers.find(item => item.id === id);
    setShipAddress(customer?.default_shipping_address ?? "");
    setShipContact(customer?.contact_name ?? "");
    setShipPhone(customer?.phone ?? "");
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk membuat pesanan.");
      const normalizedLines = lines.filter(line => line.product_id).map(line => ({ product_id: line.product_id, quantity: Number(line.quantity), unit_price: Number(line.unit_price), discount_amount: Number(line.discount_amount || 0), customer_product_price_id: line.customer_product_price_id || null }));
      if (!customerId) throw new Error("Pilih pelanggan terlebih dahulu.");
      if (normalizedLines.length === 0) throw new Error("Tambahkan minimal satu barang.");
      if (normalizedLines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unit_price) || line.unit_price < 0 || !Number.isFinite(line.discount_amount) || line.discount_amount < 0)) throw new Error("Periksa jumlah, harga dan diskon pada setiap baris.");
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("create_sales_order", {
        p_customer_id: customerId, p_order_date: orderDate, p_ship_to_address: shipAddress,
        p_ship_to_contact: shipContact, p_ship_to_phone: shipPhone, p_notes: notes,
        p_lines: normalizedLines,
      });
      if (rpcError) throw rpcError;
      setShowForm(false); setCustomerId(""); setCustomerPrices([]); setLines([{ ...emptyLine }]); setNotes("");
      setNotice("Pesanan tersimpan sebagai draft secara atomik di Supabase."); await load();
      if (data) setQuery("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan pesanan."); }
    finally { setSaving(false); }
  }

  async function confirmOrder(order: SalesOrder) {
    setError(""); setNotice("");
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("confirm_sales_order", { p_sales_order_id: order.id });
      if (rpcError) throw rpcError;
      setNotice(`${order.order_number} telah dikonfirmasi.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal mengonfirmasi pesanan."); }
  }

  return <main className="page-wrap">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Transaksi · Drop-ship</p><h1 className="page-title">Pesanan pelanggan</h1><p className="page-description">Pesanan dan snapshot pelanggan/barang tersimpan di Supabase; pemenuhan supplier dibuat dari PO terpisah.</p></div>{canWrite && <button className="primary-button" onClick={() => { if (!showForm && !orderDate) setOrderDate(new Date().toISOString().slice(0, 10)); setShowForm(v => !v); setError(""); setNotice(""); }}>＋ Buat pesanan</button>}</div>
    <div className="demo-banner mb-5"><strong>Supabase + RLS.</strong> Halaman ini membaca dan menulis pesanan aktual. PPN dan jurnal belum dihitung; nilai pesanan adalah nilai sebelum pajak.</div>
    {error && <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 font-semibold underline" href="/login">Masuk</Link>}</div>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {showForm && <form className="card card-pad mb-5" onSubmit={submitOrder}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Pesanan pelanggan baru</h2><p className="mt-1 text-xs text-[var(--muted)]">Nomor SO, termin dan snapshot barang dibuat oleh transaksi database atomik.</p></div><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-[var(--muted)]">Pelanggan<select required className="field mt-1" value={customerId} onChange={e => selectCustomer(e.target.value)}><option value="">Pilih pelanggan…</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.code} · {customer.legal_name}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Tanggal pesanan<input required type="date" className="field mt-1" value={orderDate} onChange={e => { const nextDate = e.target.value; setOrderDate(nextDate); setCustomerPrices([]); setLines(current => current.map(line => line.price_overridden ? line : { ...line, unit_price: "", customer_product_price_id: "" })); }}/></label><label className="text-xs text-[var(--muted)] lg:col-span-2">Alamat kirim langsung<input required className="field mt-1" value={shipAddress} onChange={e => setShipAddress(e.target.value)} placeholder="Alamat tujuan supplier"/></label><label className="text-xs text-[var(--muted)]">Kontak penerima<input className="field mt-1" value={shipContact} onChange={e => setShipContact(e.target.value)} placeholder="Nama penerima"/></label><label className="text-xs text-[var(--muted)]">Telepon penerima<input className="field mt-1" value={shipPhone} onChange={e => setShipPhone(e.target.value)} placeholder="Nomor telepon"/></label><label className="text-xs text-[var(--muted)] sm:col-span-2">Catatan<textarea className="field mt-1 min-h-20 py-2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instruksi pesanan"/></label></div>
      <div className="mt-4 rounded-xl bg-[var(--surface-muted)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Item pesanan</h3><button type="button" className="tab-button" onClick={() => setLines(existing => [...existing, { ...emptyLine }])}>＋ Tambah baris</button></div><div className="mt-3 space-y-3">{lines.map((line, index) => <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"><select required className="field" aria-label={`Barang baris ${index + 1}`} value={line.product_id} onChange={e => { const productId = e.target.value; const matchedPrice = customerPrices.find(price => price.product_id === productId); setLines(existing => existing.map((item, i) => i === index ? { ...item, product_id: productId, unit_price: matchedPrice ? String(matchedPrice.unit_price) : "", customer_product_price_id: matchedPrice?.id ?? "", price_overridden: false } : item)); }}><option value="">Pilih barang…</option>{products.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name} ({product.unit})</option>)}</select><input required className="field" type="number" min="0.0001" step="0.0001" value={line.quantity} aria-label="Jumlah" onChange={e => setLines(existing => existing.map((item, i) => i === index ? { ...item, quantity: e.target.value } : item))}/><input required className="field" type="number" min="0" step="0.01" value={line.unit_price} placeholder="Harga/unit" aria-label="Harga jual per unit" onChange={e => setLines(existing => existing.map((item, i) => i === index ? { ...item, unit_price: e.target.value, customer_product_price_id: "", price_overridden: true } : item))}/><input className="field" type="number" min="0" step="0.01" value={line.discount_amount} placeholder="Diskon" aria-label="Diskon baris" onChange={e => setLines(existing => existing.map((item, i) => i === index ? { ...item, discount_amount: e.target.value } : item))}/><button type="button" className="tab-button" aria-label="Hapus baris" disabled={lines.length === 1} onClick={() => setLines(existing => existing.filter((_, i) => i !== index))}>×</button></div>)}</div><p className="mt-3 text-xs text-[var(--muted)]">Harga khusus yang berlaku pada tanggal SO terisi otomatis. Mengubah harga menandainya sebagai override manual; harga dan sumber disimpan sebagai snapshot. Pajak belum dihitung.</p></div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan draft"}</button></div>
    </form>}
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Pesanan dimuat" value={String(orders.length)} detail="Maksimum 200 terbaru"/><Kpi label="Draft" value={String(draftCount)} detail="Belum dikonfirmasi"/><Kpi label="Terkonfirmasi" value={String(confirmedCount)} detail="Siap dibuatkan PO supplier"/><Kpi label="Nilai pesanan" value={money(orderValue)} detail="Pra-pajak · hasil query"/></section>
    <section className="card card-pad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar pesanan</h2><p className="mt-1 text-xs text-[var(--muted)]">Alamat kirim disimpan sebagai snapshot; satu SO dapat dipenuhi oleh beberapa PO supplier.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><input className="field sm:w-64" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor atau pelanggan" aria-label="Cari pesanan"/><select className="field sm:w-48" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter status"><option value="all">Semua status</option><option value="draft">Draft</option><option value="confirmed">Terkonfirmasi</option><option value="cancelled">Dibatalkan</option></select><button className="tab-button" onClick={() => void load()} disabled={loading}>Muat ulang</button></div></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head"><th className="py-3 pr-3">Nomor SO</th><th className="py-3 pr-3">Pelanggan</th><th className="py-3 pr-3">Tanggal</th><th className="py-3 pr-3">Jatuh tempo</th><th className="py-3 pr-3 text-right">Nilai pra-pajak</th><th className="py-3 pr-3 text-right">Status</th><th className="py-3 text-right">Aksi</th></tr></thead><tbody>{filtered.map(order => <tr className="table-row" key={order.id}><td className="py-4 pr-3 font-mono text-xs text-[var(--accent)]">{order.order_number}</td><td className="py-4 pr-3 font-medium">{customerById.get(order.customer_id)?.legal_name ?? "Pelanggan nonaktif/tidak ditemukan"}</td><td className="py-4 pr-3">{order.order_date}</td><td className="py-4 pr-3">{order.due_date}</td><td className="py-4 pr-3 text-right font-semibold tabular-nums">{money(Number(order.total_amount))}</td><td className="py-4 pr-3 text-right"><span className="status-pill">{statusLabels[order.status]}</span></td><td className="py-4 text-right">{canWrite && order.status === "draft" && <button className="tab-button" onClick={() => void confirmOrder(order)}>Konfirmasi</button>}</td></tr>)}</tbody></table></div>
      <div className="space-y-3 md:hidden">{filtered.map(order => <article className="rounded-xl border border-[var(--border)] p-3" key={order.id}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-[var(--accent)]">{order.order_number}</p><h3 className="mt-1 text-sm font-semibold">{customerById.get(order.customer_id)?.legal_name ?? "Pelanggan tidak ditemukan"}</h3></div><span className="status-pill">{statusLabels[order.status]}</span></div><div className="mt-3 flex justify-between text-xs text-[var(--muted)]"><span>{order.order_date} · Jatuh tempo {order.due_date}</span><strong className="text-[var(--foreground)]">{money(Number(order.total_amount))}</strong></div>{canWrite && order.status === "draft" && <button className="tab-button mt-3" onClick={() => void confirmOrder(order)}>Konfirmasi pesanan</button>}</article>)}</div>
      {loading && <p className="py-8 text-center text-sm text-[var(--muted)]">Memuat data Supabase…</p>}{!loading && !filtered.length && !error && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada pesanan untuk filter ini.</p>}
    </section>
  </main>;
}
function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-[var(--muted-soft)]">{detail}</p></article>; }
