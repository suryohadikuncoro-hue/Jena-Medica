# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 17 Oktober 2026  
**Mode audit:** baca-saja; tidak menjalankan DDL, migration, pembersihan data, atau deployment.  
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status Supabase `ACTIVE_HEALTHY`, region `ap-northeast-1`.  
**Aturan:** keputusan produk yang disahkan ada di `PRODUCT_SPEC.md`; dokumen ini merekam kondisi remote teramati dan tidak menggantikan keputusan tersebut.

## 1. Status skema dan migration remote

Audit mencatat **9 migration remote** dan **27 tabel publik**. Semua tabel publik memiliki RLS aktif dan policy; audit juga tidak menemukan grant `SELECT` pada tabel publik untuk role `anon`.

Versi migration berikut adalah versi yang tercatat di Supabase. Arsip di `supabase/migrations/` harus memakai version ID yang sama dengan remote (D-11).

| Version ID | Migration | Status remote |
|---|---|---|
| `20261016125928` | `dropship_suppliers_orders` | Tercatat |
| `20261016130021` | `dropship_foreign_key_indexes` | Tercatat |
| `20261016132858` | `customer_product_price_history` | Tercatat |
| `20261016134859` | `supplier_invoice_capture` | Tercatat |
| `20261016171001` | `dropship_shipment_tracking` | Tercatat; objeknya akan dihapus sesuai D-09 |
| `20261016175827` | `customer_invoices_per_delivery_drafts` | Tercatat; desain invoice lama akan diubah sesuai D-10 |
| `20261016205342` | `auto_customer_invoice_on_delivery_drafts` | Tercatat; trigger lama ditargetkan dihapus sesuai D-09/D-10 |
| `20261016215508` | `payments_and_invoice_allocations` | Tercatat |
| `20261016225329` | `accounting_posting_framework` | Tercatat; framework ada tetapi gate posting belum dibuka |

PR dokumentasi memperbaiki nama arsip migration yang sebelumnya tidak sama dengan version ID remote. Isi SQL pada migration yang sudah diterapkan tidak berubah. Perubahan nama arsip bukan migration database dan tidak mengubah schema/data remote.

## 2. Snapshot data remote yang diaudit

Hitungan berikut berasal dari query baca-saja pada 17 Oktober 2026:

| Tabel/kelompok | Jumlah / status yang teramati |
|---|---|
| `customers` | 1 |
| `suppliers` | 1 |
| `products` | 2 |
| `customer_product_prices` | 1 |
| `sales_orders` | 2; keduanya `confirmed` |
| `sales_order_lines` | 2 |
| `purchase_orders` | 1; status `sent` |
| `shipments` | 1; status `shipped` |
| `sales_invoices` | 0 |
| `supplier_invoices` | 0 |
| `customer_payments` | 1; status `recorded` |
| `supplier_payments` | 1; status `recorded` |
| `chart_of_accounts` | 10 akun |
| `accounting_posting_profile` | 1; status `draft` |
| `accounting_account_mappings` | 0 |
| `accounting_periods` | 0 |
| `journal_entries` / `journal_lines` | 0 / 0 |

Shipment berstatus `shipped` bukan berarti delivered. Catatan pembayaran `recorded` adalah pencatatan operasional, bukan otomatis jurnal kas/bank atau bukti pelunasan invoice.

**Penting sebelum D-09 atau pembersihan data:** keputusan produk menargetkan penghapusan modul pengiriman. Namun audit menemukan 1 shipment dan masing-masing 1 record pembayaran pelanggan/supplier. Status apakah record tersebut data uji atau transaksi yang harus dipertahankan **belum terkonfirmasi**. Jangan menghapus tabel/baris atau melakukan cascade sebelum pemilik mengonfirmasi klasifikasi, backup, dan rencana retensi.

## 3. Status kebijakan dan posting

- Migration kerangka akuntansi sudah tercatat remote; tidak benar menyebutnya “belum diterapkan”.
- Profile posting masih `draft`; referensi kebijakan/approval belum lengkap.
- COA memiliki 10 baris, tetapi perlu disahkan dan dipetakan.
- Mapping akun: 0; periode: 0; jurnal: 0.
- Tidak ada invoice pelanggan atau faktur supplier pada snapshot audit; karena itu belum ada invoice/AP yang diposting atau jurnal dari transaksi.
- Kerangka hanya mendukung jalur yang implementasinya ada dalam migration saat ini. Pengakuan HPP, nota kredit, laporan buku besar lengkap, audit log umum, dan workflow lain yang disebut kebijakan tidak boleh diklaim selesai bila belum dibangun.

## 4. D-09 dan D-10: keputusan target vs kondisi saat ini

**D-09 — tidak ada pencatatan pengiriman.** Objek legacy saat audit masih ada: tabel `shipments`, `shipment_lines`, `shipment_status_events`, RPC terkait, dan trigger auto-invoice pada status delivered. Penghapusan membutuhkan perubahan schema/kode yang direncanakan, ditinjau, dan diterapkan secara terkontrol sesuai D-11.

**D-10 — invoice manual berbasis SO.** Schema saat ini masih mengharuskan `sales_invoices.shipment_id` dan RPC/trigger invoice draft bergantung pada shipment. Targetnya invoice manual dari SO terkonfirmasi, tanpa `shipment_id`, dapat parsial, dengan batas jumlah/nilai kumulatif yang dijaga database. Perubahan ini belum diimplementasikan hanya dengan menyetujui dokumen.

Jangan mengembangkan alur shipment baru. Jangan mulai perubahan schema sebelum data terdampak diinventarisasi dan backup dapat dipulihkan. PR ini tidak menjalankan perubahan database.

## 5. Keamanan dan Advisor

Audit baca-saja mendapatkan:

- Semua 27 tabel publik: RLS aktif, masing-masing memiliki policy, dan tidak ditemukan grant `SELECT` tabel publik untuk `anon`.
- 33 public `SECURITY DEFINER` function yang dapat dieksekusi oleh `authenticated` dilaporkan Advisor. Pemeriksaan SQL menemukan role check Owner/Admin di fungsi-fungsi tersebut dan tidak menemukan public RPC yang executable oleh `anon`. Warning Advisor tetap perlu ditinjau, bukan diabaikan otomatis.
- Supabase Auth: perlindungan kata sandi bocor dinonaktifkan; perlu review dan keputusan administrator.
- Performance Advisor: 20 foreign key tanpa indeks dan 46 indeks unused. Jangan membuat indeks atau menghapus indeks secara otomatis berdasarkan warning saja; verifikasi beban query dan dampaknya dahulu.

Ini snapshot advisor saat audit; jalankan ulang setelah perubahan schema dan sebelum cutover.

## 6. Aplikasi, validasi, dan batas verifikasi

- Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role key tidak boleh dipakai di browser.
- Route `/pengiriman-piutang` dan `/invoice-pelanggan` saat ini merepresentasikan implementasi lama berbasis shipment dan harus disesuaikan setelah D-09/D-10 diterapkan.
- Framework akuntansi memiliki approval gate, tetapi UAT UI end-to-end ber-role Owner/Admin/Viewer terhadap alur baru belum dilakukan.
- Audit ini tidak memverifikasi domain Cloudflare live, tidak menjalankan build, dan tidak menguji transaksi UI.
- Jangan mengklaim lint/build lulus dari dokumen historis tanpa menjalankannya kembali pada commit yang sedang direview.

## 7. Prasyarat sebelum cutover

1. Backup database lengkap dan uji pemulihan pada project terisolasi.
2. Klasifikasikan seluruh record yang akan dipertahankan/dibersihkan, khususnya shipment dan pembayaran yang terlihat pada snapshot.
3. Terapkan D-09/D-10 melalui perubahan schema/kode yang ditinjau, lalu verifikasi ulang RLS, policy, constraint, RPC, trigger, jumlah baris, dan route.
4. Isi profil pajak dari dokumen perusahaan, review klasifikasi barang, setujui/mapping COA, referensi kebijakan, dan periode.
5. UAT bisnis dan role-based, rekonsiliasi, pengujian idempotensi/concurrency/reversal, dan review Advisor.
6. Catat persetujuan Owner dan hasil pemeriksaan sebelum mengaktifkan posting atau menganggap sistem siap operasional.

Tidak ada perubahan database, data, atau deployment dilakukan dalam audit maupun PR dokumentasi ini.
