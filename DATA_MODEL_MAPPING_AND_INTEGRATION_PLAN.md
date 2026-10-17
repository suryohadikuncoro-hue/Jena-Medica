# Pemetaan Model Data dan Rencana Integrasi — Jena Medical Center

**Diperbarui:** 17 Oktober 2026  
**Tujuan dokumen:** membedakan model target yang disetujui dari skema legacy yang masih terpasang.  
**Sumber keputusan:** PRODUCT_SPEC.md (D-01–D-11), kebijakan rinci di ACCOUNTING_POLICY_AND_CUTOVER.md.  
**Snapshot remote:** gunakan DATABASE_INTEGRATION_READINESS.md dan SUPABASE_INTEGRATION.md; jangan memakai uraian fase historis di bagian 10 sebagai status terkini.

## 1. Prinsip domain target

Jena adalah distributor barang medis B2B dengan model drop-ship. Supplier mengirim langsung ke pelanggan di luar sistem. Aplikasi tidak mencatat pengiriman, penerimaan barang, stok gudang, batch, atau FEFO.

Alur target:

sales_order → satu atau beberapa purchase_order → supplier_invoice → satu atau beberapa sales_invoice yang dibuat manual dari SO → customer/supplier payments dan allocations → journal_entries / journal_lines → laporan.

Invoice pelanggan tidak mempunyai relasi ke shipment. Satu SO dapat memiliki beberapa invoice; database harus menjaga bahwa total kuantitas dan nilai dari invoice aktif tidak melampaui SO. Harga transaksi mengambil snapshot pada SO. Draft invoice tidak menghasilkan pendapatan/piutang; pendapatan dan piutang timbul saat invoice diterbitkan sesuai kebijakan akuntansi.

**Perbedaan penting:** schema remote pada snapshot audit masih berisi modul shipment dan relasi invoice ke shipment. Itu adalah implementasi legacy, bukan model target, dan belum dihapus oleh PR dokumentasi.

## 2. Pemetaan layar ke entitas target

| Layar target | Entitas utama | Aturan inti |
|---|---|---|
| Dashboard | Read model SO/PO/invoice/payment/journal | KPI keuangan hanya dari jurnal yang sudah dibukukan; data operasional diberi label |
| Pelanggan | customers, kontak dan harga pelanggan | Identitas, termin, limit kredit opsional, status aktif |
| Supplier | suppliers | Identitas, kontak, status pajak/termin dan rekening bila dibutuhkan |
| Barang | products | Kode/satuan; bukan saldo stok/batch |
| Harga per pelanggan | customer_product_prices | Histori harga efektif dan snapshot pada baris SO |
| Pesanan pelanggan | sales_orders, sales_order_lines | Harga snapshot, diskon, quantity dan override yang terlacak |
| Order supplier | purchase_orders, purchase_order_lines | Bisa split supplier; setiap baris melacak SO-line; tidak menambah stok |
| Faktur supplier | supplier_invoices, supplier_invoice_lines | Capture angka faktur asli, relasi PO-line, hitung usulan dan rekonsiliasi sesuai D-01 |
| Invoice pelanggan | sales_invoices, sales_invoice_lines | Dibuat manual dari SO terkonfirmasi; boleh parsial; tanpa shipment_id; kuantitas/nilai kumulatif dibatasi SO |
| Pembayaran | customer_payments, supplier_payments dan tabel allocation | Capture gerakan dana, uang muka, alokasi parsial/multi-invoice dengan locking/idempotency |
| Akuntansi | chart_of_accounts, accounting_posting_profile, accounting_account_mappings, accounting_periods, journal_entries, journal_lines | Approval gate, jurnal seimbang dan periode terbuka; konfigurasi wajib sebelum posting |
| Audit/dokumen | audit event, attachment, document sequence | Implementasi hanya dianggap aktif setelah schema, access control, storage, dan retensi terverifikasi |

## 3. ERD konseptual target

~~~mermaid
erDiagram
  CUSTOMER ||--o{ CUSTOMER_PRODUCT_PRICE : priced
  PRODUCT ||--o{ CUSTOMER_PRODUCT_PRICE : priced
  CUSTOMER ||--o{ SALES_ORDER : places
  SALES_ORDER ||--|{ SALES_ORDER_LINE : contains
  PRODUCT ||--o{ SALES_ORDER_LINE : identifies
  SALES_ORDER_LINE ||--o{ PURCHASE_ORDER_LINE : sourced_by
  SUPPLIER ||--o{ PURCHASE_ORDER : receives
  PURCHASE_ORDER ||--|{ PURCHASE_ORDER_LINE : contains
  SUPPLIER ||--o{ SUPPLIER_INVOICE : issues
  SUPPLIER_INVOICE ||--|{ SUPPLIER_INVOICE_LINE : contains
  PURCHASE_ORDER_LINE ||--o{ SUPPLIER_INVOICE_LINE : matched_to
  SALES_ORDER ||--o{ SALES_INVOICE : billed_by
  SALES_INVOICE ||--|{ SALES_INVOICE_LINE : contains
  SALES_ORDER_LINE ||--o{ SALES_INVOICE_LINE : billed_from
  CUSTOMER_PAYMENT ||--o{ CUSTOMER_PAYMENT_ALLOCATION : allocated
  SALES_INVOICE ||--o{ CUSTOMER_PAYMENT_ALLOCATION : settled
  SUPPLIER_PAYMENT ||--o{ SUPPLIER_PAYMENT_ALLOCATION : allocated
  SUPPLIER_INVOICE ||--o{ SUPPLIER_PAYMENT_ALLOCATION : settled
  JOURNAL_ENTRY ||--|{ JOURNAL_LINE : has
  ACCOUNT ||--o{ JOURNAL_LINE : account
~~~

ERD ini menggambarkan model target. Nama tabel/fungsi aktual harus diperiksa dari schema Supabase sebelum menulis perubahan. Tidak boleh sekadar menghapus shipment_id tanpa memeriksa constraint, RPC, trigger, foreign key, route, dan data terkait.

## 4. Aturan integritas data target

- Nomor dokumen harus unik dan dihasilkan dengan cara aman terhadap request bersamaan.
- Snapshot harga, produk, satuan dan nilai transaksi tidak boleh berubah bila master berubah.
- PO dapat dipecah antar supplier, tetapi kuantitas gabungan PO-line terkait tidak boleh melewati kuantitas SO kecuali ada aturan override eksplisit yang disetujui.
- Invoice pelanggan dibuat manual dari SO terkonfirmasi; per-barang dan nilai kumulatif invoice aktif tidak boleh melampaui SO. Setiap invoice menautkan SO-line, bukan shipment-line.
- Faktur supplier adalah capture angka sesuai dokumen sumber. Selisih dan perlakuan pajak mengikuti ACCOUNTING_POLICY_AND_CUTOVER.md; tidak menebak pajak dari status supplier.
- Alokasi pembayaran tidak boleh melebihi sisa dana atau saldo invoice. Gunakan locking dan idempotency.
- Posting jurnal harus debit=kredit, atomik, idempotent, terhubung ke sumber, dan hanya pada periode terbuka. Jurnal yang sudah dibukukan tidak diubah/hapus.
- RLS dan role check server-side harus tetap berlaku pada semua tabel/RPC; menyembunyikan tombol di UI bukan kontrol otorisasi.

## 5. Aturan akuntansi target

Detail formula dan contoh jurnal berada di ACCOUNTING_POLICY_AND_CUTOVER.md; ringkasannya:

- AP supplier diakui melalui posting faktur supplier yang lolos rekonsiliasi dan gate.
- Clearing supplier tidak sama dengan stok gudang. Reklasifikasi ke HPP mengikuti kebijakan modal efektif dan saat penerbitan invoice.
- Pendapatan/piutang diakui ketika invoice pelanggan diterbitkan, bukan ketika SO dikonfirmasi atau draft dibuat.
- Pembayaran awal yang belum dialokasikan tetap uang muka; receipt/disbursement operasional tidak otomatis menghasilkan jurnal.
- Retur/koreksi invoice terbit memerlukan nota kredit atau dokumen koreksi yang terhubung. Jangan mengubah jurnal lama secara langsung.
- Dashboard tidak boleh menampilkan KPI laba/kas/piutang sebagai angka buku besar bila sumbernya hanya dokumen operasional.

## 6. Snapshot schema dan data remote (17 Oktober 2026)

Project Jena Medical Center (sjiezdyxylwvqessyvml) berstatus aktif. Audit baca-saja mengonfirmasi 9 migration remote dan 27 tabel publik, semuanya memakai RLS dan memiliki policy.

Record yang teramati: 1 customer, 1 supplier, 2 produk, 1 harga khusus, 2 SO confirmed, 2 baris SO, 1 PO sent, 1 shipment shipped, 1 customer payment recorded, 1 supplier payment recorded, 10 akun COA, profile posting draft, 0 account mapping, 0 periode, 0 jurnal, 0 invoice pelanggan, dan 0 faktur supplier.

**Instruksi pemilik untuk D-09:** hapus seluruh record dan objek shipment legacy secara langsung. Tabel payments/allocations tidak dihapus dan tidak ikut dalam penghapusan shipment.

## 7. Migration remote

Version ID yang benar pada remote (arsip lokal harus memakai prefix yang sama):

1. 20261016125928_dropship_suppliers_orders
2. 20261016130021_dropship_foreign_key_indexes
3. 20261016132858_customer_product_price_history
4. 20261016134859_supplier_invoice_capture
5. 20261016171001_dropship_shipment_tracking — legacy, akan dihapus mengikuti D-09.
6. 20261016175827_customer_invoices_per_delivery_drafts — legacy, akan diubah mengikuti D-10.
7. 20261016205342_auto_customer_invoice_on_delivery_drafts — legacy, akan dihapus mengikuti D-09/D-10.
8. 20261016215508_payments_and_invoice_allocations
9. 20261016225329_accounting_posting_framework

D-11 menetapkan arsip migration harus sesuai history remote. Rename file pada PR ini hanya menyamakan version ID; isi SQL tidak berubah, dan tidak ada migration/DDL dijalankan ke database.

## 8. Kondisi security/performance yang perlu ditinjau

- 27 tabel publik memakai RLS aktif dan memiliki policy; tidak ditemukan grant SELECT tabel publik untuk anon.
- Advisor menampilkan 33 warning fungsi SECURITY DEFINER yang dapat dieksekusi role authenticated. Audit role check pada fungsi-fungsi itu tidak menemukan RPC publik yang executable oleh anon; tetap lakukan review ulang.
- Supabase Auth leaked-password protection nonaktif.
- Performance Advisor menandai 20 foreign key tanpa indeks dan 46 indeks unused. Jangan melakukan perubahan massal tanpa evaluasi dampak.
- Backup/restore, audit log umum, laporan GL lengkap, dan UAT role-based end-to-end belum terverifikasi sebagai siap cutover.

## 9. Rencana implementasi berikutnya

1. Selesaikan backup serta klasifikasi data yang ada.
2. Dalam PR teknis terpisah, hapus modul shipment beserta RPC/trigger/relasinya sesuai D-09 setelah data terdampak disetujui.
3. Ubah schema/RPC/UI invoice supaya dibuat manual dari SO terkonfirmasi, dengan batas kumulatif database sesuai D-10.
4. Uji migrasi dan alur baru; verifikasi RLS, policy, constraint, fungsi/trigger, hitungan record dan route.
5. Konfigurasi profil pajak, COA/mapping, approval policy, dan periode; jalankan UAT/rekonsiliasi sebelum posting atau cutover.

## 10. Catatan historis pengembangan (bukan status terkini)

Bagian fase dalam versi lama dokumen ini (harga khusus, capture Faktur Supplier, shipment, invoice per shipment, trigger auto-invoice, dan framework posting) adalah rekam jejak pengembangan. Bagian historis tentang shipment, invoice per shipment, serta auto-invoice berbasis delivered **dibatalkan sebagai desain target pada 17 Oktober 2026 oleh D-09/D-10**. Implementasi legacy tetap tercatat di database sampai perubahan teknis terkontrol dijalankan. Untuk kondisi saat ini gunakan bagian 6–8 dan DATABASE_INTEGRATION_READINESS.md.
