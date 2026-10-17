# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 17 Oktober 2026
**Status:** alur SO/PO, harga, shipment, capture invoice dan pembayaran sudah terhubung. Framework posting AP/AR/jurnal sudah tercatat di Supabase, tetapi posting masih terkunci karena approval profile berstatus `draft`, mapping kosong, dan periode belum dibuat.
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif.

## Migration dan skema

Sembilan migration tercatat pada Supabase (termasuk auto-invoice dan pembayaran):

- `20261016125928_dropship_suppliers_orders` — master, SO/PO, snapshot, RPC dan RLS.
- `20261016130021_dropship_foreign_key_indexes` — indeks foreign key.
- `20261016132858_customer_product_price_history` — daftar harga pelanggan/barang, histori masa berlaku dan referensi harga pada baris SO.
- `20261016134859_supplier_invoice_capture` — header/baris draft faktur supplier, relasi ke PO-line, RLS, RPC create/void.
- `20261016171001_dropship_shipment_tracking` — metadata status PO, shipment/header/baris/timeline, validasi kuantitas, RLS dan RPC.
- `20261016175827_customer_invoices_per_delivery_drafts` — invoice draft per shipment delivered, snapshot dan RPC create/void.
- `20261016205342_auto_customer_invoice_on_delivery_drafts` — trigger invoice draft atomik pada shipment delivered.
- `20261016215508_payments_and_invoice_allocations` — capture receipt/disbursement, uang muka dan alokasi guarded; tercatat pada remote.
- `20261016225329_accounting_posting_framework` — COA, approval/policy gate, periods, journal ledger dan posting AP/AR; tercatat pada remote, tetapi posting masih terkunci.

Dua puluh tujuh tabel public mengaktifkan RLS dan masing-masing memiliki policy. Snapshot row-count read-only: 1 customer, 1 supplier, 2 product, 2 SO, 1 PO, 1 harga khusus, 1 shipment, 1 penerimaan pelanggan, 1 pembayaran supplier, 10 akun COA, 0 mapping akun, 0 periode, 0 invoice pelanggan, 0 faktur supplier, dan 0 jurnal. Tidak ada saldo persediaan fisik. Sebelum cutover, pastikan record operasional yang sudah ada memang data uji dan bukan transaksi yang perlu dipertahankan.

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
- Shipment tidak menghasilkan penerimaan, AP/HPP, invoice resmi, pajak, atau jurnal. Auto-draft invoice, capture/alokasi pembayaran dan framework accounting tercatat remote; belum ada jurnal.

## Keamanan

- Aplikasi hanya memakai publishable key; tidak ada service-role key di client.
- RLS memeriksa JWT `app_metadata.business_role` (`owner`, `admin`, `viewer`); tanpa role akses tertutup.
- Owner/Admin dapat mengubah master, membuat/mengonfirmasi SO, membuat PO, mencatat status PO, membuat/transisi shipment, serta membuat/void draft faktur. Viewer hanya membaca. Tabel shipment dan faktur tidak memberi hak tulis langsung.
- RPC `set_purchase_order_status`, `create_shipment`, dan `transition_shipment` membatasi transisi dan memeriksa role server-side. Fungsi `create_shipment` memverifikasi PO status, pemetaan PO-line dan batas kuantitas dengan locking.
- Audit read-only 17 Oktober 2026 menemukan 33 peringatan `authenticated_security_definer_function_executable`; semua 33 fungsi public yang diperiksa memiliki pemeriksaan `has_business_role`, tidak ada yang dapat dieksekusi role `anon`, dan semua tabel public yang diperiksa mengaktifkan RLS serta punya policy. Advisor juga menandai perlindungan password bocor yang belum aktif. Review setting Auth sebelum cutover. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor menandai 20 foreign key tanpa indeks pendukung dan 46 indeks belum terpakai. Karena volume data masih kecil, jangan menghapus indeks hanya dari sinyal `unused`; tinjau kebutuhan indeks foreign key sebelum beban produksi meningkat.

## Batasan & prasyarat pengujian

Project memiliki akun/data TEST, tetapi uji end-to-end UI dengan sesi ber-role Owner/Admin/Viewer tetap harus dijalankan.

Belum tersedia pengiriman dokumen PO, integrasi kurir/resi, upload bukti/surat jalan atau edit draft shipment. Capture receipt/disbursement dan RPC alokasi guarded sudah terpasang; invoice pelanggan dan faktur supplier masih kosong, sehingga belum ada alokasi yang dapat diposting sebagai AR/AP. Kerangka posting AP/AR tersedia remote tetapi dikunci oleh gate persetujuan.

Faktur supplier belum membatasi kuantitas kumulatif terhadap PO dan tidak menguji aritmetika subtotal/PPN/total. Keputusan pajak/PPN, alokasi diskon/ongkos, COA serta titik pengakuan pendapatan/HPP/AP harus ditetapkan oleh pemilik/akuntan sebelum approval gate dibuka. Status shipment tidak memicu posting atau invoice resmi.

## Validasi

- `npm run lint`: lulus untuk framework accounting dan UI invoice.
- `npm run build`: lulus; route `/keuangan`, `/invoice-pelanggan`, dan `/operasional` terkompilasi.
- `npm run build:worker`: lulus pada OpenNext/Cloudflare (pengujian lokal yang tercatat sebelumnya; tidak dijalankan ulang pada audit ini).
- Deployment live: konfigurasi Wrangler menunjuk Worker `jena-medica`; status URL live belum terverifikasi dari lingkungan audit. Tidak ada deployment dilakukan.
- Framework accounting diparse dan diterapkan pada PostgreSQL 16 lokal disposable; end-to-end test memeriksa gate approval, issue AR, posting AP/clearing, payment journals, alokasi parsial dua arah, idempotensi, balanced journal, close guard, dan reversal allocation. Tidak menyentuh Supabase Production.
- `list_migrations`: sembilan migration tercatat remote. Keempat file migration terakhir pada branch ini sudah menggunakan version ID remote agar CLI tidak mencoba menjalankan ulang migration yang sudah tercatat.
- `list_tables`/query hitungan: 27 tabel public mengaktifkan RLS dan seluruhnya memiliki policy; terdapat 1 shipment dan 1 record masing-masing penerimaan/pembayaran, tetapi belum ada invoice atau jurnal. Status real-vs-test record wajib dikonfirmasi sebelum cutover.
- Security Advisor pada remote saat audit: 33 warning untuk RPC `SECURITY DEFINER` yang dapat dipanggil authenticated; pemeriksaan definisi menunjukkan role check pada fungsi public yang diperiksa dan tidak ada execute grant ke `anon`. Ada 1 warning perlindungan password bocor nonaktif. Performance Advisor menampilkan 20 FK tanpa index dan 46 unused indexes.
- Uji alur UI Owner/Admin/Viewer end-to-end pada project non-production belum dilakukan.

Fitur ini bukan persetujuan cutover atau pembukuan produksi. Accounting migration sudah tercatat remote, tetapi approval oleh Owner/Admin dan pembukaan periode masih diperlukan sebelum posting. Langkah berikutnya: keputusan akuntan/pajak, HPP dan revenue final, laporan, audit umum, lampiran, backup/restore, serta UAT role-based/concurrency/reversal pada environment non-production.

## Pembaruan PR invoice otomatis

Migration lokal `20261016205342_auto_customer_invoice_on_delivery_drafts.sql` kini memakai versi yang sama dengan catatan remote. Trigger membuat draft invoice dalam transaksi yang sama saat status shipment berubah menjadi `delivered`. Shipment parsial masing-masing menghasilkan draft sendiri. Shipment delivered yang sudah ada tidak di-backfill. UAT/concurrency test terhadap database non-production belum dilakukan.
