# Jena Medical Center Business Suite

Aplikasi web B2B untuk Jena Medical Center dengan model **drop-ship**: supplier mengirim langsung ke pelanggan; sistem tidak mengelola persediaan fisik.

## Status implementasi

Integrasi Supabase mencakup SO/PO, harga khusus pelanggan, capture draft Faktur Supplier, serta **pengiriman langsung supplier-ke-pelanggan**. Delapan migration telah tercatat pada Supabase; 21 tabel public memakai RLS dan berisi data TEST terbatas.

Sudah terhubung:

- `/login` — login email/password Supabase Auth; pendaftaran akun tidak dibuka di UI.
- `/` — baca, buat dan konfirmasi SO; draft SO disimpan atomik.
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products` — kelola master aktif melalui Supabase.
- `/master-data#prices` — riwayat harga jual per pelanggan/barang.
- `/operasional` — baca dan buat PO; kuantitas sumber divalidasi database.
- `/operasional#invoices` — catat draft faktur supplier dan pasangkan baris faktur ke PO-line supplier yang sama.
- `/pengiriman-piutang` — buat shipment parsial dan catat penerimaan pelanggan/pembayaran supplier terverifikasi sebagai kas/uang muka. Alokasi hanya menerima invoice pelanggan `issued` atau faktur supplier `posted`; posting status tersebut tersedia dalam framework accounting di PR terpisah.

Saat membuat SO, harga khusus yang berlaku pada tanggal SO otomatis dipilih. Admin dapat mengubah harga secara manual; sumber harga dan flag override disimpan sebagai snapshot pada SO line. Perubahan rate tidak mengubah SO lama.

Status PO dikendalikan manual: Owner/Admin menandai PO telah dikirim setelah mengirimkannya di luar aplikasi, lalu mencatat konfirmasi supplier. Aksi ini **tidak mengirim email atau dokumen**.

Shipment mencadangkan kuantitas PO secara atomik dan mendukung pemenuhan parsial. Database mencegah jumlah kumulatif shipment non-batal melebihi kuantitas PO; pembatalan draft melepaskan kuantitas yang dicadangkan. Perubahan status memiliki timeline. Dengan migration invoice otomatis, pencatatan shipment sebagai diterima pelanggan membuat satu draft invoice dalam transaksi yang sama. Tiap kiriman parsial ditagih terpisah saat diterima; shipment tidak membuat invoice resmi, pajak, pembayaran, AP/HPP atau jurnal.

Faktur supplier tetap **capture dokumen**: angka disimpan sebagaimana dokumen sumber—belum dihitung ulang atau diposting. Draft invoice pelanggan belum diterbitkan. Capture pembayaran dan alokasi guarded sudah tersedia di database; framework AP/AR dan jurnal masih dalam PR dan belum diterapkan. Pajak, HPP, laporan keuangan, audit dan rekonsiliasi bank belum siap untuk cutover.

## Supabase dan akses

1. Salin `.env.example` menjadi `.env.local` dan isi `NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Jangan gunakan atau menyimpan service-role key di browser/Git. `.env.local` diabaikan Git.
3. Administrator membuat/mengundang pengguna di Supabase Auth dan menetapkan claim tepercaya `app_metadata.business_role` menjadi `owner`, `admin`, atau `viewer`. UI tidak membuka pendaftaran atau pengaturan role.
4. Seluruh tabel memakai RLS. Owner/Admin dapat mengubah master dan menjalankan RPC transaksi; Viewer hanya membaca. Shipment dan status PO hanya ditulis melalui RPC yang memeriksa role di database.

Harga baru hanya dapat berlaku mulai hari ini atau tanggal mendatang dan harus lebih baru dari versi terakhir; koreksi mundur belum didukung.

Detail model, migration, RLS, advisor dan batas pengujian ada di [`SUPABASE_INTEGRATION.md`](SUPABASE_INTEGRATION.md) serta [`DATABASE_INTEGRATION_READINESS.md`](DATABASE_INTEGRATION_READINESS.md).

## Menjalankan lokal

```bash
npm ci
cp .env.example .env.local
# Isi URL dan publishable key proyek pengembangan
npm run dev
```

Buka `http://localhost:3000`. Pemeriksaan proyek:

```bash
npm run lint
npm run build
npm run build:worker
```

## Rute aplikasi

- `/dashboard` — hitungan dokumen operasional aktual dari Supabase; bukan saldo akuntansi.
- `/` — Pesanan Pelanggan (Supabase).
- `/operasional` — Order Supplier (Supabase); status PO dicatat manual dan tidak mengirim dokumen.
- `/operasional#invoices` — draft capture Faktur Supplier.
- `/master-data` — Pelanggan, Supplier, Barang, dan Harga per Pelanggan (Supabase); COA berada pada framework accounting PR, belum terpasang remote.
- `/pengiriman-piutang` — pengiriman langsung dan capture receipt/disbursement (Supabase); alokasi aman ke dokumen posted, menunggu workflow posting AP/AR pada PR accounting.
- `/invoice-pelanggan` — satu draft per shipment delivered; draft shipment lama dapat dibuat manual oleh Owner/Admin. Otomatisasi draft aktif; invoice belum resmi atau diposting.
- `/keuangan` — status dokumen aktual tanpa angka demo; framework COA, posting, jurnal dan tutup periode dasar ada di PR accounting, sementara laporan GL belum tersedia.

## Model bisnis dan batas akuntansi

Alur sasaran: Pesanan Pelanggan → PO supplier → Faktur Supplier → Pengiriman langsung supplier-ke-pelanggan → Invoice Pelanggan → Pembayaran → jurnal/laporan. PO dapat dipecah lintas supplier; pengiriman dapat parsial per item. Tidak ada modul gudang, batch, FEFO, expiry, penerimaan, picking, atau persediaan fisik.

Belum siap untuk produksi pembukuan: e-Faktur, klasifikasi pajak tervalidasi, HPP aktual, pengakuan pendapatan final, laporan lengkap, audit umum, lampiran, backup/restore, serta UAT role-based. Capture pembayaran dan alokasi sudah terpasang; migration accounting pada PR belum diterapkan. Pembayaran tetap bukan saldo buku besar sebelum jurnal di-post melalui konfigurasi yang disetujui. Rancangan aturan dan daftar cutover ada di [`ACCOUNTING_POLICY_AND_CUTOVER.md`](ACCOUNTING_POLICY_AND_CUTOVER.md).

## Deployment

Konfigurasi Cloudflare Workers/OpenNext tersedia di `wrangler.jsonc` dan `open-next.config.ts`. Deployment memerlukan environment variable publik di environment target dan konfigurasi akun yang sesuai. Jangan commit kredensial.
