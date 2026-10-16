# Supabase integration — Jena Medical Center

## Environment dan credential

Target: project `Jena Medical Center` (`sjiezdyxylwvqessyvml`), status aktif. Aplikasi memakai Supabase JS di browser dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Publishable key tidak menggantikan RLS; service-role key tidak dipakai di browser atau disimpan di repo. `.env.local` diabaikan Git; `.env.example` hanya berisi placeholder.

Sesi memakai Supabase Auth email/password. Tidak ada signup publik. Administrator perlu membuat/mengundang user dan menetapkan claim tepercaya `app_metadata.business_role` (`owner`, `admin`, `viewer`). Jangan gunakan `user_metadata` untuk otorisasi. Setelah claim diperbarui, refresh token atau login ulang.

## URL Auth Production

Supabase Auth URL Configuration menggunakan Site URL `https://jena-medica.fa-mitra.my.id` dan redirect allowlist `https://jena-medica.fa-mitra.my.id/**`. Jangan biarkan Site URL Production mengarah ke `localhost`; tautan email undangan menggunakan Site URL ini bila `redirectTo` tidak diberikan. Pengguna membuka undangan terbaru, lalu saat sesi aktif memilih **Atur kata sandi** di aplikasi (`/set-password`) sebelum memakai login email/password.

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
| `sales_invoices` / `sales_invoice_lines` | Draft invoice satu per shipment berstatus delivered; baris menelusuri shipment-line → PO-line → SO-line dan menggunakan harga jual snapshot SO. |

Enam migration telah diterapkan. Lima belas tabel public ber-RLS kini tersedia. Dataset TEST Production mencakup master customer/supplier/product dan harga, satu SO terkonfirmasi, serta satu PO draft; tabel invoice pelanggan tetap kosong sampai ada shipment delivered. SO/PO/invoice menggunakan IDR; nilai SO dan invoice draft belum menghitung PPN.

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
- `create_customer_invoice` hanya menerima shipment berstatus `delivered`, membuat satu draft per shipment, menyalin customer/alamat serta harga dari snapshot transaksi, membatasi kuantitas invoice kumulatif terhadap SO-line, dan mengalokasikan nilai bersih SO secara proporsional untuk kiriman parsial dengan sisa pembulatan pada kiriman terakhir. `void_customer_invoice` membatalkan draft dengan alasan, pengguna, dan waktu; draft void tetap tersimpan dan shipment dapat dibuatkan draft baru.
- Invoice pelanggan hanya berstatus `draft`/`void`; nomor diawali `DRAFT-INV`. Belum ada PPN, penerbitan resmi, posting piutang/pendapatan, pembayaran, jurnal, penyimpanan PDF, atau pengiriman WhatsApp otomatis. UI memakai dialog cetak browser untuk Save as PDF; WhatsApp hanya membuka teks siap kirim dan tidak melampirkan PDF.
- Shipment mencatat direct delivery supplier-ke-pelanggan; shipment sendiri tidak membuat penerimaan, saldo, AP/HPP, invoice, pajak, pembayaran atau jurnal.
- Faktur supplier tidak membatasi kuantitas kumulatif terhadap PO dan tidak menguji aritmetika subtotal/PPN/total; selisih masih harus diperiksa manual.
- RPC `SECURITY DEFINER` memakai `SET search_path = ''`, memeriksa role di database dan mencabut execute dari `PUBLIC`/`anon`; execute diberikan hanya ke `authenticated`.
- Security Advisor dapat menandai RPC `SECURITY DEFINER` yang memang dipanggil sesi authenticated; tiap RPC memeriksa role server-side. Tinjau ulang laporan advisor setelah migration baru dan sebelum rilis. [Panduan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor sebelumnya tidak melaporkan FK tanpa indeks. `Unused index` dapat terjadi pada tabel baru/bervolume rendah; tinjau ulang setelah penggunaan bertambah.

RLS memakai `app_metadata`, bukan `user_metadata`. Rujukan: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Migrasi

- `supabase/migrations/20261016125928_dropship_suppliers_orders.sql`
- `supabase/migrations/20261016130021_dropship_foreign_key_indexes.sql`
- `supabase/migrations/20261016132858_customer_product_price_history.sql`
- `supabase/migrations/20261016134859_supplier_invoice_capture.sql`
- `supabase/migrations/20261016171001_dropship_shipment_tracking.sql`
- `supabase/migrations/20261017100000_customer_invoices_per_delivery_drafts.sql`

Keenam migration cocok dengan skema remote. Migration invoice additive, tidak menanam baris invoice, dan tidak membuat transaksi akuntansi.

## UI yang terhubung

- `/login`
- `/set-password` — menetapkan atau mengganti kata sandi saat sesi undangan/pemulihan aktif.
- `/master-data#customers`, `/master-data#suppliers`, `/master-data#products`, `/master-data#prices`
- `/` — SO, default customer price, manual override dan snapshot sumber rate
- `/operasional` — baca/buat PO draft dan catat status terkirim/konfirmasi secara manual
- `/operasional#invoices` — baca/buat/void draft Faktur Supplier yang terhubung ke PO-lines
- `/pengiriman-piutang` — baca/buat shipment, partial quantity, resi/surat jalan, transisi status dan timeline; tab Pembayaran masih placeholder
- `/invoice-pelanggan` — draft invoice per shipment delivered, pratinjau cetak/PDF, dan tautan WhatsApp yang tidak mengirim otomatis

## Belum termasuk

Penerbitan resmi invoice pelanggan, perhitungan/pemetaan PPN, pengakuan piutang/pendapatan, pengiriman dokumen PO atau komunikasi kurir, upload bukti/surat jalan, alokasi diskon/ongkos ke modal, pengakuan hutang/AP dan HPP, pembayaran/alokasi, akuntansi/jurnal, audit log umum, approval, backup/restore, serta uji transaksi UI end-to-end dengan akun ber-role. Jangan gunakan invoice draft atau status shipment sebagai pencatatan keuangan final.

## Catatan dependensi

`npm audit` sebelumnya melaporkan temuan high pada dependency graph toolchain, terutama `@opennextjs/cloudflare` dan `eslint-config-next`. Rute perbaikan yang disarankan npm memerlukan perubahan major, jadi versi tersebut tidak diubah dalam lingkup shipment. Tinjau terpisah sebelum produksi; `@supabase/supabase-js` bukan salah satu paket yang dilaporkan.
