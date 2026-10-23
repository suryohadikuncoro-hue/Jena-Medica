import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function responseJson(text: string) {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  return JSON.parse(cleaned) as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!token || !supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Sesi login tidak valid. Silakan masuk kembali." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sesi login tidak valid. Silakan masuk kembali." }, { status: 401 });
    }
    const role = authData.user.app_metadata?.business_role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Role Owner/Admin diperlukan untuk membaca faktur." }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Fitur ekstraksi belum dikonfigurasi. Tambahkan secret GEMINI_API_KEY di environment server." }, { status: 503 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Pilih foto atau PDF faktur terlebih dahulu." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Format file harus PDF, JPG, PNG, atau WEBP." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Ukuran file harus lebih dari 0 dan maksimal 10 MB." }, { status: 413 });
    }

    const prompt = `Baca faktur supplier berbahasa Indonesia/Inggris ini dan ekstrak data yang BENAR-BENAR terlihat. Kembalikan JSON saja tanpa markdown dengan struktur:
{
  "supplier_name": string|null,
  "supplier_invoice_number": string|null,
  "invoice_date": "YYYY-MM-DD"|null,
  "due_date": "YYYY-MM-DD"|null,
  "tax_status": "taxed"|"non_taxed"|"unverified",
  "tax_rate_reported": number|null,
  "subtotal_reported": number|null,
  "discount_amount_reported": number|null,
  "tax_amount_reported": number|null,
  "other_charges_reported": number|null,
  "invoice_total_reported": number|null,
  "notes": string|null,
  "lines": [{"product_code":string|null,"product_name":string|null,"unit":string|null,"quantity":number|null,"unit_price_reported":number|null,"line_discount_reported":number|null,"line_total_reported":number|null}]
}
Aturan: angka mata uang berupa angka tanpa pemisah ribuan. Jangan menghitung atau menebak nilai yang tidak tercetak; gunakan null jika tidak terbaca. Jangan menyimpulkan pajak dari tarif saja. Gunakan tax_status unverified bila status pajak tidak jelas. Pertahankan nama barang seperti tertulis. Jangan menganggap total hasil hitung sebagai total tercetak.`;

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: prompt },
          { inline_data: { mime_type: file.type, data: toBase64(fileBytes) } },
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (!geminiResponse.ok) {
      return NextResponse.json({ error: "Pembacaan faktur gagal. Coba file yang lebih jelas atau isi kolom secara manual." }, { status: 502 });
    }
    const payload = await geminiResponse.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("").trim();
    if (!text) {
      return NextResponse.json({ error: "Tidak ada hasil pembacaan. Isi kolom faktur secara manual." }, { status: 422 });
    }
    let extracted: Record<string, unknown>;
    try {
      extracted = responseJson(text);
    } catch {
      return NextResponse.json({ error: "Hasil pembacaan tidak valid. Isi kolom faktur secara manual." }, { status: 422 });
    }
    if (!Array.isArray(extracted.lines)) extracted.lines = [];
    return NextResponse.json({ extracted });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan saat membaca faktur. Anda tetap dapat mengisi form secara manual." }, { status: 500 });
  }
}
