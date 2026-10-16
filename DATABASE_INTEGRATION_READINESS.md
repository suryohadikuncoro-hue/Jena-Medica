# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 17 Oktober 2026
**Status:** SO/PO, harga khusus, capture draft Faktur Supplier, dan shipment langsung aktif; belum siap untuk pembukuan/produksi.
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif.

## Migration dan skema

Enam migration tercatat pada Supabase (termasuk invoice draft per shipment):

- `20261016125928_dropship_suppliers_orders` — master, SO/PO, snapshot, RPC dan RLS.
- `20261016130021_dropship_foreign_key_indexes` — indeks foreign key.
- `20261016132858_customer_product_price_history` — daftar harga pelanggan/barang, histori masa berlaku dan referensi harga pada baris SO.
- `20261016134859_supplier_invoice_capture` — header/baris draft faktur supplier, relasi ke PO-line, RLS, RPC create/void.
- `20261016171001_dropship_shipment_tracking` — metadata status PO, shipment/header/baris/timeline, validasi kuantitas, RLS dan RPC.
- `20261016175827_customer_invoices_per_delivery_drafts` — invoice draft per shipment delivered, snapshot dan RPC create/void.

Lima belas tabel public terverifikasi termasuk `sales_invoices` dan `sales_invoice_lines`; seluruh 15 tabel memakai RLS. Project memiliki data master TEST dan satu alur SO/PO uji; faktur supplier, shipment, dan invoice pelanggan belum berisi data. Tidak ada saldo persediaan.

Satu project diasumsikan untuk satu perusahaan; skema belum memiliki isolasi multi-tenant.

## Alur yang sudah tersambung

- Login Supabase Auth dan master Pelanggan/Supplier/Barang.
- Harga khusus per customer-product: histori append-only, IDR, rentang efektif tidak tumpang tindih. Penetapan harga hanya melalui RPC Owner/Admin.
- SO mengambil harga yang berlaku pada tanggal pesanan sebagai default; server menyimpan snapshot dan memvalidasi referensi harga.
- PO draft dari SO terkonfirmasi dengan batas kuantitas split dan locking di database.
- PO dapat ditandai terkirim lalu dikonfirmasi supplier melalui RPC. Ini pencatatan manual setelah komunikasi di luar aplikasi; tidak ada email/dokumen yang dikirim otomatis.
- Draft Faktur Supplier disimpan atomik bersama baris yang tertaut ke PO-line supplier yang sama. Angka dokumen disimpan apa adanya, bukan dihitung ulang atau diposting.
- Shipment langsung dari supplier ke alamat snapshot pelanggan, dengan kuantitas parsial per PO-line. Database mengunci PO/line dan mencegah jumlah kumulatif draft/kiriman non-batal melebihi kuantitas PO. Pembatalan draft melepas alokasi.
- Status shipment dan timeline: draft → dikirim → diterima; kendala dapat dicatat dan dilanjutkan. Pembatalan hanya untuk draft dan selalu menyimpan alasan. Tidak ada komunikasi otomatis dengan supplier/kurir.
- Shipment tidak menghasilkan penerimaan, AP/HPP, invoice resmi, saldo pembayaran, pajak, atau jurnal. Migration auto-draft baru di PR terpisah akan mengikat pembuatan draft invoice ke transisi delivered.

## Keamanan

- Aplikasi hanya memakai publishable key; tidak ada service-role key di client.
- RLS memeriksa JWT `app_metadata.business_role` (`owner`, `admin`, `viewer`); tanpa role akses tertutup.
- Owner/Admin dapat mengubah master, membuat/mengonfirmasi SO, membuat PO, mencatat status PO, membuat/transisi shipment, serta membuat/void draft faktur. Viewer hanya membaca. Tabel shipment dan faktur tidak memberi hak tulis langsung.
- RPC `set_purchase_order_status`, `create_shipment`, dan `transition_shipment` membatasi transisi dan memeriksa role server-side. Fungsi `create_shipment` memverifikasi PO status, pemetaan PO-line dan batas kuantitas dengan locking.
- Security Advisor menampilkan 9 warning `authenticated_security_definer_function_executable` untuk RPC yang memang dipanggil sesi authenticated; setiap fungsi memeriksa role, menggunakan `search_path` kosong, dan execute dibatasi ke `authenticated`. Tinjau lagi sebelum produksi. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor tidak melaporkan foreign key tanpa indeks. Temuan `unused index` masih wajar karena tabel baru kosong.

## Batasan & prasyarat pengujian

Project memiliki akun/data TEST, tetapi uji end-to-end UI dengan sesi ber-role Owner/Admin/Viewer tetap harus dijalankan.

Belum tersedia pengiriman dokumen PO, integrasi kurir/resi, upload bukti/surat jalan, edit draft shipment, pembayaran/alokasi, dan jurnal. Draft invoice per shipment sudah tersedia; migration baru di PR mengotomatiskan draft saat delivered. Jika draft shipment perlu diperbaiki, batalkan dengan alasan lalu buat ulang. Status shipment delivered/cancelled bersifat final; koreksi setelahnya belum memiliki reversal workflow.

Faktur supplier belum membatasi kuantitas kumulatif terhadap PO dan tidak menguji aritmetika subtotal/PPN/total. Keputusan pajak/PPN, alokasi diskon/ongkos, COA serta titik pengakuan pendapatan/HPP/AP masih terbuka. Status shipment tidak memicu posting atau invoice resmi.

## Validasi

- `npm run lint`: lulus.
- `npm run build`: lulus; route `/pengiriman-piutang` terkompilasi.
- `npm run build:worker`: lulus pada OpenNext/Cloudflare.
- `list_migrations`: migration kelima tercatat dengan versi `20261016171001`.
- `list_tables`: tiga tabel shipment, metadata PO, RLS, constraint, foreign key dan indeks terverifikasi; seluruh 13 tabel masih kosong.
- Security Advisor: 9 warning terkait SECURITY DEFINER yang dapat dipanggil authenticated; role checks tetap berada di database. Performance Advisor tidak melaporkan FK tanpa indeks.
- Uji alur UI Owner/Admin/Viewer end-to-end belum dapat dilakukan karena belum ada akun ber-role maupun data master.

Fitur ini bukan persetujuan cutover atau pembukuan produksi. Langkah selanjutnya: UAT auto-draft invoice pada environment non-production, finalisasi pajak/COA, posting AP/HPP, pembayaran/jurnal, audit, backup/restore, serta pengujian concurrency/reversal.

## Pembaruan PR invoice otomatis

Migration `20261017120000_auto_customer_invoice_on_delivery_drafts.sql` memasang trigger setelah status shipment berubah menjadi `delivered`. Trigger memanggil `create_customer_invoice` dalam transaksi yang sama; bila invoice gagal dibuat, update status delivery rollback. Shipment parsial masing-masing menghasilkan draft sendiri. Shipment delivered yang sudah ada tidak di-backfill dan masih dapat diproses manual. Migration ini berada di branch PR baru dan belum diterapkan pada Supabase Production. UAT/concurrency test terhadap database non-production belum dilakukan.
