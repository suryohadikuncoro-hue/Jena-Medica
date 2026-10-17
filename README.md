# Jena Medical Center Business Suite

Aplikasi ERP web B2B untuk Jena Medical Center dengan model **drop-ship**. Supplier mengirim langsung kepada pelanggan di luar sistem; aplikasi tidak mengelola persediaan fisik.

## Sumber kebenaran dokumentasi

- `AGENTS.md` — aturan kerja dan urutan prioritas dokumen.
- `PRODUCT_SPEC.md` — keputusan produk D-01–D-11.
- `ACCOUNTING_POLICY_AND_CUTOVER.md` — kebijakan akuntansi, pajak, dan prasyarat cutover.
- `UI_UX_GUIDELINES.md` — pedoman UI/UX, diturunkan dari mockup di folder `design/`.
- `DATABASE_INTEGRATION_READINESS.md` dan `SUPABASE_INTEGRATION.md` — snapshot schema/akses Supabase.
- `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md` — model data target dan status implementasi.

## D-09/D-10: keputusan dan perubahan teknis

- **D-09:** tidak ada menu, halaman, komponen, RPC, tabel, atau record pengiriman di sistem. Objek shipment legacy dan record shipment akan dihapus sesuai instruksi pemilik tanpa menunggu backup sebagai prasyarat. Record pembayaran pelanggan/supplier tidak termasuk scope dan tetap dipertahankan.
- **D-10:** invoice pelanggan dibuat manual dari SO terkonfirmasi. Satu SO dapat memiliki beberapa invoice; batas kumulatif kuantitas dan nilai dijaga oleh database. Invoice tidak memiliki `shipment_id`.
- Pembayaran dan alokasi tetap tersedia di route mandiri `/pembayaran`.

PR ini menambahkan migration `20261017150000_d10_invoice_from_sales_order_drop_shipment_module.sql` untuk menghapus objek shipment serta mengganti RPC invoice agar menerima SO dan kuantitas per baris. Migration ini **belum diterapkan ke Supabase Production**. Sampai migration diterapkan, schema remote tetap merupakan schema legacy dan belum cocok dengan kode baru pada branch ini. Terapkan secara terkoordinasi dengan release kode, bukan dengan menjalankan DDL terpisah.

## Snapshot Supabase terakhir yang diverifikasi

Audit baca-saja tanggal 17 Oktober 2026 mencatat **9 migration remote** dan **27 tabel publik**. Semua tabel publik memiliki RLS aktif dan policy. Framework akuntansi sudah ada di remote, tetapi belum siap membukukan transaksi: profile posting berstatus `draft`, mapping akun 0, periode 0, dan jurnal 0.

Data saat audit: 1 customer, 1 supplier, 2 produk, 1 harga pelanggan/barang, 2 SO terkonfirmasi, 1 PO berstatus `sent`, 1 shipment berstatus `shipped`, 1 customer payment dan 1 supplier payment berstatus `recorded`. Tidak ada invoice pelanggan atau faktur supplier. D-09 menetapkan shipment yang ada sebagai data uji yang akan dihapus; pembayaran pelanggan/supplier akan dipertahankan.

## Fitur aplikasi setelah D-09/D-10

- `/login` dan `/set-password` — autentikasi Supabase.
- `/` — buat dan kelola SO; harga khusus diambil berdasarkan tanggal transaksi.
- `/master-data` — master pelanggan, supplier, barang, dan harga.
- `/operasional` — PO supplier dan capture draft Faktur Supplier.
- `/invoice-pelanggan` — buat invoice manual dari SO terkonfirmasi; kuantitas parsial dapat ditagih bertahap sesuai sisa SO.
- `/pembayaran` — penerimaan pelanggan, pembayaran supplier, dan alokasi.
- `/keuangan` — status dokumen dan kerangka akuntansi; bukan bukti bahwa posting aktif.

Catatan pembayaran operasional bukan otomatis jurnal kas/bank, dan draft invoice bukan pendapatan/piutang. Posting tetap dikunci sampai profil kebijakan, mapping COA, dan periode dikonfigurasi serta disetujui.

## Supabase, otorisasi, dan validasi

Aplikasi memakai Supabase Auth/Postgres/RLS/RPC dan publishable key pada browser. Service-role key tidak boleh berada pada client, Git, atau log. Role bisnis dibaca dari `app_metadata.business_role` (`owner`, `admin`, `viewer`); viewer hanya baca.

Untuk perubahan aplikasi, jalankan `npm run lint`, `npm run build`, dan `npm run build:worker` pada commit yang direview, lalu tulis hasil aktualnya di PR. Untuk migration, verifikasi constraint, RLS/policy, fungsi/trigger, hitungan record serta alur invoice SO berbasis kuantitas kumulatif. Status build/deployment live belum diverifikasi oleh PR #31.

## Menjalankan lokal

```bash
npm ci
cp .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Buka `http://localhost:3000`. Konfigurasi Cloudflare Workers/OpenNext ada pada `wrangler.jsonc` dan `open-next.config.ts`. Jangan commit credential.
