# Jena Medical Center Business Suite

Aplikasi web B2B untuk Jena Medical Center dengan model **drop-ship**: supplier mengirim langsung ke pelanggan; Jena tidak menyimpan stok fisik.

## Status implementasi

Branch `feat/customer-product-pricing` melanjutkan integrasi Supabase pada proyek **Jena Medical Center**. Tiga migration telah diterapkan. Delapan tabel tetap kosong; tidak ada data demo yang ditanam.

Sudah terhubung:

- `/login` — login email/password Supabase Auth; pendaftaran akun tidak dibuka di UI.
- `/` — baca, buat dan konfirmasi SO; draft SO disimpan atomik.
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products` — kelola master aktif melalui Supabase.
- `/master-data#prices` — riwayat harga jual per pelanggan/barang; versi baru efektif hari ini atau tanggal mendatang.
- `/operasional` — baca dan buat draft PO dari SO terkonfirmasi; kuantitas split dibatasi database.

Saat membuat SO, harga khusus yang berlaku pada tanggal SO otomatis dipilih. Admin dapat mengubah harga secara manual; sumber harga dan flag override disimpan sebagai snapshot pada SO line. Perubahan rate tidak mengubah SO lama.

Faktur supplier, pengiriman, invoice pelanggan, pembayaran, pajak, jurnal dan laporan keuangan masih prototipe atau belum terhubung. Nilai SO tetap pra-pajak.

## Supabase dan akses

1. Salin `.env.example` menjadi `.env.local` dan isi `NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Jangan gunakan atau menyimpan service-role key di browser/Git. `.env.local` diabaikan Git.
3. Administrator membuat/mengundang pengguna di Supabase Auth dan menetapkan claim tepercaya `app_metadata.business_role` menjadi `owner`, `admin`, atau `viewer`. UI tidak membuka pendaftaran atau pengaturan role.
4. Seluruh tabel memakai RLS. Owner/Admin dapat menulis master, menetapkan harga, dan menjalankan RPC transaksi; Viewer hanya membaca. Tidak ada hard-delete API.

Harga baru hanya dapat berlaku mulai hari ini atau tanggal mendatang dan harus lebih baru dari versi terakhir; rate terbuka sebelumnya berakhir sehari sebelum versi baru. Koreksi mundur atau mengganti versi yang sudah dibuat pada hari yang sama belum didukung.

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

- `/dashboard` — ringkasan UI; sebagian metrik belum menjadi read model database.
- `/` — Pesanan Pelanggan (Supabase).
- `/operasional` — Order Supplier (Supabase); Faktur Supplier belum diintegrasikan.
- `/master-data` — Pelanggan, Supplier, Barang, dan Harga per Pelanggan (Supabase); COA masih prototipe.
- `/invoice-pelanggan` — prototipe invoice pelanggan.
- `/pengiriman-piutang` — prototipe pengiriman langsung dan pembayaran/piutang.
- `/keuangan` — prototipe ringkasan keuangan/laporan.

## Model bisnis dan batas akuntansi

Alur sasaran: Pesanan Pelanggan → satu atau beberapa PO supplier → Faktur Supplier → Pengiriman langsung supplier-ke-pelanggan → Invoice Pelanggan → Pembayaran → jurnal/laporan. Tidak ada gudang, batch, FEFO, expiry, penerimaan, picking, atau persediaan fisik.

Belum siap untuk produksi pembukuan: aturan pajak/PPN, pengakuan pendapatan/HPP/AP, faktur/pembayaran, audit log, backup/restore dan uji end-to-end masih perlu diselesaikan bersama pemilik/akuntan.

## Deployment

Konfigurasi Cloudflare Workers/OpenNext tersedia di `wrangler.jsonc` dan `open-next.config.ts`. Deployment memerlukan environment variable publik di environment target dan konfigurasi akun yang sesuai. Jangan commit kredensial.
