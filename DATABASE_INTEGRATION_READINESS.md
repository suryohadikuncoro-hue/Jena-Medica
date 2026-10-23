# Kesiapan Integrasi Database — Jena Medical Center

**Status Production — pemeriksaan baca-saja diperbarui 24 Oktober 2026:** Supabase remote terakhir mencatat **28 migration**; direktori `supabase/migrations/` di `main` juga berisi **28 file**. Seluruh objek shipment legacy sudah tidak ada. Migration D-10 aktif pada pemeriksaan RPC sebelumnya, termasuk draf otomatis, edit draf, lock order, batas nilai kumulatif, dan tanggal invoice masa depan. **Sinkronisasi isi SQL/hash 28/28 belum dibuktikan ulang**; versi/nama beberapa migration perlu direkonsiliasi sebelum klaim D-11 dianggap tuntas. Commit `main` terakhir yang diperiksa adalah `e99fb3e6f4cc97c9d5d9ba8360ea1d64ab49d422`; Quality Checks run #129 lulus untuk lint, build Next.js, dan build Cloudflare Worker. Deployment Cloudflare terbaru teramati pada 23 Oktober, tetapi pemetaan deployment ke commit tersebut belum terverifikasi.

**Belum dianggap selesai untuk cutover:** perlindungan kata sandi bocor Supabase Auth masih nonaktif; 2 SO `confirmed` belum memiliki invoice dan belum diklasifikasi data uji vs riil (D-05); UAT guard nilai kumulatif jalur create, concurrency, pembulatan lintas invoice; UAT UI ber-role Owner/Admin/Viewer; backup/restore teruji; dan UAT end-to-end aplikasi live. Bagian bertanda *snapshot historis* adalah catatan lama dan tidak menggantikan status ini.

**Mode audit terakhir:** baca-saja; tidak menjalankan DDL, migration, pembersihan data, atau deployment.  
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status Supabase `ACTIVE_HEALTHY`, region `ap-northeast-1`, PostgreSQL 17.11.  
**Aturan:** keputusan produk yang disahkan ada di `PRODUCT_SPEC.md`; dokumen ini merekam kondisi remote teramati dan tidak menggantikan keputusan tersebut.

## 1. Status skema dan migration remote

Supabase mencatat **28 migration remote** pada pemeriksaan 24 Oktober 2026. Jumlah tabel publik 27 adalah snapshot audit 23 Oktober dan belum dihitung ulang pada pemeriksaan ini. Semua tabel publik memiliki RLS aktif dan policy; audit tidak menemukan grant `SELECT` pada tabel publik untuk role `anon`. Jumlah file arsip dan entri remote sama-sama 28, tetapi kesamaan isi SQL/hash per file belum diverifikasi ulang. D-11 belum boleh ditandai tuntas sampai version ID, nama, dan isi SQL seluruhnya dibandingkan.

| Version | Name | Status remote |
|---|---|---|
| `20261016125928` | `dropship_suppliers_orders` | Tercatat |
| `20261016130021` | `dropship_foreign_key_indexes` | Tercatat |
| `20261016132858` | `customer_product_price_history` | Tercatat |
| `20261016134859` | `supplier_invoice_capture` | Tercatat |
| `20261016171001` | `dropship_shipment_tracking` | Tercatat; objeknya dihapus oleh `20261017185346` (D-09) |
| `20261016175827` | `customer_invoices_per_delivery_drafts` | Tercatat; desain invoice lama diganti model D-10 |
| `20261016205342` | `auto_customer_invoice_on_delivery_drafts` | Tercatat; trigger dihapus oleh `20261017185346` |
| `20261016215508` | `payments_and_invoice_allocations` | Tercatat |
| `20261016225329` | `accounting_posting_framework` | Tercatat |
| `20261017185346` | `d10_invoice_from_sales_order_drop_shipment_module` | Diterapkan; D-09/D-10 dasar |
| `20261021184121` | `d10_auto_draft_edit` | Diterapkan |
| `20261021184128` | `d10_invoice_lock_order` | Diterapkan |
| `20261021184134` | `d10_invoice_value_cap` | Diterapkan |
| `20261021184138` | `d10_create_invoice_value_cap` | Diterapkan |
| `20261021184142` | `d10_future_dated_so_invoice_date` | Diterapkan |
| `20261021195006` | `supplier_invoice_direct_capture` | Diterapkan |
| `20261021203053` | `accounting_configuration_mapping_upsert` | Diterapkan |
| `20261021223550` | `masterdata_enhancements_tables` | Diterapkan |
| `20261021223601` | `masterdata_enhancements_price_edit` | Diterapkan |
| `20261021223610` | `masterdata_enhancements_price_end_delete` | Diterapkan |
| `20261022013453` | `20261022070000_masterdata_code_immutability` | Diterapkan |
| `20261022013524` | `20261022080000_masterdata_generate_code_rpc` | Diterapkan |
| `20261022013530` | `20261022090000_masterdata_price_update_lock` | Diterapkan |
| `20261022013534` | `20261022100000_masterdata_audit_trail` | Diterapkan |
| `20261022182537` | `d10_jakarta_transaction_dates` | Tercatat di Production; versi file arsip di repo adalah `20261023011500` sehingga version ID tidak cocok dan perlu direkonsiliasi tanpa mengubah history remote |
| `20261023071935` | `supplier_invoice_attachments` | Tercatat; perlu UAT bucket/RLS/unggah/OCR |
| `20261023071956` | `supplier_approval_before_sales_order_confirmation` | Tercatat; nama/versi berbeda dari catatan lama yang menyebut `20261023104500` |
| `20261023072030` | `supplier_ap_reconciliation_gate` | Tercatat; pastikan ACL RPC lama dan baru diverifikasi terpisah |

Nama arsip = `<version>_<name>.sql`; empat entri terakhir memakai `name` yang sudah mengandung timestamp sehingga nama filenya berprefix ganda secara sengaja. Perubahan nama arsip bukan migration database dan tidak mengubah schema/data remote.

## 2. Snapshot data remote yang diaudit

Hitungan berikut berasal dari query baca-saja pada 23 Oktober 2026:

| Tabel/kelompok | Jumlah / status yang teramati |
|---|---|
| `customers` / `suppliers` / `products` | 2 / 1 / 2 |
| `customer_product_prices` | 1 |
| `sales_orders` | 5; semua `confirmed` |
| `sales_order_lines` | 6 |
| `purchase_orders` / `purchase_order_lines` | 3 / 4 |
| `sales_invoices` / `sales_invoice_lines` | 3 (0 draft, 3 `issued`) / 4 |
| `supplier_invoices` / `supplier_invoice_lines` | 1 (0 draft) / 1 |
| `customer_payments` / `supplier_payments` | 2 / 1 |
| Allocation batches/allocations | 1 + 1 (pelanggan), 1 + 1 (supplier) |
| `chart_of_accounts` | 10 akun |
| `accounting_posting_profile` | 1; status `approved` (21 Oktober 2026) |
| `accounting_account_mappings` | 10 |
| `accounting_periods` | 1 |
| `journal_entries` / `journal_lines` | 4 / 9 |
| `customer_shipping_addresses` / `supplier_bank_accounts` / `master_data_change_log` | 0 / 0 / 0 |

Dua SO `confirmed` belum memiliki invoice sama sekali; keduanya belum di-backfill karena status data uji vs transaksi riil harus dipastikan dahulu (D-05). Catatan payment `recorded` adalah pencatatan operasional, bukan otomatis jurnal kas/bank atau bukti pelunasan invoice.

**Instruksi pemilik untuk D-09 (sudah dilaksanakan di schema):** record shipment legacy dihapus bersama objeknya; tabel/record pembayaran pelanggan dan supplier tetap dipertahankan.

## 3. Status kebijakan dan posting

- Kerangka akuntansi terpasang penuh; profil posting berstatus `approved` dengan referensi kebijakan terisi (disetujui 21 Oktober 2026).
- COA 10 akun dan mapping 10 sudah terisi; periode 1 tercatat; 4 entri jurnal dengan 9 baris jurnal sudah ada.
- Gate database untuk posting aktif, tetapi **kualitas data dan rekonsiliasi jurnal belum diverifikasi** — jangan menganggap angka laporan final sebelum UAT dan rekonsiliasi selesai.
- Masih ada 2 SO `confirmed` tanpa invoice (D-05), sehingga jalur draf otomatis untuk SO lama perlu keputusan: backfill terkontrol atau dokumentasikan sebagai pengecualian.
- Kerangka hanya mendukung jalur yang implementasinya ada dalam migration saat ini. Pengakuan HPP, nota kredit, laporan buku besar lengkap, audit log umum, dan workflow lain yang disebut kebijakan tidak boleh diklaim selesai bila belum dibangun.

## 4. D-09 dan D-10: keputusan target vs kondisi saat ini

**D-09 — tidak ada pencatatan pengiriman.** Tabel `shipments`, `shipment_lines`, `shipment_status_events`, RPC `create_shipment`/`transition_shipment`, dan trigger auto-invoice sudah dihapus dari Production oleh migration `20261017185346`. Aplikasi tidak memiliki route/komponen pengiriman.

**D-10 — invoice manual berbasis SO.** Seluruh komponen aktif di Production: draf otomatis saat SO dikonfirmasi (idempoten), edit draf, lock order anti race, batas kumulatif kuantitas/nilai pada jalur create dan edit, serta dukungan tanggal invoice di masa depan. Sisa pekerjaan: UAT guard nilai kumulatif lintas beberapa invoice, uji concurrency, uji pembulatan, dan UAT UI ber-role.

Jangan mengembangkan alur shipment baru. D-09/D-10 telah disetujui dan sudah diterapkan; record pembayaran tetap dipertahankan.

## 5. Keamanan dan Advisor

Audit baca-saja 23 Oktober 2026 mendapatkan:

- Semua 27 tabel publik: RLS aktif, masing-masing memiliki policy, dan tidak ditemukan grant `SELECT` tabel publik untuk `anon`.
- 36 public `SECURITY DEFINER` function yang dapat dieksekusi oleh `authenticated` dilaporkan Security Advisor. Review menyeluruh menemukan seluruhnya memakai `set search_path = ''`, menguji role Owner/Admin via `app_private.has_business_role` berbasis `app_metadata`, membatasi grant ke `authenticated`, dan tidak memakai SQL dinamis. Rincian dan risiko sisanya: `SECURITY_DEFINER_REVIEW.md`.
- Supabase Auth: **perlindungan kata sandi bocor masih dinonaktifkan** — perlu diaktifkan sebelum penggunaan meluas, lalu jalankan ulang Security Advisor.
- Performance Advisor: 26 foreign key tanpa covering index dan 30 indeks belum terpakai (INFO). Jangan membuat/menghapus indeks otomatis berdasarkan warning; verifikasi beban query dahulu.

Ini snapshot advisor saat audit; jalankan ulang setelah perubahan schema dan sebelum cutover.

## 6. Aplikasi, validasi, dan batas verifikasi

- Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role key tidak boleh dipakai di browser.
- Route shipment sudah dihapus; pembayaran tersedia di `/pembayaran`; invoice pelanggan dibuat dari SO terkonfirmasi.
- Deployment live `https://jena-medica.fa-mitra.my.id` sudah diverifikasi pada 23 Oktober 2026 (HTTP 200, `server: cloudflare`, marker UI terbaru di HTML). Uji transaksi UI pada deployment live belum dilakukan.
- Framework akuntansi memiliki approval gate; UAT UI end-to-end ber-role Owner/Admin/Viewer belum dilakukan.
- Jangan mengklaim lint/build lulus dari dokumen historis tanpa menjalankannya kembali pada commit yang sedang direview.

## 7. Prasyarat sebelum cutover

1. Backup database lengkap dan uji pemulihan pada project terisolasi.
2. Klasifikasi data uji vs transaksi riil (D-05), termasuk 2 SO tanpa invoice, record payment, dan 4 entri jurnal yang ada; putuskan backfill atau dokumentasikan sebagai pengecualian.
3. Aktifkan Leaked Password Protection dan tindak lanjuti rekomendasi `SECURITY_DEFINER_REVIEW.md`.
4. Isi/lengkapi profil pajak dari dokumen perusahaan, review klasifikasi barang, dan pastikan mapping COA serta periode sesuai kebijakan yang disetujui.
5. UAT bisnis dan role-based, rekonsiliasi jurnal, pengujian idempotensi/concurrency/pembulatan/reversal, dan review Advisor.
6. Catat persetujuan Owner dan hasil pemeriksaan sebelum menganggap sistem siap operasional.

---

## Snapshot historis (tidak menggantikan status di atas)

- **22 Oktober 2026:** 15 migration tercatat; lima migration D-10 diterapkan; uji transaksional awal lulus dengan `ROLLBACK`; deployment live belum dapat diverifikasi.
- **21 Oktober 2026:** 10 migration tercatat; arsip dasar D-09/D-10 diselaraskan ke `20261017185346`; migration lanjutan D-10 saat itu belum diterapkan.
- **17 Oktober 2026:** 9 migration, 27 tabel publik, 1 shipment `shipped`, 2 SO `confirmed`, 0 invoice, profil posting `draft`, mapping/periode/jurnal 0.
