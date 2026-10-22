# Supabase Integration — Jena Medical Center

**Status Production terverifikasi — 23 Oktober 2026 (audit baca-saja):** Supabase remote `Jena Medical Center` (`sjiezdyxylwvqessyvml`, `ACTIVE_HEALTHY`, `ap-northeast-1`, PostgreSQL 17.11) mencatat **24 migration** dan **27 tabel publik**; seluruh tabel publik memiliki RLS aktif. Objek shipment legacy (tabel, RPC, trigger auto-invoice) sudah tidak ada di remote — D-09 selesai di tingkat schema. Seluruh migration D-10 aktif: draf invoice otomatis saat SO dikonfirmasi, edit draf, lock order, batas nilai kumulatif jalur create/edit, dan dukungan tanggal invoice di masa depan. Migration master data (alamat kirim pelanggan, rekening bank supplier, generate/mutasi kode, lock update harga, audit trail) juga aktif.

**Arsip migration sinkron (D-11):** folder `supabase/migrations/` berisi **24 file** yang version ID, name, dan isi SQL-nya identik byte-per-byte (pemeriksaan md5 terhadap `supabase_migrations.schema_migrations.statements`) dengan history remote per 23 Oktober 2026. Aturan penamaan arsip: `<version>_<name>.sql`. Empat migration master data terakhir memakai `name` yang sudah mengandung timestamp lokal (mis. `20261022070000_masterdata_code_immutability`), sehingga nama filenya memang berprefix ganda — itu disengaja agar cocok persis dengan history remote.

**Deployment live terverifikasi — 23 Oktober 2026:** `https://jena-medica.fa-mitra.my.id` melayani aplikasi dari Cloudflare Worker `jena-medica` (build `3a8ecc7e-62f1-444e-9575-077dae81961f`, version `f6ee9b63-64ef-4b25-b0fe-cfbbbdf77c76`, commit merge `ea42494`). HTML live memuat markup navbar mobile Menu hasil PR #93 (`aria-label="Menu bawah"`, tombol `Menu`, panel `mobile-menu-panel`), sehingga deployment Production menjalankan kode `main` terkini. CI `main` lulus untuk lint, build Next.js, dan build Cloudflare Worker.

**Belum dianggap selesai untuk cutover:** perlindungan kata sandi bocor Supabase Auth masih nonaktif; UAT guard nilai kumulatif jalur create, concurrency, dan pembulatan lintas beberapa invoice; UAT UI ber-role Owner/Admin/Viewer; klasifikasi data uji vs transaksi riil (D-05) untuk 2 SO terkonfirmasi yang belum punya invoice serta record payment; dan UAT end-to-end pada aplikasi live. Bagian bertanda *snapshot historis* di bawah adalah catatan lama dan tidak menggantikan status ini.

## 1. Environment dan aturan sumber kebenaran

Target: project Supabase `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status `ACTIVE_HEALTHY`, region `ap-northeast-1`. Satu proyek saat ini mewakili satu perusahaan; schema belum mempunyai isolasi multi-tenant.

Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Publishable key tetap tunduk pada RLS. Service-role key tidak boleh berada di browser, Git, atau log. `.env.local` harus tetap diabaikan Git dan `.env.example` hanya berisi placeholder.

Login memakai Supabase Auth email/password; signup publik tidak dibuka. Otorisasi menggunakan claim tepercaya `app_metadata.business_role` dengan nilai `owner`, `admin`, atau `viewer`; jangan menggunakan `user_metadata` sebagai dasar otorisasi. Setelah perubahan claim, refresh token atau login kembali.

Dokumen keputusan: `PRODUCT_SPEC.md`. Kebijakan akuntansi/pajak: `ACCOUNTING_POLICY_AND_CUTOVER.md`. Status database terkini: `DATABASE_INTEGRATION_READINESS.md`. Review keamanan RPC: `SECURITY_DEFINER_REVIEW.md`. Supabase adalah sumber kebenaran schema sesuai D-11.

## 2. Skema remote saat audit (23 Oktober 2026)

Supabase mencatat 24 migration dan 27 tabel publik. Seluruh tabel publik memiliki RLS aktif dan policy; tidak ditemukan grant `SELECT` tabel publik untuk role `anon`.

| Kelompok | Tujuan/kondisi |
|---|---|
| `customers`, `suppliers`, `products` | Master bisnis dan barang; tidak menyimpan saldo stok |
| `customer_shipping_addresses`, `supplier_bank_accounts` | Alamat kirim pelanggan (dibaca viewer) dan rekening bank supplier (hanya owner/admin) |
| `customer_product_prices` | Riwayat harga per pelanggan-barang dengan mutasi/tutup/hapus harga terjadwal |
| `sales_orders`, `sales_order_lines` | SO dan snapshot harga |
| `purchase_orders`, `purchase_order_lines` | PO ke supplier, dapat dipecah berdasarkan SO line |
| `supplier_invoices`, `supplier_invoice_lines` | Capture faktur supplier langsung dari dokumen; belum menjadi AP/jurnal sampai posting |
| `customer_payments`, `supplier_payments` dan tabel allocation | Capture receipt/disbursement dan alokasi operasional; belum menjadi jurnal otomatis |
| `sales_invoices`, `sales_invoice_lines` | Model D-10: invoice manual dari SO terkonfirmasi, tanpa `shipment_id`, dengan batas kumulatif kuantitas/nilai |
| `chart_of_accounts`, `accounting_posting_profile`, `accounting_account_mappings`, `accounting_periods`, `journal_entries`, `journal_lines` | Kerangka akuntansi dengan gate konfigurasi |
| `master_data_change_log` | Audit trail perubahan master data |

Tabel `shipments`, `shipment_lines`, dan `shipment_status_events` beserta RPC/trigger terkait sudah dihapus oleh migration `20261017185346` (D-09). Jangan menambahkan kembali modul pengiriman.

Penerapan migration tidak otomatis berarti seluruh proses bisnis sudah aktif. Per 23 Oktober 2026, profil posting berstatus `approved` (disetujui 21 Oktober 2026), mapping akun 10, periode 1, dan terdapat 4 entri jurnal; namun UAT dan klasifikasi data (D-05) belum selesai.

## 3. Data aktual yang teramati (23 Oktober 2026)

Query baca-saja menemukan: `customers` 2, `suppliers` 1, `products` 2, `customer_product_prices` 1, `sales_orders` 5 (semua `confirmed`) dengan 6 baris, `purchase_orders` 3 dengan 4 baris, `supplier_invoices` 1 (0 draft) dengan 1 baris, `sales_invoices` 3 (0 draft, 3 `issued`) dengan 4 baris, `customer_payments` 2, `supplier_payments` 1, masing-masing 1 batch + 1 alokasi pembayaran pelanggan dan supplier, `chart_of_accounts` 10, `accounting_account_mappings` 10, `accounting_periods` 1, `journal_entries` 4 dengan `journal_lines` 9, serta `customer_shipping_addresses`, `supplier_bank_accounts`, `master_data_change_log` masih 0.

Dua SO `confirmed` belum memiliki invoice sama sekali; keduanya belum di-backfill karena status data uji vs transaksi riil harus dipastikan dahulu (D-05). Catatan payment `recorded` adalah pencatatan operasional, bukan otomatis jurnal kas/bank atau bukti pelunasan invoice.

**Instruksi D-09 dari pemilik (sudah dilaksanakan di schema):** objek dan record shipment legacy dihapus langsung. Tabel pembayaran pelanggan/supplier tetap dipertahankan; bukan bagian dari penghapusan shipment.

## 4. Keputusan target vs implementasi

### D-09 — pengiriman bukan tanggung jawab sistem

Keputusan final: hapus menu/halaman/komponen pengiriman, tabel shipment, RPC terkait, dan trigger invoice otomatis ketika shipment menjadi delivered. Jangan menambahkan tracking, resi, surat jalan, kurir, atau penerimaan barang.

Status 23 Oktober 2026: tabel shipment, `create_shipment`, `transition_shipment`, dan trigger auto-invoice sudah tidak ada di remote maupun di aplikasi. Kode aplikasi tidak lagi mengandalkan shipment.

### D-10 — invoice manual dari SO

Keputusan final: Owner/Admin membuat invoice dari SO yang telah dikonfirmasi. Satu SO dapat memiliki beberapa invoice, dengan batas kumulatif kuantitas/nilai di database. Invoice tidak memiliki `shipment_id`; draft tidak mengakui pendapatan. Pendapatan dan piutang timbul saat invoice diterbitkan, sesuai `ACCOUNTING_POLICY_AND_CUTOVER.md`. Konfirmasi SO membuat draf invoice otomatis secara idempoten.

Status 23 Oktober 2026: seluruh komponen D-10 aktif di Production (migration `20261017185346`, `20261021184121`, `20261021184128`, `20261021184134`, `20261021184138`, `20261021184142`). UAT guard nilai kumulatif lintas beberapa invoice, concurrency, dan pembulatan masih perlu dilengkapi.

### D-11 — arsip migration

Schema remote adalah sumber kebenaran. Folder `supabase/migrations/` adalah arsip yang harus menggunakan version ID remote dan isi SQL yang sama untuk migration yang sudah diterapkan. Status 23 Oktober 2026: arsip sudah sinkron 24/24 dengan history remote (md5 identik). Jangan mengubah isi migration yang telah diterapkan atau menjalankan migration baru sebelum kode dan schema siap dilepas bersama.

## 5. Daftar migration remote (24)

Nama arsip = `<version>_<name>.sql`. Empat entri terakhir memakai `name` yang sudah mengandung timestamp, sehingga nama filenya berprefix ganda secara sengaja.

| Version | Name | Catatan |
|---|---|---|
| `20261016125928` | `dropship_suppliers_orders` | Fondasi master, SO, PO |
| `20261016130021` | `dropship_foreign_key_indexes` | Index FK awal |
| `20261016132858` | `customer_product_price_history` | Histori harga khusus |
| `20261016134859` | `supplier_invoice_capture` | Capture faktur supplier |
| `20261016171001` | `dropship_shipment_tracking` | Legacy; objeknya dihapus oleh `20261017185346` (D-09) |
| `20261016175827` | `customer_invoices_per_delivery_drafts` | Legacy invoice per shipment; diganti model D-10 |
| `20261016205342` | `auto_customer_invoice_on_delivery_drafts` | Legacy; trigger dihapus oleh `20261017185346` |
| `20261016215508` | `payments_and_invoice_allocations` | Pembayaran dan alokasi |
| `20261016225329` | `accounting_posting_framework` | Kerangka akuntansi + gate |
| `20261017185346` | `d10_invoice_from_sales_order_drop_shipment_module` | D-09/D-10 dasar |
| `20261021184121` | `d10_auto_draft_edit` | Draf otomatis + edit draf |
| `20261021184128` | `d10_invoice_lock_order` | Urutan lock anti race |
| `20261021184134` | `d10_invoice_value_cap` | Batas nilai saat edit |
| `20261021184138` | `d10_create_invoice_value_cap` | Batas nilai saat create |
| `20261021184142` | `d10_future_dated_so_invoice_date` | Tanggal invoice masa depan |
| `20261021195006` | `supplier_invoice_direct_capture` | Capture faktur supplier langsung |
| `20261021203053` | `accounting_configuration_mapping_upsert` | Upsert mapping konfigurasi akuntansi |
| `20261021223550` | `masterdata_enhancements_tables` | Alamat kirim + rekening bank supplier |
| `20261021223601` | `masterdata_enhancements_price_edit` | Edit harga terjadwal |
| `20261021223610` | `masterdata_enhancements_price_end_delete` | Tutup/hapus harga terjadwal |
| `20261022013453` | `20261022070000_masterdata_code_immutability` | Kode master data tidak berubah |
| `20261022013524` | `20261022080000_masterdata_generate_code_rpc` | Generate kode atomik |
| `20261022013530` | `20261022090000_masterdata_price_update_lock` | Lock update harga |
| `20261022013534` | `20261022100000_masterdata_audit_trail` | Audit trail master data |

## 6. Integrasi dan otorisasi

- `create_customer_product_price`, `update_scheduled_customer_product_price`, `end_customer_product_price`, `delete_scheduled_customer_product_price` mengelola histori harga per pelanggan-barang secara server-side dengan locking.
- `create_sales_order` dan `confirm_sales_order` membuat/mengonfirmasi SO dan menyimpan snapshot di database; konfirmasi memicu draf invoice otomatis yang idempoten.
- `create_purchase_order` dan `set_purchase_order_status` membuat PO dari SO terkonfirmasi, mendukung split, dan memakai locking untuk batas kuantitas SO.
- `create_customer_invoice` / `update_customer_invoice_draft` / `void_customer_invoice` mengelola invoice pelanggan dari SO dengan batas kumulatif kuantitas/nilai.
- `create_supplier_invoice` / `void_supplier_invoice` mencatat atau membatalkan faktur supplier; nilai berasal dari dokumen sumber.
- Capture pembayaran/alokasi memiliki RPC server-side dan idempotency. Alokasi operasional tidak otomatis membuat jurnal.
- Fungsi posting akuntansi hanya berjalan setelah profil, referensi kebijakan, mapping akun, dan periode memenuhi gate database. Saat ini profil `approved` dengan 10 mapping dan 1 periode.
- Perubahan transaksi harus memakai RPC dan pemeriksaan role. Viewer hanya baca. Jangan mengandalkan sekadar menyembunyikan tombol di UI.

## 7. Temuan Security/Performance Advisor

Security Advisor 23 Oktober 2026: **36 fungsi `SECURITY DEFINER` di `public` dapat dipanggil role `authenticated`** (warning `authenticated_security_definer_function_executable`) dan **perlindungan kata sandi bocor Supabase Auth masih nonaktif** (`auth_leaked_password_protection`). Review menyeluruh atas 36 fungsi tersebut ada di `SECURITY_DEFINER_REVIEW.md`: seluruhnya memakai `set search_path = ''`, menguji role Owner/Admin lewat `app_private.has_business_role` berbasis `app_metadata`, membatasi grant hanya ke `authenticated`, dan tidak memakai SQL dinamis. Warning terkait `SECURITY DEFINER` adalah konsekuensi desain aplikasi yang memanggil RPC langsung dari browser; risiko sisanya terdokumentasi di dokumen review.

Performance Advisor 23 Oktober 2026: 26 foreign key tanpa covering index dan 30 indeks belum terpakai (level INFO). Jangan membuat/menghapus indeks massal tanpa analisis beban query dan verifikasi.

Tindakan yang tertunda: aktifkan **Leaked Password Protection** di Supabase Auth Settings (Dashboard → Authentication → Settings → Password) atau lewat Management API, lalu jalankan ulang Security Advisor untuk memastikan warning hilang.

## 8. Route dan batas fitur

Route shipment lama sudah dihapus; invoice pelanggan dibuat dari SO terkonfirmasi, dan pembayaran tersedia mandiri di `/pembayaran`. RPC invoice SO-based sudah aktif di Production, termasuk pembuatan draf otomatis dan edit draf.

Belum boleh diklaim selesai: Faktur Pajak/e-Faktur dari aplikasi, penghitungan pajak tervalidasi otomatis, nota kredit lengkap, seluruh pengakuan HPP aktual, laporan GL/laba-rugi/neraca penuh, rekonsiliasi bank, audit log umum, workflow lampiran, backup/restore teruji, dan UAT role-based end-to-end. Lihat `ACCOUNTING_POLICY_AND_CUTOVER.md` untuk prasyarat cutover.

## 9. Pemeriksaan release

Untuk perubahan aplikasi jalankan `npm run lint`, `npm run build`, dan `npm run build:worker` pada commit yang direview. Untuk perubahan database, jelaskan objek, risiko data, metode pemulihan, serta verifikasi RLS, policy, constraint, function/trigger, dan hitungan data setelah perubahan. Setelah migration diterapkan, sinkronkan isi arsip `supabase/migrations/` dengan `supabase_migrations.schema_migrations` (version, name, md5 statements) dan catat hasilnya di PR.

Verifikasi deployment live dapat dilakukan dengan mengecek `https://jena-medica.fa-mitra.my.id` (status HTTP, header `server: cloudflare`, marker UI terbaru di HTML) dan mencocokkan version build Cloudflare dengan commit `main` yang dirilis.

---

## Snapshot historis (tidak menggantikan status di atas)

- **22 Oktober 2026:** dokumentasi mencatat 15 migration remote dan lima migration lanjutan D-10 (`20261021184121`–`20261021184142`) diterapkan; uji transaksional awal lulus dengan `ROLLBACK`; deployment live belum dapat diverifikasi.
- **21 Oktober 2026:** remote mencatat 10 migration; arsip migration dasar D-09/D-10 diselaraskan ke version `20261017185346`; migration lanjutan D-10 saat itu belum diterapkan.
- **17 Oktober 2026:** snapshot audit awal mencatat 9 migration, 27 tabel publik, 1 shipment `shipped`, 2 SO `confirmed`, belum ada invoice, profil posting `draft`, mapping/periode/jurnal 0. Pada snapshot itu shipment legacy masih ada dan invoice lama masih terikat shipment.
