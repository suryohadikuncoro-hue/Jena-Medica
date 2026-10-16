# Supabase integration — Jena Medical Center

## Environment dan credential

Target: project `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif. Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Publishable key tidak menggantikan RLS; service-role key tidak dipakai di browser atau disimpan di repo. `.env.local` diabaikan Git; `.env.example` hanya berisi placeholder.

Sesi memakai Supabase Auth email/password. Tidak ada signup publik. Administrator perlu membuat/mengundang user dan menetapkan claim tepercaya `app_metadata.business_role` (`owner`, `admin`, `viewer`). Jangan gunakan `user_metadata` untuk otorisasi. Setelah claim diperbarui, refresh token atau login ulang.

## Skema tahap ini

Satu project mewakili satu perusahaan/data bisnis; belum ada isolasi multi-tenant (`tenant_id`). Jangan gunakan skema ini untuk beberapa entitas legal tanpa desain tenancy dan RLS terpisah.

| Tabel | Peran |
|---|---|
| `customers` | Referensi pelanggan, alamat default, termin dan limit kredit opsional. |
| `suppliers` | Master supplier, status pajak/identitas pajak opsional, kontak dan termin. Rekening bank belum dikumpulkan. |
| `products` | Master barang/satuan; tanpa saldo stok. |
| `customer_product_prices` | Histori harga IDR per pelanggan+barang, dengan tanggal efektif, catatan opsional dan pencipta. Versi baru append-only dari UI. |
| `sales_orders` / `sales_order_lines` | SO dengan tujuan kirim, termin dan snapshot harga/barang/diskon. Baris menyimpan referensi rate bila dipakai dan `price_overridden` bila admin memakai harga manual. |
| `purchase_orders` / `purchase_order_lines` | PO satu supplier per dokumen, terkait SO dan SO-line, snapshot tujuan dan biaya estimasi. Satu SO-line dapat dipenuhi beberapa PO. |

Harga baru hanya boleh berlaku hari ini atau ke depan, serta harus setelah versi terakhir. Jika sebelumnya ada rate terbuka, RPC menutupnya sehari sebelum tanggal baru. Tidak boleh backdate atau mengganti versi yang sudah dibuat pada tanggal yang sama. Tidak ada seed rows. SO/PO/harga memakai IDR; harga SO pra-pajak.

## Operasi dan otorisasi

- Semua tabel `public` memakai RLS. Role bisnis dapat membaca; hanya `owner`/`admin` dapat mengubah master dan menetapkan harga. Tidak ada direct insert/update/delete pada tabel harga.
- `create_customer_product_price` memvalidasi role, pelanggan dan barang aktif, serialisasi perubahan pasangan customer-product dengan advisory lock, menutup rate terbuka sebelumnya, lalu membuat versi baru secara atomik.
- `create_sales_order` membuat header/baris SO dalam satu transaksi. Jika line merujuk `customer_product_price_id`, database memverifikasi customer, product dan masa berlaku serta mengambil harga dari baris rate, bukan mempercayai angka yang dikirim browser. Jika referensi rate tidak ada, harga manual dicatat sebagai `price_overridden = true`.
- `confirm_sales_order` hanya mengonfirmasi draft yang berisi baris.
- `create_purchase_order` menerima SO terkonfirmasi, supplier aktif, SO-line yang benar dan kuantitas sisa yang tidak melebihi jumlah SO; locking mencegah PO bersamaan melewati batas.
- RPC `SECURITY DEFINER` memakai `SET search_path = ''`, memeriksa role di database, mencabut execute dari `PUBLIC`/`anon`, dan memberi execute hanya ke `authenticated`.
- Security Advisor mengeluarkan warning `authenticated_security_definer_function_executable` untuk empat RPC karena endpoint RPC dapat dipanggil sesi authenticated. Akses dibatasi oleh pengecekan role server-side, tetapi perlu ditinjau lagi sebelum produksi. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor tidak menemukan FK tanpa indeks setelah migration; laporan “unused index” masih wajar karena tabel kosong.

RLS memakai `app_metadata`, bukan `user_metadata`. Rujukan: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Migrasi

- `supabase/migrations/20261016125928_dropship_suppliers_orders.sql`
- `supabase/migrations/20261016130021_dropship_foreign_key_indexes.sql`
- `supabase/migrations/20261016132858_customer_product_price_history.sql`

Versi tersebut sesuai catatan migration remote. Migration harga bersifat additive, tidak menanam data; mengganti fungsi SO tetap kompatibel dengan payload lama yang tidak menyertakan `customer_product_price_id`.

## UI yang terhubung

- `/login`
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products`, `/master-data#prices`
- `/` — SO, default customer price, manual override, snapshot sumber rate
- `/operasional` — baca/buat PO draft

## Belum termasuk

Supplier invoice, shipment/tracking, sales invoice, perlakuan PPN/diskon faktur, pembayaran/alokasi, akuntansi/jurnal, audit log, lampiran, pembatalan/approval PO, backup/restore, dan pengujian transaksi end-to-end dengan user ber-role. Jangan gunakan modul prototipe yang belum terhubung untuk pencatatan keuangan.

## Catatan dependensi

`npm audit` melaporkan 9 temuan high pada dependency graph toolchain yang ada, terutama `@opennextjs/cloudflare` dan `eslint-config-next`. Rute perbaikan yang disarankan npm memerlukan perubahan major, jadi versi tersebut tidak diubah dalam lingkup ini. Tinjau terpisah sebelum produksi; `@supabase/supabase-js` bukan salah satu paket yang dilaporkan.
