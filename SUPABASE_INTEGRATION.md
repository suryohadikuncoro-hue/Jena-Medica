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
| `customer_product_prices` | Histori harga IDR per pelanggan+barang, masa berlaku dan pencipta. Versi baru append-only dari UI. |
| `sales_orders` / `sales_order_lines` | SO dengan tujuan kirim, termin, snapshot harga/barang/diskon dan sumber rate/override. |
| `purchase_orders` / `purchase_order_lines` | PO satu supplier per dokumen, terkait SO dan SO-line, snapshot tujuan dan biaya estimasi. Satu SO-line dapat dipenuhi beberapa PO. |
| `supplier_invoices` | Nomor faktur unik per supplier, tanggal/tempo, status/mode pajak, angka diskon/pajak/total sebagaimana tertera, catatan dan status `draft`/`void`. |
| `supplier_invoice_lines` | Rincian aktual yang dilaporkan supplier, dipasangkan ke PO-line dan menyimpan snapshot nama/kode/satuan. |

Harga khusus hanya boleh berlaku hari ini atau ke depan, serta harus setelah versi terakhir. Jika sebelumnya ada rate terbuka, RPC menutupnya sehari sebelum tanggal baru. Tidak boleh backdate atau mengganti versi yang sudah dibuat pada tanggal yang sama. Tidak ada seed rows. SO/PO/harga memakai IDR; harga SO pra-pajak.

Faktur supplier tahap ini hanya **capture dokumen**: semua nilai dicatat seperti yang tercetak. Tarif PPN awal 11% hanya mengikuti brief dan ditampilkan sebagai input sesuai dokumen untuk supplier berstatus PKP; tidak ada perhitungan, penetapan perlakuan hukum pajak, alokasi diskon ke modal, pengakuan AP/HPP, pembayaran, atau jurnal. Cocokkan faktur asli dan aturan yang berlaku sebelum posting akuntansi.

## Operasi dan otorisasi

- Semua tabel `public` memakai RLS. Role bisnis (`owner`, `admin`, `viewer`) dapat membaca; hanya `owner`/`admin` dapat mengubah master dan membuat/mengonfirmasi transaksi lewat RPC. Tabel faktur supplier tidak memberi hak tulis langsung.
- `create_customer_product_price` memvalidasi role, pelanggan dan barang aktif, serialisasi perubahan pasangan customer-product dengan advisory lock, menutup rate terbuka sebelumnya, lalu membuat versi baru secara atomik.
- `create_sales_order` membuat header/baris SO dalam satu transaksi. Jika line merujuk `customer_product_price_id`, database memverifikasi customer, product dan masa berlaku serta mengambil harga dari baris rate, bukan mempercayai angka yang dikirim browser. Jika referensi rate tidak ada, harga manual dicatat sebagai `price_overridden = true`.
- `confirm_sales_order` hanya mengonfirmasi draft yang berisi baris.
- `create_purchase_order` menerima SO terkonfirmasi, supplier aktif, SO-line yang benar dan kuantitas sisa yang tidak melebihi jumlah SO; locking mencegah PO bersamaan melewati batas.
- `create_supplier_invoice` memeriksa Owner/Admin, supplier aktif, nomor faktur unik per supplier, tanggal, nilai nonnegatif dan setiap PO-line berasal dari supplier yang sama serta PO tidak dibatalkan. Semua header dan line dibuat atomik dalam status draft.
- `void_supplier_invoice` hanya membatalkan draft dan wajib menyimpan alasan, pengguna serta waktu. Data tidak dihapus; nomor yang sudah di-void dapat dicatat ulang.
- Faktur tidak membatasi jumlah kumulatif terhadap kuantitas PO dan tidak menguji aritmetika subtotal/PPN/total. Selisih wajib ditinjau manual.
- RPC `SECURITY DEFINER` memakai `SET search_path = ''`, memeriksa role di database dan mencabut execute dari `PUBLIC`/`anon`; execute diberikan hanya ke `authenticated`.
- Security Advisor mengeluarkan warning `authenticated_security_definer_function_executable` untuk enam RPC karena endpoint dapat dipanggil sesi authenticated. Setiap fungsi membatasi role di server-side, tetapi tinjau lagi sebelum produksi. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor tidak melaporkan FK tanpa indeks. Laporan “unused index” masih wajar karena tabel kosong.

RLS memakai `app_metadata`, bukan `user_metadata`. Rujukan: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Migrasi

- `supabase/migrations/20261016125928_dropship_suppliers_orders.sql`
- `supabase/migrations/20261016130021_dropship_foreign_key_indexes.sql`
- `supabase/migrations/20261016132858_customer_product_price_history.sql`
- `supabase/migrations/20261016134859_supplier_invoice_capture.sql`

Keempat versi sesuai catatan migration remote. Migration supplier invoice additive, tidak menanam data, dan hanya membuat draft/void capture; tidak menghasilkan saldo hutang, modal/HPP atau jurnal.

## UI yang terhubung

- `/login`
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products`, `/master-data#prices`
- `/` — SO, default customer price, manual override dan snapshot sumber rate
- `/operasional` — baca/buat PO draft
- `/operasional#invoices` — baca/buat/void draft Faktur Supplier yang terhubung ke PO-lines

## Belum termasuk

Pengiriman/tracking, sales invoice, perhitungan dan pemetaan PPN, alokasi diskon/ongkos ke modal, pengakuan hutang/AP dan HPP, pembayaran/alokasi, akuntansi/jurnal, audit log umum, lampiran, approval/kirim PO, backup/restore, serta uji transaksi end-to-end dengan user ber-role. Jangan gunakan modul prototipe yang belum terhubung atau angka capture-only untuk pencatatan keuangan final.

## Catatan dependensi

`npm audit` melaporkan 9 temuan high pada dependency graph toolchain yang ada, terutama `@opennextjs/cloudflare` dan `eslint-config-next`. Rute perbaikan yang disarankan npm memerlukan perubahan major, jadi versi tersebut tidak diubah dalam lingkup ini. Tinjau terpisah sebelum produksi; `@supabase/supabase-js` bukan salah satu paket yang dilaporkan.
