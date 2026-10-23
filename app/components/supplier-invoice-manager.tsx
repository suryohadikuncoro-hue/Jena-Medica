"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/error-message";

const money = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
type TaxStatus = "taxed" | "non_taxed" | "unverified";
type PriceMode = "exclusive" | "inclusive" | "not_applicable" | "unknown";
type DiscountMode = "none" | "amount" | "percent";
type Supplier = { id: string; code: string; legal_name: string; tax_status: "pkp" | "non_pkp" | "unverified" };
type Product = { id: string; code: string; name: string; unit: string };
 type SupplierInvoice = {
  id: string; supplier_id: string; supplier_invoice_number: string; invoice_date: string; due_date: string | null;
  tax_status: TaxStatus; price_mode: PriceMode; tax_rate_reported: number | string | null;
  discount_mode: DiscountMode; discount_value_reported: number | string; subtotal_reported: number | string;
  discount_amount_reported: number | string; tax_amount_reported: number | string; other_charges_reported: number | string;
  invoice_total_reported: number | string; status: "draft" | "posted" | "void"; void_reason: string | null; input_tax_treatment: string; input_tax_review_reference: string | null; posted_at: string | null; created_at: string;
};
type SupplierInvoiceLine = {
  id: string; supplier_invoice_id: string; line_number: number; purchase_order_line_id: string | null;
  product_code_snapshot: string; product_name_snapshot: string; unit_snapshot: string;
  quantity: number | string; unit_price_reported: number | string; line_discount_reported: number | string; line_total_reported: number | string;
};
type InvoiceLineDraft = { product_code: string; product_name: string; unit: string; quantity: string; unit_price_reported: string; line_discount_reported: string; line_total_reported: string };
type InvoiceAttachment = { id: string; supplier_invoice_id: string; storage_path: string; original_file_name: string; content_type: string; byte_size: number };
type InvoiceDraft = {
  supplier_id: string; number: string; invoice_date: string; due_date: string; tax_status: TaxStatus;
  tax_rate: string; discount_mode: DiscountMode; discount_value: string; subtotal: string; discount_amount: string;
  tax_amount: string; other_charges: string; total: string; notes: string; lines: InvoiceLineDraft[];
};

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function blankLine(): InvoiceLineDraft { return { product_code: "", product_name: "", unit: "", quantity: "", unit_price_reported: "", line_discount_reported: "0", line_total_reported: "" }; }
function blankInvoice(invoiceDate = ""): InvoiceDraft {
  return { supplier_id: "", number: "", invoice_date: invoiceDate, due_date: "", tax_status: "unverified", tax_rate: "", discount_mode: "none", discount_value: "0", subtotal: "0", discount_amount: "0", tax_amount: "0", other_charges: "0", total: "", notes: "", lines: [blankLine()] };
}
function nonNegative(value: string, label: string, required = true) {
  if (!value.trim() && !required) return null;
  if (!value.trim()) throw new Error(`${label} wajib diisi.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} harus angka nol atau lebih.`);
  return parsed;
}

export function SupplierInvoiceManager({ embedded = false }: { embedded?: boolean } = {}) {
  const configured = isSupabaseConfigured();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
   const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<SupplierInvoiceLine[]>([]);
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [postingInvoice, setPostingInvoice] = useState<SupplierInvoice | null>(null);\n  const [postingTreatment, setPostingTreatment] = useState<"" | "recoverable" | "nonrecoverable" | "not_applicable">("");\n  const [postingReference, setPostingReference] = useState("");\n  const [postingBusy, setPostingBusy] = useState(false);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<InvoiceDraft>(blankInvoice);
  const [voiding, setVoiding] = useState<SupplierInvoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSaving, setVoidSaving] = useState(false);
  const canWrite = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (!configured) { setError("Supabase belum dikonfigurasi."); setLoading(false); return; }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRole(""); setSuppliers([]); setInvoices([]); setInvoiceLines([]); setAttachments([]);
        setError("Masuk untuk melihat faktur supplier."); setLoading(false); return;
      }
      const businessRole = String(session.user.app_metadata?.business_role ?? ""); setRole(businessRole);
      if (!["owner", "admin", "viewer"].includes(businessRole)) { setError("Akun belum memiliki role business_role pada Supabase Auth app_metadata."); setLoading(false); return; }
      const [supplierResult, invoiceResult, invoiceLineResult, productResult, attachmentResult] = await Promise.all([
        supabase.from("suppliers").select("id,code,legal_name,tax_status").order("legal_name").limit(500),
        supabase.from("supplier_invoices").select("id,supplier_id,supplier_invoice_number,invoice_date,due_date,tax_status,price_mode,tax_rate_reported,discount_mode,discount_value_reported,subtotal_reported,discount_amount_reported,tax_amount_reported,other_charges_reported,invoice_total_reported,status,void_reason,input_tax_treatment,input_tax_review_reference,posted_at,created_at").order("invoice_date", { ascending: false }).limit(500),
        supabase.from("supplier_invoice_lines").select("id,supplier_invoice_id,line_number,purchase_order_line_id,product_code_snapshot,product_name_snapshot,unit_snapshot,quantity,unit_price_reported,line_discount_reported,line_total_reported").limit(3000),
        supabase.from("products").select("id,code,name,unit").eq("is_active", true).order("name").limit(500),
        supabase.from("supplier_invoice_attachments").select("id,supplier_invoice_id,storage_path,original_file_name,content_type,byte_size").order("created_at", { ascending: false }).limit(1000),
      ]);
      for (const result of [supplierResult, invoiceResult, invoiceLineResult]) if (result.error) throw result.error;
      setSuppliers((supplierResult.data ?? []) as Supplier[]);
      setInvoices((invoiceResult.data ?? []) as SupplierInvoice[]);
      setInvoiceLines((invoiceLineResult.data ?? []) as SupplierInvoiceLine[]);
      setAttachments(attachmentResult.error ? [] : (attachmentResult.data ?? []) as InvoiceAttachment[]);
      // Product lookup is a convenience only; an unavailable catalog must not prevent manual invoice capture.
      setProducts(productResult.error ? [] : (productResult.data ?? []) as Product[]);
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal memuat faktur supplier dari Supabase.")); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);

  const supplierById = useMemo(() => new Map(suppliers.map(item => [item.id, item])), [suppliers]);
   const linesByInvoice = useMemo(() => {
    const result = new Map<string, SupplierInvoiceLine[]>();
    for (const line of invoiceLines) result.set(line.supplier_invoice_id, [...(result.get(line.supplier_invoice_id) ?? []), line]);
    return result;
  }, [invoiceLines]);
  const activeInvoices = invoices.filter(item => item.status === "draft");
  const reportedAmount = activeInvoices.reduce((sum, item) => sum + Number(item.invoice_total_reported), 0);
  const visibleInvoices = invoices.filter(item => {
    const haystack = `${item.supplier_invoice_number} ${supplierById.get(item.supplier_id)?.legal_name ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
 
  function updateDraft<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  function chooseSupplier(id: string) {
    setDraft(current => ({
      ...current,
      supplier_id: id,
      // Tax status must come from the invoice document, not inferred from supplier profile.
      tax_status: "unverified",
      tax_rate: "",
      tax_amount: "0",
    }));
  }

  function updateLine(index: number, key: keyof InvoiceLineDraft, value: string) {
    setDraft(current => ({ ...current, lines: current.lines.map((line, position) => position === index ? { ...line, [key]: value } : line) }));
  }

  function chooseProduct(index: number, product: Product) {
    setDraft(current => ({
      ...current,
      lines: current.lines.map((line, position) => position === index
        ? { ...line, product_code: product.code, product_name: product.name, unit: product.unit }
        : line),
    }));
  }

  function productSuggestions(line: InvoiceLineDraft) {
    const code = line.product_code.trim().toLowerCase();
    const name = line.product_name.trim().toLowerCase();
    const exactSelection = products.some(product =>
      product.code.toLowerCase() === code &&
      product.name.toLowerCase() === name &&
      product.unit.toLowerCase() === line.unit.trim().toLowerCase()
    );
    if (exactSelection) return [];
    const query = name || code;
    if (query.length < 2) return [];
    return products
      .filter(product => `${product.code} ${product.name}`.toLowerCase().includes(query))
      .slice(0, 6);
  }


  async function extractInvoiceFile(file: File) {
    setError(""); setNotice("");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Pilih PDF, JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10 MB.");
      return;
    }
    setUploadedFile(file);
    setUploadedFileName(file.name);
    setOcrBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Masuk kembali sebelum membaca faktur.");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/ocr/supplier-invoice", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });
      const result = await response.json() as { error?: string; extracted?: Record<string, unknown> };
      if (!response.ok || !result.extracted) throw new Error(result.error ?? "Faktur gagal dibaca.");
      const data = result.extracted;
      const asText = (value: unknown) => value === null || value === undefined ? "" : String(value);
      const asAmount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? String(value) : "";
      const supplierName = asText(data.supplier_name).trim().toLowerCase();
      const matchedSupplier = suppliers.find(item => {
        const name = item.legal_name.trim().toLowerCase();
        return supplierName && (name === supplierName || name.includes(supplierName) || supplierName.includes(name));
      });
      const rawLines = Array.isArray(data.lines) ? data.lines as Array<Record<string, unknown>> : [];
      const lines: InvoiceLineDraft[] = rawLines.map(line => ({
        product_code: asText(line.product_code),
        product_name: asText(line.product_name),
        unit: asText(line.unit),
        quantity: asAmount(line.quantity),
        unit_price_reported: asAmount(line.unit_price_reported),
        line_discount_reported: asAmount(line.line_discount_reported) || "0",
        line_total_reported: asAmount(line.line_total_reported),
      })).filter(line => line.product_name || line.quantity || line.unit_price_reported);
      setDraft(current => ({
        ...current,
        supplier_id: matchedSupplier?.id ?? current.supplier_id,
        number: asText(data.supplier_invoice_number) || current.number,
        invoice_date: asText(data.invoice_date) || current.invoice_date,
        due_date: asText(data.due_date) || current.due_date,
        tax_status: data.tax_status === "taxed" || data.tax_status === "non_taxed" ? data.tax_status : "unverified",
        tax_rate: asAmount(data.tax_rate_reported),
        subtotal: asAmount(data.subtotal_reported) || current.subtotal,
        discount_amount: asAmount(data.discount_amount_reported) || current.discount_amount,
        tax_amount: asAmount(data.tax_amount_reported) || current.tax_amount,
        other_charges: asAmount(data.other_charges_reported) || current.other_charges,
        total: asAmount(data.invoice_total_reported) || current.total,
        notes: asText(data.notes) || current.notes,
        lines: lines.length ? lines : current.lines,
      }));
      setNotice(matchedSupplier
        ? "Faktur berhasil dibaca. Periksa dan koreksi semua field serta cocokkan angka dengan dokumen asli sebelum menyimpan."
        : `Faktur dibaca, tetapi supplier "${asText(data.supplier_name) || "tidak terbaca"}" belum cocok dengan master. Pilih supplier secara manual dan periksa seluruh hasil.`);
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Faktur tidak dapat dibaca. Semua kolom tetap dapat diisi manual."));
    } finally {
      setOcrBusy(false);
    }
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk mencatat draft faktur.");
      if (!draft.supplier_id) throw new Error("Pilih supplier.");
      if (!draft.number.trim()) throw new Error("Nomor faktur supplier wajib diisi.");
      if (!draft.invoice_date) throw new Error("Tanggal faktur wajib diisi.");
      if (draft.due_date && draft.due_date < draft.invoice_date) throw new Error("Jatuh tempo tidak boleh sebelum tanggal faktur.");
      if (!draft.lines.length) throw new Error("Tambahkan minimal satu item faktur.");
      const taxAmount = nonNegative(draft.tax_amount, "PPN sesuai faktur")!;
      if (draft.tax_status === "non_taxed" && taxAmount !== 0) throw new Error("Untuk faktur non-pajak, PPN yang dicatat harus 0.");
      const reportedLines = draft.lines.map((line, index) => ({
        product_code: line.product_code.trim(),
        product_name: line.product_name.trim(),
        unit: line.unit.trim(),
        quantity: nonNegative(line.quantity, `Kuantitas item ${index + 1}`)!,
        unit_price_reported: nonNegative(line.unit_price_reported, `Harga/unit item ${index + 1}`)!,
        line_discount_reported: nonNegative(line.line_discount_reported, `Diskon item ${index + 1}`)!,
        line_total_reported: nonNegative(line.line_total_reported, `Total baris ${index + 1}`, false) ?? (Number(line.quantity) * Number(line.unit_price_reported) - Number(line.line_discount_reported || 0)),
      }));
      if (reportedLines.some(line => line.quantity <= 0 || !line.product_name || !line.unit)) throw new Error("Nama barang, satuan, dan kuantitas faktur wajib diisi.");
      const rate = draft.tax_status === "taxed" ? nonNegative(draft.tax_rate, "Tarif pajak", false) : null;
      const calculatedSubtotal = reportedLines.reduce((sum, line) => sum + line.line_total_reported, 0);
      const reportedSubtotal = nonNegative(draft.subtotal, "Subtotal tercetak")!;
      const reportedDiscount = nonNegative(draft.discount_amount, "Diskon total", false) ?? 0;
      const reportedOtherCharges = nonNegative(draft.other_charges, "Biaya tambahan", false) ?? 0;
      const reportedTotal = nonNegative(draft.total, "Total faktur tercetak")!;
      const payload = {
        p_supplier_id: draft.supplier_id,
        p_supplier_invoice_number: draft.number.trim(),
        p_invoice_date: draft.invoice_date,
        p_due_date: draft.due_date || null,
        p_tax_status: draft.tax_status,
        p_price_mode: draft.tax_status === "taxed" ? "unknown" : draft.tax_status === "non_taxed" ? "not_applicable" : "unknown",
        p_tax_rate_reported: rate,
        p_discount_mode: reportedDiscount > 0 ? "amount" : "none",
        p_discount_value_reported: reportedDiscount,
        p_subtotal_reported: reportedSubtotal,
        p_discount_amount_reported: reportedDiscount,
        p_tax_amount_reported: taxAmount,
        p_other_charges_reported: reportedOtherCharges,
        p_invoice_total_reported: reportedTotal,
        p_notes: draft.notes,
        p_lines: reportedLines,
      };
      const { data: createdInvoiceId, error: rpcError } = await getSupabaseBrowserClient().rpc("create_supplier_invoice", payload);
      if (rpcError) throw rpcError;
      let attachmentWarning = "";
      if (uploadedFile) {
        try {
          const supabase = getSupabaseBrowserClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user.id || !createdInvoiceId) throw new Error("Sesi atau ID faktur tidak tersedia untuk menyimpan lampiran.");
          const safeName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "faktur";
          const storagePath = `${session.user.id}/${createdInvoiceId}/${crypto.randomUUID()}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from("supplier-invoices").upload(storagePath, uploadedFile, { contentType: uploadedFile.type, upsert: false });
          if (uploadError) throw uploadError;
          const { error: metadataError } = await supabase.from("supplier_invoice_attachments").insert({
            supplier_invoice_id: createdInvoiceId,
            storage_path: storagePath,
            original_file_name: uploadedFile.name,
            content_type: uploadedFile.type,
            byte_size: uploadedFile.size,
          });
          if (metadataError) {
            await supabase.storage.from("supplier-invoices").remove([storagePath]);
            throw metadataError;
          }
        } catch {
          attachmentWarning = " Draft faktur tersimpan, tetapi lampiran gagal disimpan. Periksa migration/storage policy lalu unggah ulang dokumen.";
        }
      }
      setShowForm(false); setDraft(blankInvoice()); setUploadedFileName(""); setUploadedFile(null);
      setNotice(`Draft faktur supplier tersimpan. Nominal belum menjadi hutang, modal/HPP, pajak masukan, atau jurnal.${attachmentWarning}`);
      await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal menyimpan draft faktur supplier.")); }
    finally { setSaving(false); }
  }

  async function postInvoiceToAP() {
    if (!postingInvoice) return;
    setError(""); setNotice(""); setPostingBusy(true);
    try {
      if (!canWrite) throw new Error("Role Owner/Admin diperlukan untuk posting AP.");
      if (!postingTreatment) throw new Error("Pilih keputusan PPN masukan setelah memeriksa faktur.");
      if (postingReference.trim().length < 3) throw new Error("Referensi review pajak wajib diisi.");
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("post_supplier_invoice_to_ap", {
        p_supplier_invoice_id: postingInvoice.id,
        p_input_tax_treatment: postingTreatment,
        p_tax_review_reference: postingReference.trim(),
      });
      if (rpcError) throw rpcError;
      setPostingInvoice(null); setPostingReference("");
      setNotice("Faktur berhasil diposting ke hutang supplier (AP) dan jurnal. Pembayaran berikutnya dapat dicatat serta dialokasikan dari menu Pembayaran.");
      await load();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Posting AP gagal. Periksa rekonsiliasi total, status pajak, referensi review, dan konfigurasi akuntansi."));
    } finally { setPostingBusy(false); }
  }

  async function openAttachment(invoiceId: string) {
    setError(""); setNotice("");
    try {
      const attachment = attachments.find(item => item.supplier_invoice_id === invoiceId);
      if (!attachment) throw new Error("Belum ada lampiran tersimpan untuk faktur ini.");
      const { data, error: signedError } = await getSupabaseBrowserClient().storage.from("supplier-invoices").createSignedUrl(attachment.storage_path, 60);
      if (signedError || !data?.signedUrl) throw signedError ?? new Error("Tautan dokumen tidak tersedia.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (cause) { setError(friendlyErrorMessage(cause, "Lampiran tidak dapat dibuka.")); }
  }

  async function voidInvoice() {
    if (!voiding) return;
    setError(""); setNotice(""); setVoidSaving(true);
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("void_supplier_invoice", { p_supplier_invoice_id: voiding.id, p_reason: voidReason });
      if (rpcError) throw rpcError;
      setNotice(`Draft ${voiding.supplier_invoice_number} dibatalkan; catatan tetap tersimpan untuk jejak audit.`);
      setVoiding(null); setVoidReason(""); await load();
    } catch (cause) { setError(friendlyErrorMessage(cause, "Gagal membatalkan draft faktur.")); }
    finally { setVoidSaving(false); }
  }

  const Shell = embedded ? "div" : "main";
  return <Shell className={embedded ? "supplier-invoice-screen" : "page-wrap supplier-invoice-screen"}>
    {embedded ? <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">Catat faktur supplier langsung dari dokumen supplier.</p><div className="flex gap-2"><Link className="tab-button" href="/keuangan#jurnal">Posting AP →</Link>{canWrite && <button className="primary-button" type="button" onClick={() => { setShowForm(value => !value); setError(""); setNotice(""); setDraft(blankInvoice(localDate())); }}>＋ Catat Faktur</button>}</div></div> :
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="page-kicker">Transaksi · Pembelian drop-ship</p><h1 className="page-title">Faktur Supplier</h1><p className="page-description">Catat faktur supplier langsung dari dokumen supplier. Referensi PO tidak diperlukan karena pemesanan dilakukan di luar sistem. Posting AP hanya tersedia setelah konfigurasi akuntansi disetujui.</p></div>
      <div className="flex gap-2"><Link className="tab-button" href="/keuangan#jurnal">Posting AP →</Link>{canWrite && <button className="primary-button" type="button" onClick={() => { setShowForm(value => !value); setError(""); setNotice(""); setDraft(blankInvoice(localDate())); }}>＋ Catat Faktur</button>}</div>
    </div>}

    <div className="demo-banner mb-5"><strong>Faktur tersimpan di Supabase.</strong> Posting AP tersedia melalui antrean Posting & Jurnal di Keuangan setelah konfigurasi disetujui. PPN masukan memerlukan review manual; biaya masuk akun clearing dan belum direklasifikasi ke HPP.</div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}{error.includes("Masuk") && <Link className="ml-2 underline" href="/login">Masuk</Link>}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    <section className="mb-5 grid gap-3 sm:grid-cols-3">
      <Kpi label="Faktur dimuat" value={String(invoices.length)} />
      <Kpi label="Draft aktif" value={String(activeInvoices.length)} />
      <Kpi label="Total terlapor · belum posting" value={money(reportedAmount)} />
    </section>

    {showForm && <form className="card card-pad mb-5 supplier-invoice-form" onSubmit={submitInvoice}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Draft faktur dari dokumen supplier</h2><p className="mt-1 text-xs text-[var(--muted)]">Salin data sesuai faktur supplier. PO manual di luar sistem tidak perlu dimasukkan. Angka diverifikasi terhadap dokumen sumber.</p></div><button type="button" className="tab-button" onClick={() => setShowForm(false)}>Tutup</button></div>
      <div className="mt-4 rounded-xl border border-[var(--border)] p-3"><label className="block text-xs font-semibold">Unggah foto atau PDF faktur<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="field mt-2 w-full" disabled={ocrBusy || !canWrite} onChange={event => { const file = event.target.files?.[0]; if (file) void extractInvoiceFile(file); event.currentTarget.value = ""; }} /></label><p className="mt-2 text-xs text-[var(--muted)]">{ocrBusy ? "Membaca dokumen dan mengisi field…" : uploadedFileName ? `Dokumen dibaca: ${uploadedFileName}. Periksa semua hasil sebelum menyimpan.` : "PDF/JPG/PNG/WEBP, maksimal 10 MB. Dokumen dikirim ke layanan Gemini untuk dibaca dan tidak disimpan sebagai lampiran pada versi ini. Jika OCR gagal, isi kolom manual."}</p></div>\n      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Supplier<select required className="field mt-1" value={draft.supplier_id} onChange={event => chooseSupplier(event.target.value)}><option value="">Pilih supplier…</option>{suppliers.filter(item => item.tax_status !== undefined).map(item => <option key={item.id} value={item.id}>{item.code} · {item.legal_name}</option>)}</select></label>
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Nomor faktur supplier<input required className="field mt-1" maxLength={120} value={draft.number} onChange={event => updateDraft("number", event.target.value)} placeholder="Nomor persis pada faktur" /></label>
        <label className="text-xs text-[var(--muted)]">Tanggal faktur<input required className="field mt-1" type="date" value={draft.invoice_date} onChange={event => updateDraft("invoice_date", event.target.value)} /></label>
        <label className="text-xs text-[var(--muted)]">Jatuh tempo<input className="field mt-1" type="date" min={draft.invoice_date} value={draft.due_date} onChange={event => updateDraft("due_date", event.target.value)} /></label>
        <label className="text-xs text-[var(--muted)]">Status pajak<select className="field mt-1" value={draft.tax_status} onChange={event => {
          const value = event.target.value as TaxStatus;
          setDraft(current => ({ ...current, tax_status: value, tax_rate: value === "taxed" ? current.tax_rate : "", tax_amount: value === "non_taxed" ? "0" : current.tax_amount }));
        }}><option value="taxed">Berpajak</option><option value="non_taxed">Non-pajak</option><option value="unverified">Belum diverifikasi</option></select></label>
      </div>
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">Hasil OCR adalah usulan, bukan bukti kebenaran. Cocokkan angka dengan dokumen asli; nilai yang tidak terbaca harus diisi atau diperiksa manual. Sistem tidak boleh menebak tarif pajak.</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><label className="text-xs text-[var(--muted)]">Subtotal tercetak (Rp)<input className="field mt-1" type="number" min="0" step="0.01" value={draft.subtotal} onChange={event => updateDraft("subtotal", event.target.value)} /></label><label className="text-xs text-[var(--muted)]">Diskon total (Rp)<input className="field mt-1" type="number" min="0" step="0.01" value={draft.discount_amount} onChange={event => updateDraft("discount_amount", event.target.value)} /></label><label className="text-xs text-[var(--muted)]">Tarif tercetak (%)<input className="field mt-1" type="number" min="0" max="100" step="0.0001" value={draft.tax_rate} onChange={event => updateDraft("tax_rate", event.target.value)} /></label><label className="text-xs text-[var(--muted)]">PPN tercetak (Rp)<input className="field mt-1" type="number" min="0" step="0.01" value={draft.tax_amount} onChange={event => updateDraft("tax_amount", event.target.value)} /></label><label className="text-xs text-[var(--muted)]">Biaya lain (Rp)<input className="field mt-1" type="number" min="0" step="0.01" value={draft.other_charges} onChange={event => updateDraft("other_charges", event.target.value)} /></label><label className="text-xs text-[var(--muted)]">Total faktur tercetak (Rp)<input className="field mt-1" type="number" min="0" step="0.01" value={draft.total} onChange={event => updateDraft("total", event.target.value)} /></label></div>

      <div className="mt-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Item pada faktur supplier</h3><button type="button" className="tab-button" onClick={() => updateDraft("lines", [...draft.lines, blankLine()])}>＋ Tambah item</button></div>
        <p className="mt-1 text-xs text-[var(--muted)]">Catat item sesuai faktur asli. Referensi PO tidak diperlukan karena pemesanan dilakukan di luar sistem.</p>
        <div className="mt-3 space-y-3">{draft.lines.map((line, index) => <div key={index} className="rounded-xl border border-[var(--border)] p-3">
          <div className="mb-3 flex items-start justify-between gap-2"><p className="text-sm font-medium">Baris {index + 1}</p>{draft.lines.length > 1 && <button type="button" className="tab-button" onClick={() => updateDraft("lines", draft.lines.filter((_, position) => position !== index))}>Hapus baris</button>}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs text-[var(--muted)]">Kode barang (opsional)<input className="field mt-1" value={line.product_code} onChange={event => updateLine(index, "product_code", event.target.value)} /></label>
            <label className="text-xs text-[var(--muted)] sm:col-span-2">Nama barang<input required className="field mt-1" value={line.product_name} onChange={event => updateLine(index, "product_name", event.target.value)} /></label>
            <label className="text-xs text-[var(--muted)]">Satuan<input required className="field mt-1" value={line.unit} onChange={event => updateLine(index, "unit", event.target.value)} placeholder="box, pcs, strip…" /></label>
            <label className="text-xs text-[var(--muted)]">Kuantitas<input required className="field mt-1" type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={event => updateLine(index, "quantity", event.target.value)} /></label>
            <label className="text-xs text-[var(--muted)]">Harga/unit (Rp)<input required className="field mt-1" type="number" min="0" step="0.01" value={line.unit_price_reported} onChange={event => updateLine(index, "unit_price_reported", event.target.value)} /></label>
            <label className="text-xs text-[var(--muted)]">Diskon baris (Rp)<input required className="field mt-1" type="number" min="0" step="0.01" value={line.line_discount_reported} onChange={event => updateLine(index, "line_discount_reported", event.target.value)} /></label><label className="text-xs text-[var(--muted)]">Total baris tercetak (Rp)<input className="field mt-1" type="number" min="0" step="0.01" value={line.line_total_reported} onChange={event => updateLine(index, "line_total_reported", event.target.value)} /></label>
          </div>
          {productSuggestions(line).length > 0 && <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
            <p className="mb-1 text-xs text-[var(--muted)]">Pilih dari master barang untuk mengisi kode, nama, dan satuan.</p>
            <div className="flex flex-wrap gap-2">{productSuggestions(line).map(product => <button key={product.id} type="button" className="tab-button text-left" onClick={() => chooseProduct(index, product)}><span className="font-mono">{product.code}</span> · {product.name} <span className="text-[var(--muted)]">({product.unit})</span></button>)}</div>
          </div>}
        </div>)}</div>
      </div>

      <label className="mt-4 block text-xs text-[var(--muted)]">Catatan<textarea className="field mt-1 min-h-20 py-2" maxLength={2000} value={draft.notes} onChange={event => updateDraft("notes", event.target.value)} placeholder="Referensi dokumen atau catatan pemeriksaan" /></label>
      <div className="mt-3 rounded-xl border border-[var(--border)] p-3 text-xs"><p className="font-semibold">Perbandingan angka</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><p>Hitungan sistem (usulan)<strong className="mt-1 block text-sm">{money(draft.lines.reduce((sum, line) => sum + Math.max(0, (Number(line.quantity) || 0) * (Number(line.unit_price_reported) || 0) - (Number(line.line_discount_reported) || 0)), 0) - (Number(draft.discount_amount) || 0) + (Number(draft.tax_amount) || 0) + (Number(draft.other_charges) || 0))}</strong></p><p>Total tercetak<strong className="mt-1 block text-sm">{draft.total.trim() ? money(draft.total) : "Belum diisi"}</strong></p><p>Selisih (tercetak − usulan)<strong className="mt-1 block text-sm">{draft.total.trim() ? money(Number(draft.total) - (draft.lines.reduce((sum, line) => sum + Math.max(0, (Number(line.quantity) || 0) * (Number(line.unit_price_reported) || 0) - (Number(line.line_discount_reported) || 0)), 0) - (Number(draft.discount_amount) || 0) + (Number(draft.tax_amount) || 0) + (Number(draft.other_charges) || 0))) : "Belum dapat dihitung"}</strong></p></div><p className="mt-2 text-[var(--muted)]">Subtotal dan total tercetak wajib diisi dari dokumen asli. Draft boleh disimpan untuk ditinjau; posting hanya boleh dilakukan setelah validasi selisih sesuai kebijakan akuntansi.</p></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--muted)]">Tersimpan sebagai draft; belum dihitung sebagai hutang, modal/HPP, pajak masukan, atau jurnal.</p><button type="submit" className="primary-button" disabled={saving || !canWrite}>{saving ? "Menyimpan…" : "Simpan draft faktur"}</button></div>
    </form>}

    {postingInvoice && <section className="card card-pad mb-5 border border-[var(--border)]">
      <h2 className="font-semibold">Posting AP · {postingInvoice.supplier_invoice_number}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Posting mengakui hutang dan membuat jurnal. Pastikan total header sudah cocok dengan faktur asli dan keputusan pajak telah direview. Sistem akan menolak posting jika total atau konfigurasi tidak valid.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[var(--muted)]">Perlakuan PPN masukan<select className="field mt-1" required value={postingTreatment} onChange={event => setPostingTreatment(event.target.value as "" | "recoverable" | "nonrecoverable" | "not_applicable")}><option value="">Pilih setelah review…</option><option value="not_applicable">Tidak berlaku (faktur non-pajak)</option><option value="recoverable">Dapat dikreditkan</option><option value="nonrecoverable">Tidak dapat dikreditkan</option></select></label>
        <label className="text-xs text-[var(--muted)]">Referensi review / persetujuan pajak<input className="field mt-1" required minLength={3} maxLength={200} value={postingReference} onChange={event => setPostingReference(event.target.value)} placeholder="Contoh: pemeriksaan dokumen faktur tanggal …" /></label>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" className="tab-button" onClick={() => { setPostingInvoice(null); setPostingReference(""); }}>Batal</button><button type="button" className="primary-button" disabled={postingBusy || !postingTreatment || postingReference.trim().length < 3} onClick={() => void postInvoiceToAP()}>{postingBusy ? "Memposting…" : "Konfirmasi & posting AP"}</button></div>
    </section>}

    {voiding && <section className="card card-pad mb-5 border border-amber-300"><h2 className="font-semibold">Batalkan draft {voiding.supplier_invoice_number}</h2><p className="mt-1 text-sm text-[var(--muted)]">Data tidak dihapus. Nomor faktur dapat dicatat ulang setelah draft ini dibatalkan.</p><label className="mt-3 block text-xs text-[var(--muted)]">Alasan pembatalan<textarea className="field mt-1 min-h-20 py-2" value={voidReason} onChange={event => setVoidReason(event.target.value)} minLength={3} maxLength={500} required /></label><div className="mt-3 flex justify-end gap-2"><button type="button" className="tab-button" onClick={() => { setVoiding(null); setVoidReason(""); }}>Kembali</button><button type="button" className="primary-button" disabled={voidSaving || voidReason.trim().length < 3} onClick={() => void voidInvoice()}>{voidSaving ? "Membatalkan…" : "Batalkan draft"}</button></div></section>}

    <section className="card card-pad supplier-invoice-list">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Daftar faktur supplier</h2><p className="text-xs text-[var(--muted)]">Semua nominal adalah nilai yang dilaporkan supplier; draft/void belum membentuk hutang atau arus kas.</p></div><div className="flex gap-2"><input className="field sm:w-64" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nomor faktur atau supplier" aria-label="Cari faktur supplier"/><button className="tab-button" onClick={() => void load()} disabled={loading}>Muat ulang</button></div></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr className="table-head">{["Nomor faktur", "Supplier", "Tanggal / tempo", "Jumlah item", "Total dilaporkan", "Status", "Aksi"].map(item => <th key={item} className="py-3 pr-3">{item}</th>)}</tr></thead><tbody>{visibleInvoices.map(invoice => {
        const lines = linesByInvoice.get(invoice.id) ?? [];
        return <tr className="table-row" key={invoice.id}><td className="py-4 pr-3"><span className="font-mono text-xs text-[var(--accent)]">{invoice.supplier_invoice_number}</span><span className="mt-1 block text-xs text-[var(--muted)]">{invoice.tax_status === "taxed" ? "Berpajak" : invoice.tax_status === "non_taxed" ? "Non-pajak" : "Pajak belum diverifikasi"}</span></td><td className="py-4 pr-3">{supplierById.get(invoice.supplier_id)?.legal_name ?? "Supplier"}</td><td className="py-4 pr-3 text-sm">{invoice.invoice_date}<span className="block text-xs text-[var(--muted)]">Tempo: {invoice.due_date ?? "—"}</span></td><td className="py-4 pr-3 text-xs">{lines.length} item</td><td className="py-4 pr-3 text-right tabular-nums">{money(invoice.invoice_total_reported)}</td><td className="py-4 pr-3"><span className="status-pill">{invoice.status === "draft" ? "Draft · belum posting" : invoice.status === "posted" ? "AP posted" : "Void"}</span>{invoice.void_reason && <span className="mt-1 block max-w-40 text-xs text-[var(--muted)]">{invoice.void_reason}</span>}</td><td className="py-4 text-right"><div className="flex flex-wrap justify-end gap-2">{attachments.some(item => item.supplier_invoice_id === invoice.id) && <button type="button" className="tab-button" onClick={() => void openAttachment(invoice.id)}>Buka lampiran</button>}{canWrite && invoice.status === "draft" && <button type="button" className="primary-button" onClick={() => { setPostingInvoice(invoice); setPostingTreatment(invoice.tax_status === "non_taxed" ? "not_applicable" : ""); setPostingReference(""); setError(""); }}>Review &amp; posting AP</button>}{canWrite && invoice.status === "draft" && <button type="button" className="tab-button" onClick={() => { setVoiding(invoice); setVoidReason(""); setError(""); }}>Batalkan draft</button>}</div></td></tr>;
      })}</tbody></table></div>
      <div className="space-y-3 md:hidden">{visibleInvoices.map(invoice => {
        const lines = linesByInvoice.get(invoice.id) ?? [];
        return <article key={invoice.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-xs text-[var(--accent)]">{invoice.supplier_invoice_number}</p><h3 className="mt-1 text-sm font-semibold">{supplierById.get(invoice.supplier_id)?.legal_name ?? "Supplier"}</h3><p className="mt-1 text-xs text-[var(--muted)]">{invoice.invoice_date} · tempo {invoice.due_date ?? "—"}</p></div><span className="status-pill">{invoice.status === "draft" ? "Draft" : invoice.status === "posted" ? "AP posted" : "Void"}</span></div><div className="mt-3 flex items-end justify-between gap-2"><p className="text-xs text-[var(--muted)]">{lines.length} item</p><strong className="tabular-nums">{money(invoice.invoice_total_reported)}</strong></div>{attachments.some(item => item.supplier_invoice_id === invoice.id) && <button type="button" className="tab-button mt-3 w-full" onClick={() => void openAttachment(invoice.id)}>Buka lampiran dokumen asli</button>}{invoice.status === "draft" && canWrite && <button type="button" className="primary-button mt-3 w-full" onClick={() => { setPostingInvoice(invoice); setPostingTreatment(invoice.tax_status === "non_taxed" ? "not_applicable" : "recoverable"); setPostingReference(""); setError(""); }}>Review &amp; posting AP</button>}{invoice.status === "draft" && canWrite && <button type="button" className="tab-button mt-3 w-full" onClick={() => { setVoiding(invoice); setVoidReason(""); setError(""); }}>Batalkan draft</button>}{invoice.void_reason && <p className="mt-2 text-xs text-[var(--muted)]">Alasan: {invoice.void_reason}</p>}</article>;
      })}</div>
      {!loading && !visibleInvoices.length && !error && <p className="py-10 text-center text-sm text-[var(--muted)]">Belum ada faktur supplier untuk filter ini.</p>}
      {loading && <p className="py-6 text-center text-sm text-[var(--muted)]">Memuat faktur supplier dari Supabase…</p>}
    </section>
  </Shell>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <article className="card card-pad"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></article>;
}
