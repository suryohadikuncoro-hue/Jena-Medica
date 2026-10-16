# Supabase integration — Jena Medical Center

## Environment dan credential

Target: project `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif. Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Publishable key tidak menggantikan RLS; service-role key tidak dipakai di browser atau disimpan di repo. `.env.local` diabaikan Git; `.env.example` hanya berisi placeholder.

Sesi memakai Supabase Auth email/password. Tidak ada signup publik. Administrator perlu membuat/mengundang user dan menetapkan claim tepercaya `app_metadata.business_role` (`owner`, `admin`, `viewer`). Jangan gunakan `user_metadata` untuk otorisasi. Setelah claim diperbarui, refresh token atau login ulang.

## Skema tahap ini

Satu project mewakili satu perusahaan/data bisnis; belum ada isolasi multi-tenant (`tenant_id`). Jangan gunakan skema ini untuk beberapa entitas legal tanpa desain tenancy dan RLS terpisah.

| Tabel | Peran |
|---|---|
| `customers` | Referensi pelanggan, alamat default, termin dan limit kredit opsional. |
| `suppliers` | Master supplier, status pajak/identitas pajak opsional, kontak dan termin. |
| `products` | Master barang/satuan; tidak menyimpan kuantitas atau saldo. |
| `customer_product_prices` | Histori harga IDR per pelanggan+barang, masa berlaku dan pencipta. |
| `sales_orders` / `sales_order_lines` | SO dengan tujuan kirim, termin, snapshot harga/barang/diskon dan sumber rate/override. |
| `purchase_orders` / `purchase_order_lines` | PO satu supplier per dokumen, terkait SO dan SO-line, snapshot tujuan dan biaya estimasi. Satu SO-line dapat dipenuhi beberapa PO. |
| `supplier_invoices` / `supplier_invoice_lines` | Draft capture faktur supplier, nilai sebagaimana dokumen, dan relasi ke PO-line. Belum menjadi AP/HPP/PPN/jurnal. |
| `shipments` | Header direct-shipment: supplier, pelanggan, alamat snapshot, tanggal, kurir/resi/surat jalan dan status. |
| `shipment_lines` | Kuantitas shipment per PO-line dengan snapshot produk; partial fulfillment didukung. |
| `shipment_status_events` | Timeline append-only status shipment, tanggal kejadian, catatan, pengguna dan waktu pencatatan. |

Tiga belas tabel public telah diverifikasi dan semuanya masih kosong. SO/PO/harga menggunakan IDR; harga SO pra-pajak.

## Aturan harga dan faktur

Harga khusus hanya berlaku hari ini atau ke depan serta setelah versi terakhir. RPC menutup rate terbuka sebelumnya sehari sebelum tanggal baru. Backdate atau mengganti versi yang sudah dibuat pada tanggal yang sama belum didukung.

Faktur supplier tahap ini hanya **capture dokumen**: nilai disimpan seperti tercetak. Tarif PPN awal 11% hanya input sesuai dokumen untuk supplier berstatus PKP; tidak ada perhitungan, penetapan perlakuan hukum pajak, alokasi diskon ke modal, pengakuan AP/HPP, pembayaran, atau jurnal. Cocokkan dokumen sumber dan aturan yang berlaku sebelum posting akuntansi.

## Operasi dan otorisasi

- Semua tabel `public` memakai RLS. Role bisnis (`owner`, `admin`, `viewer`) dapat membaca; hanya `owner`/`admin` dapat menjalankan RPC transaksi. Tabel faktur dan shipment tidak memberi hak tulis langsung.
- `create_customer_product_price` memvalidasi role, pelanggan/barang aktif, serialisasi perubahan pasangan customer-product dengan advisory lock, menutup rate terbuka sebelumnya, lalu membuat versi baru secara atomik.
- `create_sales_order` membuat header/baris SO atomik dan memvalidasi referensi rate serta snapshot di database. `confirm_sales_order` hanya mengonfirmasi draft yang memiliki baris.
- `create_purchase_order` menerima SO terkonfirmasi, supplier aktif, SO-line yang benar dan kuantitas sisa yang tidak melebihi jumlah SO; locking mencegah PO bersamaan melewati batas.
- `set_purchase_order_status` hanya mengizinkan `draft → sent → acknowledged`, menyimpan pengguna/waktu untuk kedua transisi. UI meminta Owner/Admin mencatat tindakan yang dilakukan di luar aplikasi; RPC tidak mengirim email/dokumen.
- `create_supplier_invoice` memeriksa Owner/Admin, supplier aktif, nomor faktur unik per supplier, tanggal, nilai nonnegatif dan setiap PO-line berasal dari supplier yang sama serta PO tidak dibatalkan. Header/baris dibuat atomik dalam status draft. `void_supplier_invoice` hanya membatalkan draft dan wajib menyimpan alasan, pengguna serta waktu.
- `create_shipment` hanya menerima PO status `sent` atau `acknowledged`, menyalin relasi dan alamat tujuan dari PO, menyimpan line snapshot, dan mengizinkan kuantitas parsial. RPC mengunci PO dan setiap PO-line, memeriksa alokasi shipment non-batal terdahulu, serta menolak jumlah di atas kuantitas PO. Draft shipment ikut mencadangkan kuantitas; pembatalan draft melepaskannya.
- `transition_shipment` hanya mengizinkan transisi `draft → shipped/cancelled`, `shipped → delivered/issue`, atau `issue → shipped/delivered`. Alasan wajib untuk kendala/pembatalan, tanggal diperiksa, dan setiap perubahan mencatat event. Hanya draft dapat dibatalkan; tidak ada reversal setelah delivered.
- Shipment mencatat direct delivery supplier-ke-pelanggan; tidak ada penerimaan, saldo, AP/HPP, invoice pelanggan, pajak, pembayaran atau jurnal.
- Faktur supplier tidak membatasi kuantitas kumulatif terhadap PO dan tidak menguji aritmetika subtotal/PPN/total; selisih masih harus diperiksa manual.
- RPC `SECURITY DEFINER` memakai `SET search_path = ''`, memeriksa role di database dan mencabut execute dari `PUBLIC`/`anon`; execute diberikan hanya ke `authenticated`.
- Security Advisor mengeluarkan 9 warning `authenticated_security_definer_function_executable` untuk RPC yang sengaja dipanggil sesi authenticated. Semua memeriksa role server-side; tinjau lagi sebelum produksi. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor tidak melaporkan FK tanpa indeks. Temuan `unused index` masih wajar karena tabel baru kosong.

RLS memakai `app_metadata`, bukan `user_metadata`. Rujukan: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Migrasi

- `supabase/migrations/20261016125928_dropship_suppliers_orders.sql`
- `supabase/migrations/20261016130021_dropship_foreign_key_indexes.sql`
- `supabase/migrations/20261016132858_customer_product_price_history.sql`
- `supabase/migrations/20261016134859_supplier_invoice_capture.sql`
- `supabase/migrations/20261016171001_dropship_shipment_tracking.sql`

Kelima versi cocok dengan migration remote. Migration shipment additive, tidak menanam data, dan tidak membuat transaksi akuntansi.

## UI yang terhubung

- `/login`
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products`, `/master-data#prices`
- `/` — SO, default customer price, manual override dan snapshot sumber rate
- `/operasional` — baca/buat PO draft dan catat status terkirim/konfirmasi secara manual
- `/operasional#invoices` — baca/buat/void draft Faktur Supplier yang terhubung ke PO-lines
- `/pengiriman-piutang` — baca/buat shipment, partial quantity, resi/surat jalan, transisi status dan timeline; tab Pembayaran masih placeholder

## Belum termasuk

Pengiriman dokumen PO atau komunikasi kurir, upload bukti/surat jalan, sales invoice, perhitungan/pemetaan PPN, alokasi diskon/ongkos ke modal, pengakuan hutang/AP dan HPP, pembayaran/alokasi, akuntansi/jurnal, audit log umum, approval, backup/restore, serta uji transaksi end-to-end dengan akun ber-role. Jangan gunakan capture-only atau status shipment sebagai pencatatan keuangan final.

## Catatan dependensi

`npm audit` sebelumnya melaporkan temuan high pada dependency graph toolchain, terutama `@opennextjs/cloudflare` dan `eslint-config-next`. Rute perbaikan yang disarankan npm memerlukan perubahan major, jadi versi tersebut tidak diubah dalam lingkup shipment. Tinjau terpisah sebelum produksi; `@supabase/supabase-js` bukan salah satu paket yang dilaporkan.
