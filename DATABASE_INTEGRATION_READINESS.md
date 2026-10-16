# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 17 Oktober 2026
**Status:** SO/PO, harga khusus, capture draft Faktur Supplier, dan shipment langsung aktif; capture pembayaran/alokasi masih pada PR dan belum siap untuk pembukuan/produksi.
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif.

## Migration dan skema

Tujuh migration tercatat pada Supabase (termasuk auto-invoice per shipment):

- `20261016125928_dropship_suppliers_orders` — master, SO/PO, snapshot, RPC dan RLS.
- `20261016130021_dropship_foreign_key_indexes` — indeks foreign key.
- `20261016132858_customer_product_price_history` — daftar harga pelanggan/barang, histori masa berlaku dan referensi harga pada baris SO.
- `20261016134859_supplier_invoice_capture` — header/baris draft faktur supplier, relasi ke PO-line, RLS, RPC create/void.
- `20261016171001_dropship_shipment_tracking` — metadata status PO, shipment/header/baris/timeline, validasi kuantitas, RLS dan RPC.
- `20261016175827_customer_invoices_per_delivery_drafts` — invoice draft per shipment delivered, snapshot dan RPC create/void.
- `20261016205342_auto_customer_invoice_on_delivery_drafts` — trigger invoice draft atomik pada shipment delivered.
- `20261017130000_payments_and_invoice_allocations` — migration di branch/PR pembayaran; belum diterapkan remote.

Lima belas tabel public terverifikasi termasuk `sales_invoices` dan `sales_invoice_lines`; seluruh 15 tabel memakai RLS. Project memiliki data TEST terbatas (1 customer, 1 supplier, 1 product, SO/PO dan harga); faktur supplier, shipment, dan invoice pelanggan masih kosong. Tidak ada saldo persediaan. Migration pembayaran baru di PR dan belum terpasang remote.

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
- Shipment tidak menghasilkan penerimaan, AP/HPP, invoice resmi, pajak, atau jurnal. Auto-draft invoice sudah tercatat remote; migration PR pembayaran berikutnya menangkap receipt/disbursement dan uang muka, tetapi belum dijalankan.

## Keamanan

- Aplikasi hanya memakai publishable key; tidak ada service-role key di client.
- RLS memeriksa JWT `app_metadata.business_role` (`owner`, `admin`, `viewer`); tanpa role akses tertutup.
- Owner/Admin dapat mengubah master, membuat/mengonfirmasi SO, membuat PO, mencatat status PO, membuat/transisi shipment, serta membuat/void draft faktur. Viewer hanya membaca. Tabel shipment dan faktur tidak memberi hak tulis langsung.
- RPC `set_purchase_order_status`, `create_shipment`, dan `transition_shipment` membatasi transisi dan memeriksa role server-side. Fungsi `create_shipment` memverifikasi PO status, pemetaan PO-line dan batas kuantitas dengan locking.
- Security Advisor menampilkan 9 warning `authenticated_security_definer_function_executable` untuk RPC yang memang dipanggil sesi authenticated; setiap fungsi memeriksa role, menggunakan `search_path` kosong, dan execute dibatasi ke `authenticated`. Tinjau lagi sebelum produksi. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor tidak melaporkan foreign key tanpa indeks. Temuan `unused index` masih wajar karena tabel baru kosong.

## Batasan & prasyarat pengujian

Project memiliki akun/data TEST, tetapi uji end-to-end UI dengan sesi ber-role Owner/Admin/Viewer tetap harus dijalankan.

Belum tersedia pengiriman dokumen PO, integrasi kurir/resi, upload bukti/surat jalan, edit draft shipment, posting/jurnal, dan alur pembayaran pada Production. PR pembayaran menyediakan capture receipt/disbursement dan RPC alokasi guarded; alokasi hanya untuk invoice `issued`/faktur supplier `posted`. Karena remote masih draft-only, dana yang dicatat tetap uang muka dan belum ada alokasi aktif. Jika draft shipment perlu diperbaiki, batalkan dengan alasan lalu buat ulang. Status shipment delivered/cancelled bersifat final; koreksi setelahnya belum memiliki reversal workflow.

Faktur supplier belum membatasi kuantitas kumulatif terhadap PO dan tidak menguji aritmetika subtotal/PPN/total. Keputusan pajak/PPN, alokasi diskon/ongkos, COA serta titik pengakuan pendapatan/HPP/AP masih terbuka. Status shipment tidak memicu posting atau invoice resmi.

## Validasi

- `npm run lint`: lulus setelah perubahan pembayaran.
- `npm run build`: lulus; route `/pengiriman-piutang` terkompilasi.
- `npm run build:worker`: lulus pada OpenNext/Cloudflare.
- Migration pembayaran diparse dan berhasil diterapkan ke PostgreSQL 16 lokal dengan fixture terisolasi; RPC diuji untuk idempotensi capture/alokasi, penolakan draft, batas saldo invoice/pembayaran, dan void batch. Tidak menyentuh Supabase Production.
- `list_migrations`: tujuh migration tercatat remote, termasuk auto-invoice versi `20261016205342`; migration pembayaran belum diterapkan.
- `list_tables`: 15 tabel public terverifikasi memakai RLS; data TEST ada di master, harga, SO dan PO; invoice dan shipment masih kosong.
- Security Advisor sebelumnya melaporkan 9 warning terkait SECURITY DEFINER yang dapat dipanggil authenticated; role checks tetap berada di database. Jalankan ulang Advisor setelah migration pembayaran diterapkan.
- Uji alur UI Owner/Admin/Viewer end-to-end pada project non-production belum dilakukan.

Fitur ini bukan persetujuan cutover atau pembukuan produksi. Setelah PR pembayaran di-merge, migration tetap harus diterapkan terpisah. Langkah berikutnya: invoice resmi, finalisasi pajak/COA, posting AP/HPP, aktifkan alokasi pada dokumen posted, jurnal, audit, backup/restore, serta UAT concurrency/reversal pada environment non-production.

## Pembaruan PR invoice otomatis

Migration lokal `20261017120000_auto_customer_invoice_on_delivery_drafts.sql` memasang trigger setelah status shipment berubah menjadi `delivered`. Remote mencatat migration ini sebagai versi `20261016205342`; trigger membuat draft dalam transaksi yang sama. Shipment parsial masing-masing menghasilkan draft sendiri. Shipment delivered yang sudah ada tidak di-backfill. UAT/concurrency test terhadap database non-production belum dilakukan.
