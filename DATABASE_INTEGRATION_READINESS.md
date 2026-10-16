# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 16 Oktober 2026
**Status:** Tahap awal Supabase terpasang; belum siap untuk pembukuan/produksi.
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif.

## Perubahan tahap ini

Dua migration tercatat pada proyek Supabase:

- `20261016125928_dropship_suppliers_orders` — tujuh tabel referensi/transaksi, relasi, snapshot dan RPC.
- `20261016130021_dropship_foreign_key_indexes` — indeks yang direkomendasikan untuk foreign key.

Tabel `public.customers`, `suppliers`, `products`, `sales_orders`, `sales_order_lines`, `purchase_orders`, dan `purchase_order_lines` berhasil diverifikasi. RLS aktif di seluruh tabel dan jumlah baris awal **0**. Tidak ada seed/data demo, tabel stok, atau data yang ditimpa.

Layar login, master Pelanggan/Supplier/Barang, SO, dan draft PO terhubung ke Supabase. Alur SO→PO memakai snapshot alamat/barang, nomor dokumen sequence, RPC transaksional, serta validasi agar kuantitas agregat PO tidak melebihi baris SO.

## Keamanan dan akses

- Aplikasi memakai publishable key saja; tidak ada service-role key di client.
- Semua tabel exposed memakai RLS. `app_private.has_business_role` memeriksa JWT `app_metadata.business_role`, bukan `user_metadata`.
- `owner`/`admin` dapat mengelola master dan menjalankan RPC order; `viewer` hanya dapat membaca. User tanpa role tertutup secara default.
- Tidak ada hard-delete grant/policy. Master dinonaktifkan melalui `is_active`.
- RPC SO/PO memakai `SECURITY DEFINER` karena tabel transaksi tidak memberikan write langsung ke client; fungsi memeriksa role di server, memakai `search_path` kosong, dan execute hanya diberikan ke role `authenticated`. Advisor keamanan tetap memberi peringatan untuk 3 RPC tersebut karena bisa dipanggil oleh sesi authenticated. Ini disengaja agar UI dapat memakai transaksi atomik; warning perlu ditinjau lagi sebelum produksi.
- Advisor performa tidak lagi melaporkan foreign key tanpa indeks. Advisor masih melaporkan indeks sebagai “unused”; tabel baru masih kosong sehingga statistik penggunaan belum bermakna.

## Keputusan domain dan batasan

Model yang diminta adalah **drop-ship tanpa stok fisik Jena**. Supplier mengirim langsung ke alamat pelanggan; spesifikasi gudang, batch, FEFO, expiry, karantina, picking dan stock ledger tidak berlaku.

Fase awal membatasi mata uang pada IDR, tidak menghitung PPN, tidak membuat jurnal, dan meminta harga jual dimasukkan manual (master harga khusus pelanggan belum dibuat). Belum ada supplier invoice, pengiriman, sales invoice, pembayaran, alokasi, COA, audit event atau attachment. Faktur Supplier di UI secara eksplisit belum terhubung.

## Prasyarat akses untuk memakai preview

Proyek tidak berisi akun aplikasi atau data master awal. Administrator perlu membuat/mengundang pengguna di Supabase Auth dan memberi `app_metadata.business_role` (`owner`, `admin`, atau `viewer`) melalui mekanisme admin tepercaya. Setelah itu siapkan satu pelanggan dan satu barang sebelum membuat SO, serta satu supplier sebelum membuat PO. Perubahan role memerlukan JWT yang diperbarui/login ulang.

## Pengujian dan status kesiapan

- `npm run lint`: lulus.
- `npm run build`: lulus.
- Schema/list migration: berhasil diverifikasi via Supabase.
- Semua tabel kosong; belum ada kredensial pengguna untuk menguji RLS secara end-to-end lewat UI.
- Belum dilakukan simulasi transaksi nyata karena tidak ada user/seed data. Uji role Owner/Admin/Viewer dan split PO perlu dilakukan setelah admin memprovisikan akun dan master.

Ini adalah tahap persistensi non-akuntansi, bukan persetujuan cutover. Sebelum produksi: sepakati PPN/COA dan titik pengakuan pendapatan/HPP/AP; implementasikan invoice/pengiriman/pembayaran/jurnal/audit; tambahkan test idempotensi, concurrency, backup/restore dan reversal.
