# Jena Medical Center Business Suite

Aplikasi web manajemen bisnis B2B untuk Jena Medical Center, distributor alat/barang medis dengan model **drop-ship**: supplier mengirim langsung ke pelanggan dan Jena tidak menyimpan stok fisik.

## Status

Repo sedang dalam tahap refaktor UI pada branch `feat/dropship-ui-foundation`. Layar yang ada adalah prototipe dengan data contoh. Belum tersedia autentikasi, persistensi transaksi, jurnal otomatis, PDF invoice, integrasi WhatsApp API, atau laporan dari buku besar. Jangan gunakan nilai demo untuk keputusan operasional atau pembukuan.

Supabase proyek `Jena Medical Center` diperiksa pada 16 Oktober 2026; schema `public` terlihat kosong. Tidak ada migration, tabel, secret, atau koneksi produksi yang dibuat pada perubahan UI ini.

## Model bisnis

Alur sasaran: Pesanan Pelanggan → PO ke satu atau beberapa supplier → Faktur Supplier → Pengiriman supplier langsung ke pelanggan → Invoice Pelanggan → Pembayaran → jurnal dan laporan. Tidak ada menu atau proses penerimaan stok, batch, gudang, FEFO, expiry atau saldo persediaan fisik.

## Menjalankan lokal

```bash
npm ci
npm run dev
```

Buka `http://localhost:3000`. Pemeriksaan proyek:

```bash
npm run lint
npm run build
```

## Struktur layar

- `/dashboard` — ringkasan drop-ship dan tindakan
- `/` — daftar Pesanan Pelanggan
- `/invoice-pelanggan` — daftar dan pratinjau invoice pelanggan
- `/operasional` — Order ke Supplier dan Faktur Supplier
- `/pengiriman-piutang` — pengiriman langsung dan pembayaran/piutang
- `/master-data` — pelanggan, supplier, barang, harga per pelanggan dan COA
- `/keuangan` — ringkasan keuangan dan prototipe laporan

App shell bersama berada di `app/components/app-shell.tsx`; tema dan design tokens global berada di `app/globals.css`.

## Deployment

Konfigurasi Cloudflare Workers/OpenNext tersedia di `wrangler.jsonc` dan `open-next.config.ts`. Untuk membuat Worker build gunakan `npm run build:worker`; deployment memerlukan konfigurasi akun/secret yang sesuai. Jangan menyimpan credential di Git.

## Prinsip integrasi lanjutan

Skema database dan aturan posting harus mengikuti domain drop-ship, bukan dokumen stok lama. Sebelum menghubungkan transaksi, tetapkan autentikasi/RLS, migrasi, snapshot harga/pajak, pencatatan modal aktual, titik pengakuan HPP/pendapatan, pembayaran/alokasi, jurnal, audit, backup, dan test lintas dokumen. Supabase belum dimodifikasi oleh branch ini.
