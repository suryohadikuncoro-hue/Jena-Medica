# Draft Desain Fisik Database & Strategi Integrasi
ERP Distribusi Obat B2B — Jena Medical Center

**Versi:** 0.1 — untuk review, belum disetujui untuk implementasi  
**Tanggal:** 14 Oktober 2026  
**Acuan:** DBDD v0.2, SDD v0.2, Accounting & Transaction Posting Specification v0.2, DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md, DATABASE_INTEGRATION_READINESS.md.

> Dokumen ini memberi rekomendasi desain fisik awal dan tahapan integrasi. Ini bukan SQL DDL, bukan migration, bukan instruksi membuat atau mengubah database, dan tidak memberi izin koneksi ke database produksi atau deployment. Nama relasi dan tipe yang diusulkan harus direview sebelum implementasi.

## 1. Rekomendasi dan hal yang belum diputuskan

### Rekomendasi kerja
Gunakan **PostgreSQL sebagai kandidat DBMS utama untuk dievaluasi**, dengan transaksi ACID, foreign key eksplisit, constraint, numeric presisi tetap, dan migration versioning. Ini merupakan rekomendasi untuk review, bukan keputusan final. Aplikasi yang ada masih memakai Next.js/React/TypeScript; repository belum memiliki ORM, database driver, schema, maupun framework migration yang dideklarasikan di package.json.

Sebelum menetapkan PostgreSQL, konfirmasikan bahwa container/database PostgreSQL lokal yang digunakan dalam development memang target yang akan dipertahankan. Jika target sebenarnya berbeda, tipe vendor-spesifik, strategi constraint dan rencana migration perlu diperbarui. Tidak ada dependensi atau konfigurasi database yang ditambahkan dalam paket ini.

### Keputusan yang masih terbuka
- DBMS dan versi final; environment development, test, staging, dan production.
- Lapisan akses data (SQL terparameterisasi, query builder atau ORM) serta framework migration.
- Strategi PK final (rekomendasi awal UUID), tipe presisi/rounding, zona waktu, dan nomor dokumen.
- Bagan akun, waktu pengakuan pendapatan, perlakuan penerimaan tanpa faktur/GRNI, FIFO untuk HPP, retur/write-off dan posting pajak.
- Auth, batas otorisasi server-side, strategi RLS bila diperlukan, penyimpanan lampiran, retensi, backup/restore.
- Sumber data dan proses cutover saldo awal serta transaksi terbuka.

## 2. Konvensi fisik yang diusulkan

| Area | Rekomendasi awal | Alasan / kontrol |
|---|---|---|
| Primary key | UUID internal untuk entitas bisnis; jangan memakai nomor faktur atau batch supplier sebagai PK | Stabil meskipun nomor dokumen/kode sumber berubah atau duplikat |
| Nomor dokumen | Kolom bisnis terpisah dengan UNIQUE sesuai ruang lingkup; buat sequence per jenis dokumen/tahun melalui service transaksional bila penomoran tahunan disetujui | Mendukung nomor PO, receipt, shipment, invoice, adjustment, journal yang tidak ganda |
| Nominal uang | NUMERIC/DECIMAL dengan presisi tetap; kandidat awal NUMERIC(20,4), dibulatkan sesuai kebijakan yang disetujui | Jangan gunakan floating point; presisi dan pembulatan tiap transaksi harus disepakati |
| Kuantitas | NUMERIC/DECIMAL presisi tetap; kandidat awal NUMERIC(18,6) pada satuan dasar | Mendukung satuan pecahan bila relevan; validasi digit jumlah menurut precision_scale satuan produk |
| Mata uang | Kode currency eksplisit pada transaksi/harga jika model memungkinkan multi-currency; jangan asumsikan konversi kurs tanpa aturan | Snapshot harga dan jumlah dalam mata uang transaksi harus dapat ditelusuri |
| Tanggal bisnis | DATE untuk tanggal invoice, tanggal ED, tanggal jatuh tempo, periode akuntansi | Tidak berubah oleh konversi zona waktu |
| Waktu peristiwa | Timestamp with time zone untuk created_at, received_at, posted_at, handed_over_at, approved_at; simpan dalam UTC dan formatkan lokal di UI | Konsisten untuk audit dan integrasi |
| Status | Kode status terkontrol (lookup/reference atau CHECK constraint setelah daftar status disetujui); transisi status divalidasi di domain service | Status tidak boleh berubah sekehendak UI |
| Boolean | Boolean hanya untuk flag sederhana; gunakan status/riwayat untuk proses yang memiliki banyak tahap | Hindari menggabungkan verifikasi, aktif, posted, dan closed menjadi satu flag |
| Snapshot | Simpan nama pihak, SKU/deskripsi, satuan, harga, diskon, pajak/versi aturan yang dipakai di baris transaksi | Perubahan master tidak mengubah histori |
| Audit | created_at/created_by dan updated_at/updated_by sesuai kebutuhan; event audit append-only secara konseptual untuk aksi sensitif | Melacak siapa, kapan, alasan, dan perubahan yang terjadi |
| Penghapusan | Master yang telah direferensikan dinonaktifkan, bukan dihapus; dokumen posted dikoreksi/dibalik lewat dokumen tertaut | Menjaga keterlacakan |
| Charset/collation | UTF-8; aturan pencarian kode dibandingkan secara terkontrol | Nama produk/pelanggan dapat berisi karakter Indonesia; normalisasi kode harus eksplisit |
| Attachment | Metadata di database, isi file di object/file storage privat yang belum dipilih | Memisahkan data transaksi dari file dan mengontrol akses |

**Catatan:** angka presisi dalam tabel adalah kandidat teknis untuk pengujian, belum disahkan kebijakan akuntansi. Pengujian harus mencakup kuantitas kemasan, diskon, pajak, pembulatan IDR, jumlah besar dan koreksi.

## 3. Domain dan tabel yang direncanakan

Nama berikut mempertahankan usulan entitas di DBDD v0.2; penamaan final dapat berubah saat desain fisik disetujui.

### A. Master
- product, product_unit, unit_conversion, product_category
- customer, customer_contact
- supplier, supplier_contact
- warehouse
- customer_product_price, price_version atau snapshot harga, price_override
- account, expense_category, cash_account

Setiap kode bisnis yang memang harus unik mendapat UNIQUE constraint pada scope yang disepakati. Relasi master menggunakan FK eksplisit. Master yang sudah dipakai oleh dokumen tidak dihapus secara fisik. Konversi satuan dan harga kontrak efektif tidak boleh berubah retroaktif.

### B. Penjualan dan pengiriman
- sales_order, sales_order_line
- shipment, shipment_line, shipment_batch_line
- sales_invoice, sales_invoice_line

Relasi penting: customer 1:N sales_order; sales_order 1:N order_line dan 1:N shipment; shipment 1:N shipment_line; shipment_line 1:N shipment_batch_line; sales_invoice 1:N sales_invoice_line. Setiap invoice line menunjuk jumlah shipment line yang sah untuk ditagih.

Kontrol fisik yang diusulkan:
- UNIQUE pada nomor dokumen dengan scope yang disetujui.
- Index pada customer_id/status/order_date, sales_order_id pada line/shipment, shipment_id pada shipment_line, shipment_line_id pada detail batch, serta customer_id/status/due_date pada invoice.
- Constraint jumlah tidak negatif untuk baris biasa; retur/pembalik menggunakan dokumen/tipe mutasi eksplisit.
- Pencegahan tagihan ganda membutuhkan validasi agregat dalam transaksi domain dan/atau mekanisme locking; UNIQUE pada foreign key saja tidak cukup untuk semua kasus faktur parsial.

### C. Pembelian dan penerimaan
- purchase_order, purchase_order_line
- goods_receipt, goods_receipt_line, goods_receipt_batch_line
- supplier_invoice, supplier_invoice_line
- supplier_return, supplier_return_line, supplier_credit

Relasi penerimaan-ke-PO dapat nullable untuk skenario pembelian langsung yang disetujui. Baris penerimaan harus dapat direkonsiliasi dengan jumlah diterima, disetujui, dan ditolak. Faktur pemasok dapat mencocokkan beberapa penerimaan bila proses disetujui; bila perlu, gunakan tabel penghubung eksplisit untuk relasi multi-dokumen, bukan memaksakan satu receipt ke satu invoice.

Index utama: supplier_id/status/order_date untuk PO; purchase_order_id pada line/receipt; goods_receipt_id dan purchase_order_line_id pada receipt line; supplier_invoice_id/status/due_date dan FK baris untuk pencocokan. PO tidak menambah stok atau membentuk utang final sendiri.

### D. Persediaan dan batch
- product_batch
- stock_movement sebagai ledger kuantitas sumber audit
- stock_allocation
- stock_status_balance sebagai view/projection, bukan ledger independen
- stocktake, stocktake_line
- stock_adjustment, stock_adjustment_line
- quarantine_record

Index utama: product_batch(product_id, expiry_date), product_batch(supplier_id, supplier_batch_code) bila pencarian mendukungnya; stock_movement(product_id, batch_id, posted_at); stock_allocation(sales_order_line_id, status) dan stock_allocation(batch_id, status); stocktake/adjustment status dan waktu.

Kode batch pemasok bukan identitas internal. Dukung kode kosong atau duplikat dengan batch_id internal stabil, sumber penerimaan, produk, dan aturan identifikasi alternatif. Saldo stok siap jual, karantina, teralokasi, dan dalam perjalanan harus dibedakan. Saldo turunan dapat di-cache hanya jika dapat dibangun ulang dari ledger.

### E. Pembayaran dan saldo terbuka
- payment
- payment_allocation
- customer_credit
- supplier_credit
- bank_reconciliation, reconciliation_line

Index utama: payment(cash_account_id, payment_date, status), payment_allocation(payment_id), payment_allocation(invoice_id) atau FK dokumen terkait yang eksplisit, dan dokumen AR/AP berdasarkan pihak/status/due_date.

Saldo invoice harus diturunkan dari faktur posted dikurangi pembayaran yang dialokasikan, nota kredit/kredit yang sah dan penyesuaian resmi. Pembayaran dapat dialokasikan ke banyak invoice; satu invoice dapat menerima banyak pembayaran. Uang muka dan saldo belum dialokasikan tetap menjadi kredit, bukan otomatis melunasi invoice. Validasi alokasi harus tahan terhadap operasi bersamaan dengan locking/transaction isolation yang memadai.

### F. Akuntansi dan laporan
- accounting_period
- journal_entry, journal_line
- posting_rule
- expense, trip, trip_cost_allocation
- owner_transaction
- recurring_expense_schedule
- tax_business_profile, tax_profile_documents, tax_rules, tax_codes, tax_transaction_lines, tax_documents, tax_periods, tax_payments, tax_reconciliations, tax_audit_logs
- audit_event, approval_event, attachment, attachment_link, idempotency_key

Index utama: journal_entry(period_id, status, entry_date), journal_entry(source reference) sesuai strategi FK yang disetujui; journal_line(journal_entry_id, account_id) dan dimensi yang sering dilaporkan; tax transaction pada sumber/periode/status/versi aturan; audit_event pada actor/time/entity; idempotency_key pada scope dan key dengan constraint unik.

**Penting:** DBDD v0.2 secara eksplisit menunda pilihan FK eksplisit versus pola source_type/source_id. Untuk transaksi finansial kritis, utamakan FK eksplisit atau tabel penghubung yang benar-benar menjaga referential integrity. Relasi polymorphic tidak boleh dibiarkan tanpa validasi sumber.

## 4. Constraint dan index lintas modul

### Constraint minimal
1. UNIQUE untuk SKU, kode pelanggan, kode supplier, kode unit, nomor dokumen, nomor jurnal, dan kunci idempotensi sesuai scope.
2. FK dengan kebijakan ON DELETE RESTRICT/soft deactivate untuk master yang direferensikan; tindakan cascade hanya untuk detail draft yang aman dan telah dianalisis.
3. CHECK nominal/kuantitas non-negatif bagi transaksi normal; pembalik/koreksi memiliki tipe dan referensi eksplisit.
4. Validasi baris penerimaan: received_qty sesuai accepted_qty + rejected_qty dan rincian batch tidak melebihi jumlah diterima/disetujui sesuai aturan.
5. Validasi shipment_batch_line: jumlah rincian batch sama dengan shipped_qty per shipment_line.
6. Validasi invoice: kuantitas terfaktur kumulatif untuk shipment_line tidak melebihi kuantitas yang berhak ditagih.
7. Validasi alokasi: jumlah alokasi tidak melebihi dana tersedia atau saldo sah, kecuali kelebihan dicatat sebagai kredit.
8. Journal posting ditolak jika total debit tidak sama dengan kredit pada mata uang fungsional.
9. effective_from/effective_to valid, periode tidak tumpang tindih untuk akun/aturan/status yang memiliki batas periode.
10. Posted document dan ledger entry immutable secara bisnis; koreksi berupa event/dokumen baru yang tertaut.

### Indeks untuk pola query nyata
Mulai dengan PK, UNIQUE dan FK, ditambah index query penting di atas. Jangan membuat banyak index berdasarkan dugaan; ukur query daftar/faktur, aging AR/AP, stok per batch/status/ED, picking FEFO, audit search, dan laporan periode. Index final perlu diuji dengan query plan pada data uji yang representatif. Index tidak menggantikan validasi transaksi.

## 5. Transaksi atomik dan layanan domain

Posting penting dijalankan pada server-side domain service, bukan hanya dari event UI. Operasi berikut memerlukan transaction boundary yang jelas:
- Approve/post penerimaan → buat batch/movement untuk kuantitas yang sah → update status receipt.
- Post pengiriman → detail kuantitas/batch + movement keluar dan pelepasan alokasi yang sesuai.
- Post invoice → invoice/line + status posted + jurnal/AR sesuai aturan yang disahkan; cegah penagihan ganda.
- Catat payment → transaksi cash/bank + alokasi/kredit + journal sesuai aturan.
- Post supplier invoice/payment → liability/payment allocation/journal sesuai kebijakan yang disahkan.
- Stock adjustment → approval + movement + dampak nilai/jurnal bila berlaku.
- Retur/credit note → approval/inspeksi + perubahan stok yang sah + kredit/AR/AP dan jurnal yang tertaut.

Jika semua berada dalam satu database, gunakan transaksi database untuk perubahan yang harus atomik. Semua perintah posting harus idempotent: simpan idempotency key dengan constraint unik dan referensi sumber; retry tidak boleh menggandakan efek. Jika alur mencakup layanan/storage eksternal, gunakan outbox/retry/reconciliation pattern setelah dipilih, bukan menandai berhasil secara prematur.

Status UI hanya boleh menyatakan selesai ketika dampak stok/keuangan wajib berhasil atau alur pemulihannya sudah tercatat eksplisit.

## 6. Lapisan aplikasi

Rekomendasi pemisahan:
1. **UI/route handlers/server actions** — menerima input dan mengembalikan hasil/status, tanpa aturan saldo kritis tersebar di komponen React.
2. **Domain services** — validasi business rule, status transition, approval, idempotensi dan orchestration transaksi.
3. **Repository/data access** — query terparameterisasi, transaksi database, mapping result dan penanganan error.
4. **Database** — PK/FK/UNIQUE/CHECK, transaksi, ledger, dan kebijakan akses yang disepakati.
5. **Read models** — query/view untuk KPI, aging, stock balance dan report dari dokumen posted; data aktual, estimasi dan proyeksi dilabeli terpisah.

ORM/query-builder dipilih setelah evaluasi kemampuan transaksi, kontrol SQL untuk query stok/locking, migration diffs, tipe, dan kemudahan pemeliharaan. Jangan memasukkan dua strategi persistence sekaligus sebelum dibutuhkan. Apa pun toolingnya, migration tersimpan sebagai file versioned yang direview melalui PR; tidak ada auto-migration saat aplikasi startup atau deploy.

## 7. Keamanan, file, dan operasi

- Semua secret hanya lewat environment lokal/secret store; tidak boleh masuk Git atau log. Pertahankan ignore untuk .env dan sediakan contoh tanpa rahasia bila dibutuhkan.
- Database runtime memakai user/role berhak minimum; schema owner/migration role dipisahkan dari runtime role.
- Akses data dikontrol di server-side. Bila platform mendukung RLS, definisikan policy dan uji; jangan mengandalkan hide/show tombol di UI. Jangan membuat policy generik yang memberi akses luas.
- Lampiran disimpan privat dengan metadata, checksum bila dibutuhkan, relasi dokumen, pemeriksaan tipe/ukuran file, URL berumur terbatas, retensi, dan backup. Provider belum dipilih.
- Logging tidak menyimpan password, token, kredensial, atau isi lampiran sensitif. Audit mencatat actor/time/source/reason/change untuk transaksi sensitif.
- Tetapkan backup, uji restore, monitoring error/latency, prosedur rotasi secret, dan rencana rollback sebelum data operasional dipakai.

## 8. Strategi integrasi bertahap

| Tahap | Cakupan | Exit criteria / pengujian |
|---|---|---|
| 0. Keputusan | DBMS/versi, connection mode, query tooling, tipe/rounding, timezone, nomor dokumen, akun, posting, HPP, GRNI, pajak | Keputusan ditandai disetujui/tertunda; tidak ada asumsi tersembunyi |
| 1. Fondasi | Config per environment, koneksi server-side ke DB pengembangan, migration tooling terpilih, transaction helper, error mapping, auth boundary | Startup tidak menjalankan migration otomatis; tidak ada secret di Git; smoke test hanya ke database pengembangan |
| 2. Schema awal | Migration untuk master dan indeks/constraint yang telah disetujui | Rebuild database kosong dan rollback/recovery diuji; lint/build/test lulus |
| 3. Master | Product/unit/conversion, customer/contact, supplier/contact, harga efektif | Kode duplikat ditolak; FK/audit; deactivate; histori snapshot tidak berubah |
| 4. Pembelian/stok | PO → penerimaan parsial/ditolak → batch/ED/quarantine → movement dan saldo | PO tidak menambah stok; hanya approved qty memengaruhi saldo; rebuild balance cocok ledger |
| 5. Penjualan/pengiriman | Order → allocation → FEFO picking → shipment parsial/failure → invoice | Tidak ada stok negatif/karantina normal picking, batch trail lengkap, faktur tidak berlebih/ganda |
| 6. Pembayaran | Payment, allocation, customer/supplier credit, aging, AP due | Parsial, multi-invoice, uang muka, concurrency, retry dan reversal lulus |
| 7. Akuntansi | Posting rules, account/period, journal, expense, bank reconciliation | Debit = kredit, posting idempotent, periode tertutup, reversal dan audit lulus |
| 8. Retur & pajak | Inspeksi retur, credit note, supplier return, write-off, tax configuration/history | Barang baru masuk stok setelah pemeriksaan; pajak belum verified tidak menjadi posting final |
| 9. Laporan/dashboard | Read model dari sumber transaksi posted/subledger | KPI direkonsiliasi terhadap query sumber, periode jelas, tidak mencampur kas dengan laba |
| 10. Cutover | Saldo awal stok per batch/status, AR/AP terbuka, uang muka/kredit, kas/bank, dokumen berjalan | Rekonsiliasi dan approval tertulis; backup/restore dan rencana rollback lulus sebelum produksi |

Semua tahap implementasi tetap melalui PR, review, dan pengujian yang proporsional. Sampai otorisasi eksplisit diberikan, pekerjaan tetap pada dokumentasi/prototype dan database lokal tidak diubah oleh tahapan ini.

## 9. Tes integritas wajib sebelum data nyata
- Migration dari kosong berjalan berurutan; snapshot/backup dapat dipulihkan.
- Kegagalan saat posting tidak meninggalkan efek parsial; retry dengan idempotency key tidak duplikat.
- Penerimaan parsial, reject, karantina, ED, stocktake dan adjustment menghasilkan ledger/saldo yang cocok.
- FEFO untuk picking dan biaya FIFO (jika disetujui) dipisahkan serta dapat ditelusuri.
- Pengiriman parsial/gagal, invoice parsial, credit note dan pengiriman pengganti menjaga kuantitas/tagihan.
- Pembayaran parsial, multi-invoice, uang muka, kredit supplier, overpayment, retry, dan concurrent allocation diuji.
- Jurnal seimbang, koreksi/reversal tertaut, periode tertutup dan reopen berotorisasi.
- Hak akses diuji langsung terhadap route/API/database, bukan hanya UI.
- Rekonsiliasi stok, piutang, utang, kas/bank dan buku besar ke transaksi detail dilakukan.
- Dashboard tidak memuat data contoh pada koneksi produksi; nilai aktual memiliki period, freshness, dan sumber jelas.

## 10. Keputusan yang perlu direview sebelum ada DDL
- [ ] Apakah PostgreSQL menjadi DBMS resmi untuk development, test, dan rencana produksi?
- [ ] Apakah ID internal memakai UUID? Apakah nomor dokumen memakai format/scope per jenis dan tahun?
- [ ] Apakah kandidat precision uang NUMERIC(20,4), kuantitas NUMERIC(18,6), dan aturan pembulatan memenuhi kebutuhan barang serta akuntansi?
- [ ] Lapisan akses data/migration tooling mana yang akan digunakan?
- [ ] Bagaimana otorisasi server-side dan apakah RLS diperlukan untuk bentuk deployment yang dipilih?
- [ ] Kapan revenue/HPP diakui, bagaimana GRNI ditangani, FIFO/HPP dan biaya masuk dinilai, serta bagaimana retur/write-off diposting?
- [ ] Status profil pajak belum terverifikasi: transaksi apa yang boleh disimpan/dihitung, dan kapan boleh diposting?
- [ ] Apakah relasi sumber transaksi kritis wajib berupa FK eksplisit atau tabel penghubung per tipe sumber?
- [ ] Apa strategi lampiran, backup/restore, retention, serta environment secret management?
- [ ] Bagaimana saldo awal dan transaksi terbuka direkonsiliasi dan siapa yang menyetujui cutover?

## 11. Status otorisasi

Dokumen ini adalah draft untuk review. Ia **tidak mengizinkan** pembuatan database, pembuatan DDL, penambahan driver/ORM, penulisan migration, seed data operasional, koneksi produksi, pemindahan saldo, maupun deployment. Semua keputusan fisik harus disetujui dahulu; implementasi selanjutnya dilakukan pada environment pengembangan/uji dan diserahkan sebagai PR terpisah.

Rujukan: DBDD v0.2, SDD v0.2, Accounting & Transaction Posting Specification v0.2, DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md, DATABASE_INTEGRATION_READINESS.md.
