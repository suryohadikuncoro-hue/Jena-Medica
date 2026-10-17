# Jena Medical Center Business Suite

ERP web B2B untuk bisnis distribusi barang medis dengan model **drop-ship**. Sistem tidak mengelola persediaan fisik atau saldo stok. Aplikasi memakai Next.js, Supabase Auth/Postgres/RLS/RPC, dan target runtime Cloudflare Workers melalui OpenNext.

## Sumber kebenaran dokumen

- `AGENTS.md` — aturan kerja agent dan urutan dokumen.
- `PRODUCT_SPEC.md` — keputusan produk D-01 sampai D-11.
- `ACCOUNTING_POLICY_AND_CUTOVER.md` — kebijakan akuntansi, pajak, dan prasyarat cutover.
- `UI_UX_GUIDELINES.md` — pedoman UI/UX.
- `DATABASE_INTEGRATION_READINESS.md` dan `SUPABASE_INTEGRATION.md` — kondisi database remote dan batas verifikasi.
- `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md` — model target dan riwayat pengembangan.
- `catatan-keputusan-D09-D10.md` — catatan keputusan dan status implementasi D-09/D-10/D-11.

Jika ada konflik, keputusan di `PRODUCT_SPEC.md` dan kebijakan akuntansi berlaku sesuai urutan pada `AGENTS.md`. Bedakan selalu keputusan yang disetujui dari fitur yang benar-benar terimplementasi.

## Status terkini

Audit baca-saja pada 17 Oktober 2026 mengonfirmasi **9 migration remote** dan **27 tabel publik**; seluruh tabel publik memiliki RLS aktif dan policy. Framework akuntansi sudah ada di database, tetapi posting tetap terkunci: `accounting_posting_profile` berstatus `draft`, mapping akun = 0, periode = 0, dan jurnal = 0.

Data remote yang teramati: 1 customer, 1 supplier, 2 produk, 2 SO berstatus `confirmed`, 1 PO berstatus `sent`, 1 shipment berstatus `shipped`, 1 customer payment dan 1 supplier payment berstatus `recorded`, 10 akun COA, serta belum ada invoice pelanggan/faktur supplier/jurnal. Makna setiap record belum boleh diasumsikan sebagai data uji; klasifikasikan sebelum pembersihan.

## Fitur aplikasi saat ini

- `/login` dan `/set-password` — autentikasi Supabase.
- `/` — pesanan pelanggan dan snapshot harga.
- `/master-data` — master pelanggan, supplier, barang, dan harga.
- `/operasional` — order supplier dan capture draft Faktur Supplier.
- `/pengiriman-piutang` — implementasi lama yang masih menggabungkan shipment dan pembayaran; akan disesuaikan dengan D-09.
- `/invoice-pelanggan` — implementasi invoice lama masih terkait shipment/delivered; akan diubah sesuai D-10.
- `/keuangan` — status operasional/kerangka akuntansi dengan approval gate; bukan bukti bahwa pembukuan sudah aktif.

Nama route di atas menggambarkan implementasi yang ditemukan saat dokumen ini diperbarui, bukan jaminan bahwa setiap alur siap produksi atau sudah diverifikasi pada domain live.

## Target proses yang telah diputuskan

Pesanan Pelanggan → PO Supplier (dapat split) → Faktur Supplier → Invoice pelanggan manual dari SO terkonfirmasi → Pembayaran/alokasi → Jurnal → Laporan/Dashboard.

- D-09: tidak ada fitur pencatatan pengiriman; modul, tabel, RPC, dan trigger shipment lama ditargetkan dihapus.
- D-10: invoice manual dari SO terkonfirmasi, dapat parsial, kumulatif kuantitas/nilai dibatasi SO di database, dan tanpa `shipment_id`.
- D-11: Supabase adalah sumber kebenaran schema. Arsip migration di repository harus memakai version ID yang sama dengan history remote dan konten migration yang telah diterapkan tidak diedit.

D-09 dan D-10 telah diputuskan tetapi **implementasi teknis belum selesai**. Sebelum perubahan schema, klasifikasikan data terdampak dan cadangkan database. PR dokumentasi tidak menerapkan migration atau mengubah database.

## Keamanan dan batas cutover

RLS aktif pada semua tabel publik dan semua tabel memiliki policy pada audit terakhir. Advisor masih melaporkan beberapa temuan untuk ditinjau: fungsi `SECURITY DEFINER` yang dapat dipanggil role authenticated (role check telah diperiksa pada audit), perlindungan password bocor Supabase Auth yang nonaktif, 20 foreign key tanpa indeks, dan 46 indeks yang ditandai unused. Jangan mengubah atau menghapus semuanya otomatis.

Belum dapat dianggap siap untuk cutover: UAT role-based lengkap, klasifikasi data uji, backup dan uji pemulihan, konfigurasi profil pajak, mapping COA, periode akuntansi, validasi aturan pajak per barang, dan rekonsiliasi akuntansi. Domain Cloudflare production tidak diverifikasi dalam audit ini.

## Validasi dan deployment

Untuk perubahan aplikasi, jalankan `npm run lint`, `npm run build`, dan `npm run build:worker`, lalu cantumkan hasil nyata dalam PR. Untuk perubahan schema, jelaskan keputusan D-xx, objek/data terdampak, prosedur pemulihan, dan langkah verifikasi. Jangan menjalankan `supabase db push`, menghapus data, membuka posting, atau melakukan deployment tanpa persetujuan eksplisit pemilik.

Konfigurasi Cloudflare Workers/OpenNext berada di `wrangler.jsonc` dan `open-next.config.ts`. Jangan commit credential atau service-role key.
