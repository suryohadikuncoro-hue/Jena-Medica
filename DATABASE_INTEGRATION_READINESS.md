# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 16 Oktober 2026
**Status:** SO/PO, harga khusus dan capture draft Faktur Supplier aktif; belum siap untuk pembukuan/produksi.
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif.

## Migration dan skema

Empat migration tercatat pada Supabase:

- `20261016125928_dropship_suppliers_orders` — master, SO/PO, snapshot, RPC dan RLS.
- `20261016130021_dropship_foreign_key_indexes` — indeks foreign key.
- `20261016132858_customer_product_price_history` — daftar harga pelanggan/barang, histori masa berlaku dan referensi harga pada baris SO.
- `20261016134859_supplier_invoice_capture` — header dan baris draft faktur supplier, relasi ke PO-line, RLS, RPC create/void.

Sepuluh tabel public terverifikasi: `customers`, `suppliers`, `products`, `customer_product_prices`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`, `supplier_invoices`, dan `supplier_invoice_lines`. Semuanya memakai RLS dan masih berisi **0 baris**. Tidak ada seed data, stok fisik atau perubahan/penghapusan data lama.

Satu project diasumsikan untuk satu perusahaan; skema belum memiliki isolasi multi-tenant.

## Alur yang sudah tersambung

- Login Supabase Auth dan master Pelanggan/Supplier/Barang.
- Harga khusus per customer-product: riwayat append-only, IDR, rentang efektif tidak tumpang tindih. Penetapan harga hanya melalui RPC Owner/Admin; versi baru menutup versi terbuka sehari sebelumnya. Versi tidak dapat di-backdate atau diganti pada tanggal berlaku yang sama.
- SO mengambil harga yang berlaku pada tanggal pesanan secara default. Admin dapat mengubah harga manual; RPC menyimpan harga snapshot, referensi rate bila dipakai, dan `price_overridden`. RPC memvalidasi rate/customer/product/tanggal di database.
- PO draft dari SO terkonfirmasi dengan batas kuantitas split dan locking di database.
- Draft Faktur Supplier disimpan atomik bersama baris yang tertaut ke PO-line dari supplier yang sama. Nomor supplier unik tanpa membedakan kapital/spasi; void draft menyimpan alasan dan jejak pengguna/waktu.
- Angka pajak, diskon, subtotal, biaya lain dan total disimpan **sesuai dokumen supplier**, bukan dihitung ulang. Tidak ada pengakuan AP, pembayaran, HPP/modal final, PPN masukan terhitung, atau jurnal.

Harga SO tetap pra-pajak. Perubahan rate tidak memutasi snapshot SO lama. Tidak ada transaksi yang menghasilkan jurnal pada fase ini.

## Keamanan

- Aplikasi hanya memakai publishable key; tidak ada service-role key di client.
- RLS memeriksa JWT `app_metadata.business_role` (`owner`, `admin`, `viewer`); tanpa role akses tertutup.
- Owner/Admin dapat mengubah master, menetapkan versi harga, membuat SO/PO, serta membuat/void draft faktur supplier. Viewer hanya membaca. Tidak ada hard-delete API.
- Enam RPC `SECURITY DEFINER` di schema `public` dapat dipanggil oleh sesi authenticated; setiap fungsi memeriksa role di database, menggunakan `search_path` kosong, dan hanya diberi execute ke authenticated. Supabase Security Advisor menandai pola tersebut sebagai warning; tinjau kembali sebelum produksi. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor tidak melaporkan FK tanpa index. Temuan “unused index” masih wajar karena seluruh tabel baru kosong.

## Batasan & prasyarat pengujian

Belum ada akun aplikasi atau data master. Administrator perlu mengundang pengguna dan mengatur app metadata, lalu membuat master dan SO/PO sebelum menguji faktur supplier.

Faktur supplier dapat dicatat sebagai draft dan dibatalkan dengan alasan. Belum tersedia edit draft; koreksi dilakukan dengan membatalkan lalu membuat ulang nomor yang sama. Sistem belum memblokir kuantitas invoice yang melampaui kuantitas PO; selisih perlu diperiksa manual. Tidak ada penghitungan pajak atau validasi bahwa rincian/total aritmetis sama dengan faktur.

Keputusan pajak/PPN, alokasi diskon/ongkos, COA dan titik pengakuan pendapatan/HPP/AP masih terbuka. Shipment, invoice pelanggan, pembayaran/alokasi, jurnal, audit umum, lampiran, backup/restore dan uji end-to-end belum dibuat.

## Validasi

- `npm run lint`: lulus.
- `npm run build`: lulus setelah integrasi UI Faktur Supplier.
- `list_tables`/`list_migrations`: dua tabel faktur, kolom, foreign key, RLS dan migration keempat terverifikasi di Supabase.
- Security Advisor: 6 warning `authenticated_security_definer_function_executable` (4 RPC lama + 2 RPC capture/void); semua memeriksa role server-side.
- Semua 10 tabel masih kosong; belum ada kredensial ber-role untuk menjalankan uji alur UI sebagai Owner/Admin/Viewer.

Fitur ini bukan persetujuan cutover atau pembukuan produksi. Sebelum itu, selesaikan aturan pajak/COA, posting AP/HPP, shipment, siklus invoice/pembayaran/jurnal, audit, backup/restore, dan pengujian idempotensi/concurrency/reversal.
