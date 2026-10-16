# Kesiapan Integrasi Database — Jena Medical Center

**Diperbarui:** 16 Oktober 2026
**Status:** UI drop-ship dalam refaktor; belum siap untuk transaksi produksi.
**Supabase terhubung:** proyek `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif; pada inspeksi read-only schema `public` belum berisi tabel.

## Keputusan domain terkini

Model resmi yang diminta adalah **drop-ship tanpa stok fisik Jena**. Supplier mengirim langsung ke alamat pelanggan yang berasal dari pesanan. Karena itu, spesifikasi lama mengenai gudang, penerimaan stok, batch, FEFO, expiry, karantina, picking, stock allocation, stock ledger dan pengembalian ke stok **sudah tidak berlaku untuk aplikasi ini**. Dokumen pemetaan lama yang menyebut konsep tersebut digantikan oleh `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md` yang diperbarui.

Alur proses: Sales Order → PO supplier (dapat terpecah) → supplier invoice/cost aktual → shipment supplier-ke-pelanggan → sales invoice → customer payment → jurnal/laporan.

## Kondisi saat ini

- UI sebelumnya terdiri dari data hard-coded dan state lokal. Branch `feat/dropship-ui-foundation` memperkenalkan shared top navigation, tema terang/gelap, pencarian menu, quick-create, layar Pesanan Pelanggan, Dashboard, PO/Faktur Supplier, Master Data, Pengiriman/Pembayaran, dan ringkasan Keuangan.
- Layar branch tersebut tetap prototipe: belum membaca/menulis database dan sebagian tindakan/form hanya untuk review UI.
- Belum ada tabel `public`, migrasi, autentikasi aplikasi, RLS, atau transaksi akuntansi aktual yang dibuat oleh refaktor UI.
- Data contoh tidak konsisten atau tidak valid sebagai saldo akuntansi. Jangan migrasikan data demo menjadi data produksi.
- Build dan lint perlu divalidasi ulang pada checkpoint terbaru sebelum merge.

## Gerbang sebelum persistensi

1. Tentukan DBMS/platform dan environment dev/test/produksi secara eksplisit; pastikan proyek Supabase ini memang target pengembangan sebelum memuat data nyata.
2. Finalisasi skema relasional drop-ship, constraints, strategi nomor dokumen, RLS, autentikasi, role Owner/Admin/Viewer dan kebijakan lampiran.
3. Sepakati aturan pajak dan akuntansi: status PKP/tarif efektif, pembulatan, diskon faktur, alokasi biaya supplier, kapan AP/HPP/pendapatan diakui, dan perilaku shipment/invoice parsial.
4. Implementasikan satu alur end-to-end pada environment non-produksi. Pastikan posting atomik, jurnal debit=kredit, idempotensi, audit, pembayaran parsial dan referensi SO-line → PO-line → supplier invoice line → shipment/invoice line.
5. Siapkan backup/restore, migration rollback, rekonsiliasi, serta test penerimaan sebelum cutover.

## Entitas sasaran konseptual

Master customer, supplier, product, customer-product price/version, account; sales order/line; purchase order/line; supplier invoice/line; direct shipment/line; customer payment/allocation; supplier payment/allocation; sales invoice/line; tax records; journal entry/line; accounting period; audit event; attachment; document sequence.

Tidak termasuk entitas stok fisik (warehouse, batch, goods receipt, stock movement/balance, FEFO allocation). Rincian relasi serta keputusan belum final dicatat dalam `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md`.

## Batasan audit

Pemeriksaan Supabase sebelumnya hanya membaca daftar tabel dan metadata proyek; bukan pemeriksaan keamanan runtime atau konfigurasi produksi. Dokumen ini bukan otorisasi untuk membuat migrasi atau mengubah database. Perubahan schema akan dilakukan setelah spesifikasi dan target environment disepakati.
