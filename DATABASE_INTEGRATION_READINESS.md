# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 16 Oktober 2026
**Status:** Tahap persistensi transaksi dan harga khusus berjalan; belum siap untuk pembukuan/produksi.
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif.

## Migration dan skema

Tiga migration tercatat pada Supabase:

- `20261016125928_dropship_suppliers_orders` — master, SO/PO, snapshot, RPC dan RLS.
- `20261016130021_dropship_foreign_key_indexes` — indeks foreign key.
- `20261016132858_customer_product_price_history` — daftar harga pelanggan/barang, histori masa berlaku dan referensi harga pada baris SO.

Delapan tabel public terverifikasi: `customers`, `suppliers`, `products`, `customer_product_prices`, `sales_orders`, `sales_order_lines`, `purchase_orders`, `purchase_order_lines`. Semuanya memakai RLS dan masih berisi **0 baris**. Tidak ada seed data, stok fisik atau perubahan/penghapusan data lama.

Satu project diasumsikan untuk satu perusahaan; skema belum memiliki isolasi multi-tenant.

## Alur yang sudah tersambung

- Login Supabase Auth dan master Pelanggan/Supplier/Barang.
- Harga khusus per customer-product: riwayat append-only, IDR, rentang efektif tidak tumpang tindih. Penetapan harga hanya melalui RPC Owner/Admin; versi baru menutup versi terbuka sehari sebelumnya. Versi tidak dapat di-backdate atau diganti pada tanggal berlaku yang sama.
- SO mengambil harga yang berlaku pada tanggal pesanan secara default. Admin dapat mengubah harga manual; RPC menyimpan harga snapshot, referensi rate bila dipakai, dan `price_overridden`. RPC memvalidasi rate/customer/product/tanggal di database.
- PO draft dari SO terkonfirmasi dengan batas kuantitas split dan locking di database.

Harga adalah nilai pra-pajak. Perubahan rate tidak memutasi snapshot SO lama. Rate customer-product dan SO/PO belum menghasilkan jurnal.

## Keamanan

- Aplikasi hanya memakai publishable key; tidak ada service-role key di client.
- RLS memeriksa JWT `app_metadata.business_role` (`owner`, `admin`, `viewer`); tanpa role akses tertutup.
- Owner/Admin dapat mengubah master, menetapkan versi harga dan menjalankan transaksi; Viewer hanya membaca. Tidak ada hard-delete API.
- Empat RPC `SECURITY DEFINER` di schema `public` dapat dipanggil oleh sesi authenticated; setiap fungsi memeriksa role di database, menggunakan `search_path` kosong, dan hanya diberi execute ke authenticated. Supabase Security Advisor menandai pola tersebut sebagai warning; tinjau lagi sebelum produksi.
- Performance Advisor tidak lagi melaporkan FK tanpa index. Temuan “unused index” masih wajar karena tabel baru kosong.

## Batasan & prasyarat pengujian

Belum ada akun aplikasi atau data master. Administrator perlu mengundang pengguna dan mengatur app metadata, lalu membuat master sebelum menguji SO/PO/harga.

Harga versi baru hanya dapat mulai hari ini atau mendatang dan harus lebih baru dari versi terakhir; koreksi harga backdate atau penggantian versi pada hari yang sama belum didukung. Keputusan pajak/PPN, COA dan titik pengakuan pendapatan/HPP/AP masih terbuka. Faktur supplier/customer, shipment, pembayaran, jurnal, audit trail, lampiran, backup/restore dan uji end-to-end belum dibuat.

## Validasi

- `npm run lint`: lulus.
- `npm run build`: lulus setelah perubahan kode.
- `list_tables`/`list_migrations`: tabel, RLS dan migration harga berhasil diverifikasi di Supabase.
- Semua tabel masih kosong; belum ada kredensial ber-role untuk menjalankan uji alur UI sebagai Owner/Admin/Viewer.

Fitur ini bukan persetujuan cutover atau pembukuan produksi. Sebelum itu, selesaikan aturan pajak/COA, siklus faktur/pengiriman/pembayaran/jurnal, audit, backup/restore, dan pengujian idempotensi/concurrency/reversal.
