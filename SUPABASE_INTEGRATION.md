# Supabase integration — Jena Medical Center

## Environment dan credential

Target: project `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif. Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Publishable key bukan pengganti RLS; service-role key tidak dipakai di browser atau disimpan di repo. `.env.local` diabaikan Git; `.env.example` hanya berisi placeholder.

Sesi menggunakan Supabase Auth email/password. Tidak ada signup publik pada UI. Sebelum menguji aplikasi, administrator harus membuat/mengundang akun dan mengisi claim tepercaya `app_metadata.business_role` dengan salah satu nilai `owner`, `admin`, atau `viewer`. Jangan menggunakan `user_metadata` untuk otorisasi karena dapat diubah pengguna. Setelah claim diperbarui, refresh token atau login ulang.

## Skema tahap pertama

Saat ini satu project mewakili satu perusahaan/data bisnis; belum ada `tenant_id`/isolasi multi-perusahaan. Jangan memakai skema ini untuk beberapa entitas legal tanpa mendesain ulang tenancy dan RLS.

| Tabel | Peran |
|---|---|
| `customers` | Referensi pelanggan, alamat default, termin dan limit kredit opsional. |
| `suppliers` | Master supplier, status pajak/identitas pajak opsional, kontak dan termin. Rekening bank sengaja belum dikumpulkan. |
| `products` | Master barang/satuan; tidak memiliki saldo atau atribut stok. |
| `sales_orders` / `sales_order_lines` | SO dengan customer, tanggal/jatuh tempo, tujuan kirim dan snapshot harga/barang/termin/diskon. |
| `purchase_orders` / `purchase_order_lines` | PO satu supplier per dokumen, terkait SO dan SO-line, snapshot tujuan, biaya estimasi. Satu SO-line dapat dipenuhi oleh beberapa PO. |

Nomor SO/PO dibuat menggunakan sequence. Harga ditangkap di transaksi; master harga pelanggan dan perhitungan pajak belum ada. Semua dokumen memakai IDR pada fase ini. Tidak ada seed rows.

## Operasi dan otorisasi

- Semua tabel `public` memiliki RLS. Semua role bisnis dapat membaca. Hanya `owner`/`admin` dapat membuat/mengubah master; tidak ada delete grant.
- `create_sales_order` membuat header dan seluruh baris dalam satu RPC/transaksi, memverifikasi pelanggan/barang aktif, menangkap snapshot, menghitung due date dan total pra-pajak.
- `confirm_sales_order` hanya mengonfirmasi draft dengan sekurangnya satu baris.
- `create_purchase_order` hanya menerima SO terkonfirmasi, supplier aktif, SO-line yang benar, dan kuantitas sisa yang tidak melampaui jumlah SO. Row lock pada SO-line mencegah dua PO bersaing melewati batas.
- Aplikasi tidak diberi write langsung untuk tabel SO/PO; RPC memeriksa `app_metadata.business_role` di database. Fungsi `SECURITY DEFINER` menggunakan `SET search_path = ''`, mencabut execute dari `PUBLIC`/`anon`, dan memberi execute hanya ke `authenticated`.
- Supabase Security Advisor memberi warning `authenticated_security_definer_function_executable` untuk tiga RPC karena sesi authenticated dapat memanggil endpoint RPC. Itu disengaja untuk workflow browser dan dibatasi validasi role; tetap harus ditinjau menjelang produksi. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor awal menemukan foreign key tanpa indeks; migration kedua menambahkan indeks yang hilang. Advisor masih menyebut indeks unused, wajar karena tabel kosong/belum ada traffic.

RLS mengandalkan `auth.jwt()` / `app_metadata`; Supabase mengingatkan bahwa perubahan metadata baru tercermin setelah token diperbarui. Rujukan: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Migrasi

- `supabase/migrations/20261016125928_dropship_suppliers_orders.sql`
- `supabase/migrations/20261016130021_dropship_foreign_key_indexes.sql`

Versi tersebut sesuai catatan migration remote. Migrasi pertama create-only dan tidak menghapus data; migrasi kedua menambah indeks saja.

## UI yang terhubung

- `/login`
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products`
- `/` (baca/tambah SO, konfirmasi SO)
- `/operasional` (baca/buat draft PO)

## Belum termasuk

Harga khusus pelanggan, invoice supplier/customer, perlakuan PPN dan diskon faktur, shipment/tracking, pembayaran/alokasi, akuntansi/jurnal, audit log, lampiran, mekanisme cancellation/approval PO, backup/restore, dan pengujian transaksi end-to-end dengan akun ber-role. Jangan gunakan modul prototipe yang belum terhubung untuk pencatatan keuangan.

## Catatan dependensi

`npm audit` melaporkan 9 temuan high pada dependency graph toolchain yang ada, terutama `@opennextjs/cloudflare` dan `eslint-config-next`. Rute perbaikan yang disarankan npm memerlukan perubahan major pada toolchain, jadi versi tersebut tidak diubah dalam lingkup integrasi Supabase. Tinjau dan upgrade secara terpisah sebelum rilis produksi; paket `@supabase/supabase-js` tidak termasuk dalam nama temuan yang dilaporkan.
