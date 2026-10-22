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

**Perbedaan penting (riwayat):** snapshot 17 Oktober 2026 masih berisi modul shipment dan relasi invoice ke shipment. Itu implementasi legacy, bukan model target. Per 23 Oktober 2026 objek shipment sudah dihapus dari Production oleh migration `20261017185346` dan invoice memakai model D-10 dari SO — remote kini sudah mengikuti model target.

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

## 6. Snapshot schema dan data remote

Status terkini (23 Oktober 2026): 24 migration remote, 27 tabel publik dengan RLS aktif, objek shipment legacy sudah tidak ada. Record yang teramati: 2 customer, 1 supplier, 2 produk, 1 harga khusus, 5 SO `confirmed` (6 baris), 3 PO (4 baris), 3 invoice pelanggan `issued` (4 baris), 1 faktur supplier, 2 customer payment, 1 supplier payment, 10 akun COA, profile posting `approved` (21 Oktober 2026), 10 account mapping, 1 periode, 4 entri jurnal (9 baris), 0 alamat kirim pelanggan, 0 rekening bank supplier, 0 entri audit trail. Dua SO `confirmed` belum memiliki invoice (D-05).

Snapshot historis 17 Oktober 2026 (tidak menggantikan status di atas):

Project Jena Medical Center (sjiezdyxylwvqessyvml) berstatus aktif. Audit baca-saja mengonfirmasi 9 migration remote dan 27 tabel publik, semuanya memakai RLS dan memiliki policy.

Record yang teramati: 1 customer, 1 supplier, 2 produk, 1 harga khusus, 2 SO confirmed, 2 baris SO, 1 PO sent, 1 shipment shipped, 1 customer payment recorded, 1 supplier payment recorded, 10 akun COA, profile posting draft, 0 account mapping, 0 periode, 0 jurnal, 0 invoice pelanggan, dan 0 faktur supplier.

**Instruksi pemilik untuk D-09 (sudah dilaksanakan di schema):** hapus seluruh record dan objek shipment legacy secara langsung. Tabel payments/allocations tidak dihapus dan tidak ikut dalam penghapusan shipment.

## 7. Migration remote

D-11 menetapkan arsip migration harus sesuai history remote: nama file `<version>_<name>.sql` dan isi SQL identik dengan `supabase_migrations.schema_migrations.statements`. Per 23 Oktober 2026 arsip lokal sudah sinkron **24/24** dengan remote (verifikasi md5 per file). Daftar lengkap dengan catatan status ada di `SUPABASE_INTEGRATION.md` bagian 5; ringkasannya:

1. `20261016125928_dropship_suppliers_orders`
2. `20261016130021_dropship_foreign_key_indexes`
3. `20261016132858_customer_product_price_history`
4. `20261016134859_supplier_invoice_capture`
5. `20261016171001_dropship_shipment_tracking` — legacy; objeknya dihapus oleh `20261017185346` (D-09)
6. `20261016175827_customer_invoices_per_delivery_drafts` — legacy; diganti model D-10
7. `20261016205342_auto_customer_invoice_on_delivery_drafts` — legacy; trigger dihapus oleh `20261017185346`
8. `20261016215508_payments_and_invoice_allocations`
9. `20261016225329_accounting_posting_framework`
10. `20261017185346_d10_invoice_from_sales_order_drop_shipment_module` — D-09/D-10 dasar
11. `20261021184121_d10_auto_draft_edit`
12. `20261021184128_d10_invoice_lock_order`
13. `20261021184134_d10_invoice_value_cap`
14. `20261021184138_d10_create_invoice_value_cap`
15. `20261021184142_d10_future_dated_so_invoice_date`
16. `20261021195006_supplier_invoice_direct_capture`
17. `20261021203053_accounting_configuration_mapping_upsert`
18. `20261021223550_masterdata_enhancements_tables`
19. `20261021223601_masterdata_enhancements_price_edit`
20. `20261021223610_masterdata_enhancements_price_end_delete`
21. `20261022013453_20261022070000_masterdata_code_immutability`
22. `20261022013524_20261022080000_masterdata_generate_code_rpc`
23. `20261022013530_20261022090000_masterdata_price_update_lock`
24. `20261022013534_20261022100000_masterdata_audit_trail`

Migration `20261017185346` (sebelumnya disiapkan dengan nama arsip `20261017150000_...`) sudah diterapkan ke remote: ia menghapus objek/record shipment legacy, melepas relasi shipment dari invoice, dan mengganti RPC agar invoice dibuat manual dari SO. Pembayaran pelanggan/supplier dipertahankan. Jangan mengubah isi migration yang sudah diterapkan.

## 8. Kondisi security/performance yang perlu ditinjau

- 27 tabel publik memakai RLS aktif dan memiliki policy; tidak ditemukan grant SELECT tabel publik untuk anon.
- Advisor menampilkan 36 fungsi SECURITY DEFINER yang dapat dieksekusi role `authenticated`. Review 23 Oktober 2026 memastikan seluruhnya memakai `set search_path = ''`, gate role Owner/Admin, dan grant hanya ke `authenticated`; tidak ada SQL dinamis. Rincian: `SECURITY_DEFINER_REVIEW.md`.
- Supabase Auth leaked-password protection masih nonaktif — wajib diaktifkan sebelum penggunaan meluas.
- Performance Advisor: 26 foreign key tanpa covering index dan 30 indeks belum terpakai (INFO); jangan menambah/menghapus indeks otomatis.
- Performance Advisor menandai 20 foreign key tanpa indeks dan 46 indeks unused. Jangan melakukan perubahan massal tanpa evaluasi dampak.
- Backup/restore, audit log umum, laporan GL lengkap, dan UAT role-based end-to-end belum terverifikasi sebagai siap cutover.

## 9. Rencana implementasi berikutnya

1. Jalankan D-09: hapus objek serta record shipment legacy dan RPC/trigger terkait; penghapusan tidak menunggu backup sebagai prasyarat.
2. Jalankan D-10 bersamaan: ubah schema/RPC/UI invoice agar dibuat manual dari SO terkonfirmasi dengan batas kumulatif database.
3. Pertahankan tabel dan record pembayaran pelanggan/supplier.
4. Verifikasi RLS, policy, constraint, fungsi/trigger, hitungan data yang tersisa dan route.
5. Konfigurasi profil pajak, COA/mapping, approval policy, dan periode; jalankan UAT/rekonsiliasi sebelum posting atau cutover.

## 10. Catatan historis pengembangan (bukan status terkini)

Bagian fase dalam versi lama dokumen ini (harga khusus, capture Faktur Supplier, shipment, invoice per shipment, trigger auto-invoice, dan framework posting) adalah rekam jejak pengembangan. Bagian historis tentang shipment, invoice per shipment, serta auto-invoice berbasis delivered **dibatalkan sebagai desain target pada 17 Oktober 2026 oleh D-09/D-10**. Implementasi legacy sudah dihapus dari Production oleh migration `20261017185346`. Untuk kondisi saat ini gunakan bagian 6–8 dan DATABASE_INTEGRATION_READINESS.md.
