# Jena Medical Center Business Suite

Aplikasi web B2B untuk Jena Medical Center dengan model **drop-ship**: supplier mengirim langsung ke pelanggan; sistem tidak mengelola persediaan fisik.

## Status implementasi

Integrasi Supabase mencakup SO/PO, harga khusus pelanggan, capture draft Faktur Supplier, serta **pengiriman langsung supplier-ke-pelanggan**. Lima migration telah diterapkan. Seluruh 13 tabel public ber-RLS masih kosong; tidak ada data demo yang ditanam.

Sudah terhubung:

- `/login` — login email/password Supabase Auth; pendaftaran akun tidak dibuka di UI.
- `/` — baca, buat dan konfirmasi SO; draft SO disimpan atomik.
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products` — kelola master aktif melalui Supabase.
- `/master-data#prices` — riwayat harga jual per pelanggan/barang.
- `/operasional` — baca dan buat PO; kuantitas sumber divalidasi database.
- `/operasional#invoices` — catat draft faktur supplier dan pasangkan baris faktur ke PO-line supplier yang sama.
- `/pengiriman-piutang` — buat shipment parsial dari PO yang telah ditandai terkirim/terkonfirmasi, catat kurir/resi/surat jalan, status dan riwayat kejadian.

Saat membuat SO, harga khusus yang berlaku pada tanggal SO otomatis dipilih. Admin dapat mengubah harga secara manual; sumber harga dan flag override disimpan sebagai snapshot pada SO line. Perubahan rate tidak mengubah SO lama.

Status PO dikendalikan manual: Owner/Admin menandai PO telah dikirim setelah mengirimkannya di luar aplikasi, lalu mencatat konfirmasi supplier. Aksi ini **tidak mengirim email atau dokumen**.

Shipment mencadangkan kuantitas PO secara atomik dan mendukung pemenuhan parsial. Database mencegah jumlah kumulatif shipment non-batal melebihi kuantitas PO; pembatalan draft melepaskan kuantitas yang dicadangkan. Perubahan status memiliki timeline. Shipment tidak membuat penerimaan, hutang/AP, HPP, invoice pelanggan, pajak, pembayaran, atau jurnal.

Faktur supplier tetap **capture dokumen**: angka disimpan sebagaimana dokumen sumber—belum dihitung ulang atau diposting. Tab Pembayaran/piutang, invoice pelanggan, akuntansi dan dashboard masih belum menjadi transaksi aktual; tab Pembayaran tidak menampilkan angka contoh sebagai data nyata.

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
- `/master-data` — Pelanggan, Supplier, Barang, dan Harga per Pelanggan (Supabase); COA belum aktif.
- `/pengiriman-piutang` — pengiriman langsung (Supabase); pembayaran/piutang belum merupakan transaksi.
- `/invoice-pelanggan` — draft per shipment delivered; belum diterbitkan resmi atau diposting.
- `/keuangan` — status dokumen aktual tanpa angka demo; laporan ledger belum tersedia.

## Model bisnis dan batas akuntansi

Alur sasaran: Pesanan Pelanggan → PO supplier → Faktur Supplier → Pengiriman langsung supplier-ke-pelanggan → Invoice Pelanggan → Pembayaran → jurnal/laporan. PO dapat dipecah lintas supplier; pengiriman dapat parsial per item. Tidak ada modul gudang, batch, FEFO, expiry, penerimaan, picking, atau persediaan fisik.

Belum siap untuk produksi pembukuan: penerbitan invoice resmi, pajak/PPN berbasis klasifikasi yang disetujui, pembayaran/alokasi, pengakuan AP/HPP/pendapatan, COA dan jurnal, audit umum, lampiran, backup/restore, serta UAT role-based. Nilai capture Faktur Supplier dan status shipment bukan posting keuangan. Rancangan aturan dan daftar cutover ada di [`ACCOUNTING_POLICY_AND_CUTOVER.md`](ACCOUNTING_POLICY_AND_CUTOVER.md).

## Deployment

Konfigurasi Cloudflare Workers/OpenNext tersedia di `wrangler.jsonc` dan `open-next.config.ts`. Deployment memerlukan environment variable publik di environment target dan konfigurasi akun yang sesuai. Jangan commit kredensial.
