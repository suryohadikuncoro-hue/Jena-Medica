# Review Fungsi SECURITY DEFINER — Jena Medical Center

**Tanggal review:** 23 Oktober 2026 (audit baca-saja; tidak ada DDL/permintaan yang dijalankan)  
**Sumber:** arsip `supabase/migrations/` (24 file, sinkron dengan `supabase_migrations.schema_migrations` remote — md5 identik) dan Supabase Security Advisor project `Jena Medical Center` (`sjiezdyxylwvqessyvml`).

## 1. Ringkasan hasil

Security Advisor melaporkan **36 fungsi `SECURITY DEFINER` di schema `public` yang dapat dieksekusi role `authenticated`** (`authenticated_security_definer_function_executable`). Review atas seluruh definisi fungsi dalam arsip migration menemukan:

| Pemeriksaan | Hasil |
|---|---|
| Jumlah definisi fungsi `public` dalam arsip | 38 nama berbeda (termasuk definisi ulang) |
| Fungsi yang sudah dihapus dari Production | 2 — `create_shipment`, `transition_shipment` (dihapus migration `20261017185346`, D-09) |
| Fungsi live | 36 — **cocok persis dengan jumlah peringatan Advisor** |
| `set search_path = ''` | 36/36 fungsi live |
| Gate role `app_private.has_business_role(array['owner','admin'])` | 36/36 fungsi live |
| SQL dinamis (`EXECUTE`, `EXECUTE FORMAT`, `format()` untuk identitas) | Tidak ditemukan di seluruh arsip |
| `grant execute` ke role `anon` | Tidak ada |
| `revoke all ... from public, anon, authenticated` + `grant execute ... to authenticated` | Ada pada seluruh definisi awal fungsi; satu definisi ulang tidak mengulang pola ini (lihat temuan R-2) |

Kesimpulan: **tidak ditemukan fungsi `SECURITY DEFINER` publik yang kehilangan gate role, kehilangan `search_path`, atau dapat dipanggil `anon`.** Peringatan Advisor adalah konsekuensi dari arsitektur aplikasi yang memanggil RPC langsung dari browser, bukan indikasi celah yang ditemukan. Namun pola ini membuat setiap fungsi menjadi satu-satunya titik otorisasi — lihat risiko sisanya di bagian 4.

## 2. Pola keamanan yang dipakai

1. **Gate role.** Setiap fungsi transaksional diawali:
   ```sql
   if not app_private.has_business_role(array['owner', 'admin']) then
     raise exception using errcode = '42501', message = 'Owner/Admin role required';
   end if;
   ```
   `app_private.has_business_role` adalah fungsi `STABLE` dengan `set search_path = ''` yang membaca `auth.jwt() -> 'app_metadata' ->> 'business_role'`. Claim `app_metadata` hanya dapat diubah oleh service role/Admin API, bukan oleh pengguna, sehingga pengguna tidak dapat mengangkat role sendiri. Fungsi ini `revoke` dari `public, anon, authenticated` lalu `grant execute` ke `authenticated` saja — diperlukan karena policy RLS memanggilnya sebagai `(select app_private.has_business_role(...))`. Ini aman karena ia hanya membaca claim milik pemanggil sendiri.

2. **`search_path` kosong.** Seluruh fungsi memakai `set search_path = ''` dan mengkualifikasi objek dengan schema (`public.*`, `app_private.*`, `pg_catalog.*`), sehingga tidak ada risiko shadowing objek oleh schema lain.

3. **Grant minimal.** Pola setiap fungsi: `revoke all on function ... from public, anon, authenticated;` lalu `grant execute on function ... to authenticated;`. Tabel yang disentuh juga memakai RLS + grant per operasi; fungsi berjalan sebagai owner sehingga RLS tidak berlaku di dalamnya — gate role dan validasi input di dalam fungsi adalah pengaman utamanya.

4. **Validasi input dan locking.** Fungsi transaksional memvalidasi tipe/nilai parameter (`jsonb_typeof`, rentang, `nullif(btrim(...))`), memeriksa status dokumen sumber, dan memakai `for update`/`pg_advisory_xact_lock` untuk mencegah race (contoh: lock per (tabel, prefix) pada pembuatan kode, lock urutan pada pembuatan invoice).

5. **Trigger helper privat.** `app_private.set_updated_at()` adalah `SECURITY DEFINER` tetapi di-`revoke` dari semua role non-owner — tidak terpapar ke PostgREST.

## 3. Daftar 36 fungsi live per domain

Seluruh fungsi berikut: `security definer`, `set search_path = ''`, gate `owner|admin`, grant hanya ke `authenticated`.

| Domain | Fungsi |
|---|---|
| Master data | `generate_master_data_code`, `create_customer_product_price`, `update_scheduled_customer_product_price`, `end_customer_product_price`, `delete_scheduled_customer_product_price` |
| Penjualan | `create_sales_order`, `confirm_sales_order`, `create_customer_invoice`, `update_customer_invoice_draft`, `void_customer_invoice` |
| Pembelian | `create_purchase_order`, `set_purchase_order_status`, `create_supplier_invoice`, `void_supplier_invoice` |
| Pembayaran & alokasi | `record_customer_payment`, `void_customer_payment`, `allocate_customer_payment`, `void_customer_payment_allocation_batch`, `record_supplier_payment`, `void_supplier_payment`, `allocate_supplier_payment`, `void_supplier_payment_allocation_batch` |
| Akuntansi — master & konfigurasi | `create_accounting_account`, `set_accounting_account_active`, `save_accounting_configuration`, `approve_accounting_configuration`, `revoke_accounting_configuration` |
| Akuntansi — periode | `create_and_open_accounting_period`, `close_accounting_period` |
| Akuntansi — posting & pembalikan | `post_customer_invoice_to_ar`, `post_supplier_invoice_to_ap`, `post_customer_payment_journal`, `post_supplier_payment_journal`, `post_customer_allocation_journal`, `post_supplier_allocation_journal`, `reverse_accounting_journal` |

Fungsi yang sudah dihapus dan tidak boleh dikembalikan: `create_shipment`, `transition_shipment` (D-09).

## 4. Temuan dan risiko sisanya

| ID | Temuan | Tingkat | Rekomendasi |
|---|---|---|---|
| R-1 | 36 fungsi `SECURITY DEFINER` berjalan sebagai owner dan melewati RLS; gate role + validasi di dalam fungsi adalah satu-satunya pengaman | Informasi (by design) | Pertahankan disiplin: setiap fungsi baru wajib diawali gate role, validasi input, dan `set search_path = ''`. Tambahkan integrasi test per role (viewer ditolak menulis) pada jalur RPC utama |
| R-2 | `20261021203053` mendefinisikan ulang `save_accounting_configuration` tanpa mengulang baris `revoke`/`grant`; ACL dari definisi awal (`20261016225329`) tetap berlaku karena `CREATE OR REPLACE` mempertahankan privilege | Rendah | Ulangi pola `revoke`/`grant` pada setiap definisi ulang agar audit ACL tetap konsisten dan tidak bergantung pada riwayat |
| R-3 | `generate_master_data_code` membangun regex dari `p_prefix` tanpa escaping karakter metacharacter regex | Rendah (hanya owner/admin; dampak: saran kode keliru, bukan eskalasi hak) | Batasi `p_prefix` ke charset aman (`^[A-Za-z0-9_-]+$`) atau bangun pola dengan escaping |
| R-4 | Gate role membaca `app_metadata`; perubahan role baru berlaku setelah refresh token/login ulang | Informasi | Dokumentasikan ke operator; pertimbangkan force-refresh setelah perubahan role |
| R-5 | Grant eksekusi diberikan ke seluruh role `authenticated`, bukan role aplikasi khusus | Informasi | Pertimbangkan role `app_user` khusus aplikasi agar grant lebih sempit dan mudah diaudit |
| R-6 | Leaked Password Protection Supabase Auth masih **nonaktif** | Sedang (prasyarat keamanan dasar saat penggunaan meluas) | Aktifkan di Dashboard → Authentication → Settings → Password, atau lewat Management API `PATCH /v1/projects/{ref}/auth/config`; jalankan ulang Security Advisor untuk memastikan warning hilang |
| R-7 | Performance Advisor: 26 foreign key tanpa covering index, 30 indeks belum terpakai | Rendah (INFO) | Analisis beban query sebelum menambah/menghapus indeks; jangan otomatis mengikuti saran Advisor |

## 5. Batas review

- Review dilakukan terhadap isi arsip migration yang terbukti identik dengan yang diterapkan di remote (md5), ditambah pembacaan Security/Performance Advisor pada 23 Oktober 2026.
- Tidak dilakukan: uji penetrasi runtime, uji beban, perubahan DDL, atau modifikasi grant di Production.
- Jalankan ulang review ini setelah setiap perubahan schema; peringatan Advisor harus ditinjau, bukan diabaikan otomatis.
