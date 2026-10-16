# Jena Medical Center Business Suite

Aplikasi web B2B untuk Jena Medical Center dengan model **drop-ship**: supplier mengirim langsung ke pelanggan; Jena tidak menyimpan stok fisik.

## Status implementasi

Branch `feat/supabase-orders-suppliers` berisi integrasi tahap pertama ke proyek Supabase **Jena Medical Center**. Dua migration sudah diterapkan dan disimpan di `supabase/migrations/`. Tabel baru masih kosong; tidak ada data demo yang ditanam.

Sudah terhubung:

- `/login` — login email/password Supabase Auth; pendaftaran akun tidak dibuka di UI.
- `/` — daftar SO aktual, pembuatan draft SO atomik, dan konfirmasi SO.
- `/master-data#customers` — baca/tambah/nonaktifkan pelanggan.
- `/master-data#suppliers` — baca/tambah/nonaktifkan supplier.
- `/master-data#products` — baca/tambah/nonaktifkan barang.
- `/operasional` — baca dan buat draft PO supplier dari SO terkonfirmasi; SO-line dapat di-split antar-PO dengan batas kuantitas ditegakkan database.

Rute dan modul lain—harga per pelanggan, faktur supplier, pengiriman, invoice pelanggan, pembayaran, jurnal, dan laporan—masih berupa prototipe atau belum terhubung. PPN dan jurnal tidak dihitung pada tahap ini. Nilai SO adalah nilai pra-pajak, dan harga jual diinput manual karena tabel harga per pelanggan belum dibuat.

## Supabase dan akses

1. Salin `.env.example` menjadi `.env.local` dan isi `NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Jangan gunakan atau menyimpan service-role key di browser/Git. `.env.local` diabaikan Git.
3. Buat/undang pengguna melalui Supabase Auth, lalu tetapkan claim tepercaya `app_metadata.business_role` menjadi `owner`, `admin`, atau `viewer`. UI tidak menyediakan pendaftaran maupun pengaturan role sendiri. User harus refresh/login ulang setelah perubahan claim.
4. Semua tabel `public` baru menggunakan RLS. Tanpa sesi dan claim role yang sesuai, akses ditolak. Owner/Admin dapat menulis master dan memanggil RPC SO/PO; Viewer hanya membaca. Tidak ada hard-delete API; master dinonaktifkan.

Detail model, migration, perilaku RLS, advisory keamanan, dan batasan uji ada di [`SUPABASE_INTEGRATION.md`](SUPABASE_INTEGRATION.md) dan [`DATABASE_INTEGRATION_READINESS.md`](DATABASE_INTEGRATION_READINESS.md).

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
```

## Rute aplikasi

- `/dashboard` — ringkasan UI; sebagian metrik belum menjadi read model database.
- `/` — Pesanan Pelanggan (Supabase).
- `/operasional` — Order Supplier (Supabase); Faktur Supplier belum diintegrasikan.
- `/master-data` — Pelanggan, Supplier dan Barang (Supabase); harga per pelanggan dan COA belum terhubung.
- `/invoice-pelanggan` — prototipe invoice pelanggan.
- `/pengiriman-piutang` — prototipe pengiriman langsung dan pembayaran/piutang.
- `/keuangan` — prototipe ringkasan keuangan/laporan.

## Model bisnis dan batas akuntansi

Alur sasaran: Pesanan Pelanggan → satu atau beberapa PO supplier → Faktur Supplier → Pengiriman langsung supplier-ke-pelanggan → Invoice Pelanggan → Pembayaran → jurnal/laporan. Tidak ada gudang, batch, FEFO, expiry, penerimaan, picking, atau persediaan fisik.

Belum siap untuk produksi pembukuan: aturan pajak/PPN, pengakuan pendapatan/HPP/AP, faktur/pembayaran, audit log, backup/restore dan uji end-to-end masih perlu diselesaikan bersama pemilik/akuntan.

## Deployment

Konfigurasi Cloudflare Workers/OpenNext tersedia di `wrangler.jsonc` dan `open-next.config.ts`. Deployment memerlukan environment variable publik di environment target dan konfigurasi akun yang sesuai. Jangan commit kredensial.
