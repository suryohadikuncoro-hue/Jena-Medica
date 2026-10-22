# Kesiapan Integrasi Database — Jena Medical Center

**Status Production terverifikasi — 23 Oktober 2026 (audit baca-saja):** Supabase remote mencatat **24 migration** dan **27 tabel publik**; seluruh tabel publik memiliki RLS aktif. Objek shipment legacy sudah dihapus (D-09 selesai di schema). Seluruh migration D-10 aktif (draf otomatis, edit draf, lock order, batas nilai kumulatif, tanggal invoice masa depan), begitu pula migration master data dan audit trail. Arsip `supabase/migrations/` sinkron 24/24 dengan history remote (version, name, dan md5 SQL identik). Deployment live `https://jena-medica.fa-mitra.my.id` terverifikasi menjalankan commit `main` terkini (build Cloudflare `3a8ecc7e`, commit `ea42494`). CI `main` lulus untuk lint, build Next.js, dan build Cloudflare Worker.

**Belum dianggap selesai untuk cutover:** perlindungan kata sandi bocor Supabase Auth masih nonaktif; 2 SO `confirmed` belum memiliki invoice dan belum diklasifikasi data uji vs riil (D-05); UAT guard nilai kumulatif jalur create, concurrency, pembulatan lintas invoice; UAT UI ber-role Owner/Admin/Viewer; backup/restore teruji; dan UAT end-to-end aplikasi live. Bagian bertanda *snapshot historis* adalah catatan lama dan tidak menggantikan status ini.

**Mode audit terakhir:** baca-saja; tidak menjalankan DDL, migration, pembersihan data, atau deployment.  
**Project:** `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status Supabase `ACTIVE_HEALTHY`, region `ap-northeast-1`, PostgreSQL 17.11.  
**Aturan:** keputusan produk yang disahkan ada di `PRODUCT_SPEC.md`; dokumen ini merekam kondisi remote teramati dan tidak menggantikan keputusan tersebut.

## 1. Status skema dan migration remote

Supabase mencatat **24 migration remote** dan **27 tabel publik**. Semua tabel publik memiliki RLS aktif dan policy; audit tidak menemukan grant `SELECT` pada tabel publik untuk role `anon`. Arsip lokal memakai version ID dan isi SQL yang sama dengan remote (D-11) — terverifikasi per file melalui md5 `supabase_migrations.schema_migrations.statements`.

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
