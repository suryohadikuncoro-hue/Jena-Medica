# Supabase Integration — Jena Medical Center

## Status rekonsiliasi Production — 21 Oktober 2026 (baca-saja)\n\nSupabase remote mencatat 10 migration. Migration dasar D-09/D-10 tercatat sebagai version `20261017185346`, sementara nama arsip lama memakai `20261017150000`; PR ini menyelaraskan nama arsip tanpa mengubah isi SQL. Migration lanjutan D-10 dari PR #46, #49, #50, dan #51 belum diterapkan. RPC remote `create_customer_invoice(uuid,date,text,jsonb)` belum memiliki guard nilai kumulatif dan RPC `update_customer_invoice_draft` belum tersedia. Audit data tidak menemukan invoice aktif yang melampaui nilai/kuantitas SO, tetapi belum ada uji runtime. Tidak ada perubahan database atau deployment. Bagian di bawah yang berlabel snapshot 17 Oktober adalah catatan historis dan tidak menggantikan status ini.\n\n## 1. Environment dan aturan sumber kebenaran

Target: project Supabase `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status `ACTIVE_HEALTHY`, region `ap-northeast-1`. Satu proyek saat ini mewakili satu perusahaan; schema belum mempunyai isolasi multi-tenant.

Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Publishable key tetap tunduk pada RLS. Service-role key tidak boleh berada di browser, Git, atau log. `.env.local` harus tetap diabaikan Git dan `.env.example` hanya berisi placeholder.

Login memakai Supabase Auth email/password; signup publik tidak dibuka. Otorisasi menggunakan claim tepercaya `app_metadata.business_role` dengan nilai `owner`, `admin`, atau `viewer`; jangan menggunakan `user_metadata` sebagai dasar otorisasi. Setelah perubahan claim, refresh token atau login kembali.

Dokumen keputusan: `PRODUCT_SPEC.md`. Kebijakan akuntansi/pajak: `ACCOUNTING_POLICY_AND_CUTOVER.md`. Status database terkini: `DATABASE_INTEGRATION_READINESS.md`. Supabase adalah sumber kebenaran schema sesuai D-11; status dalam dokumen ini adalah snapshot audit baca-saja tanggal 17 Oktober 2026.

## 2. Skema remote saat audit

Pada snapshot audit 17 Oktober 2026, Supabase mencatat 9 migration dan 27 tabel publik. Riwayat remote saat rekonsiliasi 21 Oktober mencatat 10 migration. Seluruh tabel publik memiliki RLS aktif dan policy; tidak ditemukan grant `SELECT` tabel publik untuk role `anon`.

| Kelompok | Tujuan/kondisi |
|---|---|
| `customers`, `suppliers`, `products` | Master bisnis dan barang; tidak menyimpan saldo stok |
| `customer_product_prices` | Riwayat harga per pelanggan-barang |
| `sales_orders`, `sales_order_lines` | SO dan snapshot harga |
| `purchase_orders`, `purchase_order_lines` | PO ke supplier, dapat dipecah berdasarkan SO line |
| `supplier_invoices`, `supplier_invoice_lines` | Capture draft faktur supplier; belum menjadi AP/jurnal sampai posting |
| `customer_payments`, `supplier_payments` dan tabel allocation | Capture receipt/disbursement dan alokasi operasional; belum menjadi jurnal otomatis |
| `shipments`, `shipment_lines`, `shipment_status_events` | Modul legacy yang masih terpasang saat audit; targetnya dihapus menurut D-09 |
| `sales_invoices`, `sales_invoice_lines` | Implementasi legacy mengikat invoice ke shipment; akan diubah sesuai D-10 |
| `chart_of_accounts`, `accounting_posting_profile`, `accounting_account_mappings`, `accounting_periods`, `journal_entries`, `journal_lines` | Kerangka akuntansi dengan gate konfigurasi |

Migration kerangka akuntansi sudah diterapkan remote. Jangan menulis bahwa migration tersebut masih menunggu merge atau belum diterapkan. Namun **penerapan migration tidak sama dengan posting akuntansi aktif**: saat audit, profile masih `draft`, mapping akun 0, periode 0, dan jurnal 0.

## 3. Data aktual yang teramati

Query baca-saja pada 17 Oktober 2026 menemukan: 1 customer, 1 supplier, 2 produk, 1 harga khusus, 2 SO `confirmed`, 2 baris SO, 1 PO `sent`, 1 shipment `shipped`, 1 customer payment `recorded`, 1 supplier payment `recorded`, 10 akun COA, dan belum ada invoice pelanggan, faktur supplier, periode, mapping, atau jurnal.

Jangan anggap shipment `shipped` sebagai `delivered`. Status payment `recorded` tidak dengan sendirinya berarti memiliki jurnal kas/bank atau telah dialokasikan ke invoice.

**Instruksi D-09 dari pemilik:** hapus langsung objek dan record shipment legacy sesuai scope keputusan. Tabel pembayaran pelanggan/supplier tetap dipertahankan; bukan bagian dari penghapusan shipment.

## 4. Keputusan target vs implementasi lama

### D-09 — pengiriman bukan tanggung jawab sistem

Keputusan final: hapus menu/halaman/komponen pengiriman, tabel shipment, RPC terkait, dan trigger invoice otomatis ketika shipment menjadi delivered. Jangan menambahkan tracking, resi, surat jalan, kurir, atau penerimaan barang.

Snapshot historis 17 Oktober menemukan objek shipment legacy. Migration dasar D-09/D-10 kini tercatat dalam riwayat remote sebagai version `20261017185346`; query audit ulang ini tidak memverifikasi ulang setiap objek shipment setelah migration tersebut. Tidak perlu menunggu backup sebagai prasyarat penghapusan shipment; record pembayaran harus dipertahankan.

### D-10 — invoice manual dari SO

Keputusan final: Owner/Admin membuat invoice secara manual dari SO yang telah dikonfirmasi. Satu SO dapat memiliki beberapa invoice, dengan batas kumulatif kuantitas/nilai di database. Invoice tidak memiliki `shipment_id`; draft tidak mengakui pendapatan. Pendapatan dan piutang timbul saat invoice diterbitkan, sesuai `ACCOUNTING_POLICY_AND_CUTOVER.md`.

Snapshot historis 17 Oktober menunjukkan schema invoice lama bergantung pada shipment. Migration dasar D-09/D-10 tercatat diterapkan remote, tetapi RPC edit draf dan pengaman nilai kumulatif lanjutan belum tersedia; status aktual objek dasar harus divalidasi ulang setelah prosedur rilis.

### D-11 — arsip migration

Schema remote adalah sumber kebenaran. Folder `supabase/migrations/` adalah arsip yang harus menggunakan version ID remote dan isi SQL yang sama untuk migration yang sudah diterapkan. Nama arsip migration dasar D-09/D-10 diselaraskan ke version ID remote tanpa mengubah konten SQL. Migration lanjutan D-10 belum ada pada remote. Jangan mengubah isi migration yang telah diterapkan atau menjalankan migration baru sebelum kode dan schema siap dilepas bersama.

## 5. Daftar migration remote

- `supabase/migrations/20261016125928_dropship_suppliers_orders.sql`
- `supabase/migrations/20261016130021_dropship_foreign_key_indexes.sql`
- `supabase/migrations/20261016132858_customer_product_price_history.sql`
- `supabase/migrations/20261016134859_supplier_invoice_capture.sql`
- `supabase/migrations/20261016171001_dropship_shipment_tracking.sql` — legacy, target D-09
- `supabase/migrations/20261016175827_customer_invoices_per_delivery_drafts.sql` — legacy, target D-10
- `supabase/migrations/20261016205342_auto_customer_invoice_on_delivery_drafts.sql` — legacy, target D-09/D-10
- `supabase/migrations/20261016215508_payments_and_invoice_allocations.sql`
- `supabase/migrations/20261016225329_accounting_posting_framework.sql`\n- `supabase/migrations/20261017185346_d10_invoice_from_sales_order_drop_shipment_module.sql` — tercatat di remote

**Migration dasar D-09/D-10 yang sudah tercatat di remote:** `supabase/migrations/20261017185346_d10_invoice_from_sales_order_drop_shipment_module.sql` (arsip diselaraskan tanpa mengubah SQL). **Migration lanjutan yang belum diterapkan:** `supabase/migrations/20261020042000_d10_auto_draft_edit.sql`, `supabase/migrations/20261021152000_d10_invoice_lock_order.sql`, `supabase/migrations/20261021160000_d10_invoice_value_cap.sql`, dan `supabase/migrations/20261021170000_d10_create_invoice_value_cap.sql`. Migration ini menghapus modul shipment beserta data shipment legacy, menanggalkan `shipment_id`/`shipment_line_id` dari invoice, dan mengganti RPC invoice menjadi manual dari SO. Pembayaran pelanggan/supplier tidak dihapus. Remote mencatat 10 migration. Empat migration lanjutan D-10 belum diterapkan; audit baca-saja ini tidak menjalankan DDL.

## 6. Integrasi dan otorisasi

- `create_customer_product_price` memvalidasi role, status customer/product, dan perubahan histori harga di server.
- `create_sales_order` dan `confirm_sales_order` membuat/mengonfirmasi SO dan menyimpan snapshot di database.
- `create_purchase_order` membuat PO dari SO terkonfirmasi, mendukung split dan memakai locking untuk batas kuantitas SO.
- `create_supplier_invoice` / `void_supplier_invoice` mencatat atau membatalkan draft faktur supplier; nilai berasal dari dokumen sumber.
- Snapshot historis mencatat RPC shipment dan trigger invoice berbasis delivered; migration dasar D-09/D-10 tercatat di remote. Audit ini tidak memverifikasi ulang semua objek shipment setelah migration dasar. Kode aplikasi tidak lagi mengandalkan shipment.
- Capture pembayaran/alokasi memiliki RPC server-side dan idempotency. Alokasi operasional tidak otomatis membuat jurnal.
- Fungsi posting akuntansi hanya boleh digunakan setelah profil, referensi kebijakan, mapping akun, dan periode memenuhi gate database. COA belum disahkan/mapping belum ada pada snapshot audit.
- Perubahan transaksi harus memakai RPC dan pemeriksaan role. Viewer hanya baca. Jangan mengandalkan sekadar menyembunyikan tombol di UI.

## 7. Temuan Security/Performance Advisor

Audit menemukan 33 public `SECURITY DEFINER` function yang dapat dieksekusi oleh `authenticated` dan memicu warning Advisor. Pemeriksaan SQL menemukan role check pada fungsi-fungsi tersebut; tidak ditemukan public RPC yang executable oleh `anon`. Warning tetap harus direview setelah perubahan schema.

Temuan lain: perlindungan kata sandi bocor Supabase Auth dinonaktifkan; Performance Advisor mencatat 20 foreign key tanpa indeks dan 46 indeks unused. Jangan mengubah pengaturan atau menghapus/menambah indeks massal tanpa analisis dan verifikasi.

## 8. Route dan batas fitur

Pada kode branch ini, route shipment lama sudah dihapus; invoice pelanggan dibuat manual dari SO, dan pembayaran tersedia mandiri di `/pembayaran`. Supabase remote memiliki migration dasar D-09/D-10, tetapi migration lanjutan D-10 untuk draf otomatis/edit dan batas nilai belum diterapkan. Karena itu, invoice baru tidak dapat dibuat melalui RPC SO-based hingga migration tersebut diterapkan.

Belum boleh diklaim selesai: Faktur Pajak/e-Faktur dari aplikasi, penghitungan pajak tervalidasi otomatis, nota kredit lengkap, seluruh pengakuan HPP aktual, laporan GL/laba-rugi/neraca penuh, rekonsiliasi bank, audit log umum, workflow lampiran, backup/restore teruji, dan UAT role-based end-to-end. Lihat `ACCOUNTING_POLICY_AND_CUTOVER.md` untuk prasyarat cutover.

## 9. Pemeriksaan release

Untuk perubahan aplikasi jalankan `npm run lint`, `npm run build`, dan `npm run build:worker` pada commit yang direview. Untuk perubahan database, jelaskan objek, risiko data, metode pemulihan, serta verifikasi RLS, policy, constraint, function/trigger, dan hitungan data setelah perubahan.

Audit ini tidak menjalankan build atau UAT UI, tidak memverifikasi domain Cloudflare live, dan tidak mengubah database/data/deployment.
