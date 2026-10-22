# Jena Medical Center Business Suite

Aplikasi ERP web B2B untuk Jena Medical Center dengan model **drop-ship**. Supplier mengirim langsung kepada pelanggan di luar sistem; aplikasi tidak mengelola persediaan fisik.

## Sumber kebenaran dokumentasi

- `AGENTS.md` — aturan kerja dan urutan prioritas dokumen.
- `PRODUCT_SPEC.md` — keputusan produk D-01–D-11.
- `ACCOUNTING_POLICY_AND_CUTOVER.md` — kebijakan akuntansi, pajak, dan prasyarat cutover.
- `UI_UX_GUIDELINES.md` — pedoman UI/UX, diturunkan dari mockup di folder `design/`.
- `DATABASE_INTEGRATION_READINESS.md` dan `SUPABASE_INTEGRATION.md` — status schema/akses Supabase.
- `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md` — model data target dan status implementasi.
- `SECURITY_DEFINER_REVIEW.md` — review fungsi `SECURITY DEFINER` dan temuan Security Advisor.

## D-09/D-10: keputusan dan status implementasi

- **D-09:** tidak ada menu, halaman, komponen, RPC, tabel, atau record pengiriman di sistem. Objek shipment legacy dan record shipment sudah dihapus dari Production oleh migration `20261017185346` sesuai instruksi pemilik. Record pembayaran pelanggan/supplier tidak termasuk scope dan tetap dipertahankan.
- **D-10:** invoice pelanggan dibuat manual dari SO terkonfirmasi. Satu SO dapat memiliki beberapa invoice; batas kumulatif kuantitas dan nilai dijaga oleh database. Invoice tidak memiliki `shipment_id`.
- Pembayaran dan alokasi tetap tersedia di route mandiri `/pembayaran`.

Migration `20261017185346_d10_invoice_from_sales_order_drop_shipment_module.sql` (sebelumnya disiapkan dengan nama `20261017150000_...`) telah diterapkan ke Supabase Production: objek shipment dihapus, RPC invoice diganti agar menerima SO dan kuantitas per baris. Arsip `supabase/migrations/` disinkronkan 24/24 dengan history remote per 23 Oktober 2026 (D-11). Seluruh migration D-10 dan master data sudah aktif di Production.

## Snapshot Supabase terakhir yang diverifikasi (23 Oktober 2026)

Audit baca-saja mencatat **24 migration remote** dan **27 tabel publik**. Semua tabel publik memiliki RLS aktif dan policy. Objek shipment legacy sudah tidak ada. Framework akuntansi aktif: profile posting `approved` (21 Oktober 2026), mapping akun 10, periode 1, jurnal 4 entri (9 baris).

Data yang teramati: 2 customer, 1 supplier, 2 produk, 1 harga pelanggan/barang, 5 SO `confirmed` (6 baris), 3 PO (4 baris), 3 invoice pelanggan `issued` (4 baris), 1 faktur supplier, 2 customer payment, 1 supplier payment. Dua SO `confirmed` belum memiliki invoice (D-05). Pembayaran pelanggan/supplier dipertahankan.

## Fitur aplikasi setelah D-09/D-10

- `/login` dan `/set-password` — autentikasi Supabase.
- `/` — buat dan kelola SO; harga khusus diambil berdasarkan tanggal transaksi.
- `/master-data` — master pelanggan, supplier, barang, dan harga.
- `/operasional` — PO supplier dan capture draft Faktur Supplier.
- `/invoice-pelanggan` — buat invoice manual dari SO terkonfirmasi; kuantitas parsial dapat ditagih bertahap sesuai sisa SO.
- `/pembayaran` — penerimaan pelanggan, pembayaran supplier, dan alokasi.
- `/keuangan` — status dokumen dan kerangka akuntansi; bukan bukti bahwa posting sudah final tanpa UAT/rekonsiliasi.

Catatan pembayaran operasional bukan otomatis jurnal kas/bank, dan draft invoice bukan pendapatan/piutang. Posting sudah tidak dikunci secara konfigurasi (profile `approved`, mapping 10, periode 1), tetapi angka laporan tetap harus diverifikasi melalui UAT dan rekonsiliasi sebelum cutover.

## Supabase, otorisasi, dan validasi

Aplikasi memakai Supabase Auth/Postgres/RLS/RPC dan publishable key pada browser. Service-role key tidak boleh berada pada client, Git, atau log. Role bisnis dibaca dari `app_metadata.business_role` (`owner`, `admin`, `viewer`); viewer hanya baca.

Untuk perubahan aplikasi, jalankan `npm run lint`, `npm run build`, dan `npm run build:worker` pada commit yang direview, lalu tulis hasil aktualnya di PR. Untuk migration, verifikasi constraint, RLS/policy, fungsi/trigger, hitungan record, serta alur invoice SO berbasis kuantitas kumulatif. Deployment live `https://jena-medica.fa-mitra.my.id` terverifikasi pada 23 Oktober 2026, menjalankan commit `main` terkini (build Cloudflare `3a8ecc7e`, commit `ea42494`).

## Menjalankan lokal

```bash
npm ci
cp .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Buka `http://localhost:3000`. Konfigurasi Cloudflare Workers/OpenNext ada pada `wrangler.jsonc` dan `open-next.config.ts`. Jangan commit credential.
