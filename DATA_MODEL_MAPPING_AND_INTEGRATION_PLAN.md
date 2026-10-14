# Pemetaan Model Data dan Blueprint Integrasi
ERP Distribusi Obat B2B — Jena Medical Center

**Tanggal:** 14 Oktober 2026  
**Status:** Rancangan integrasi untuk review; belum menjadi skema fisik final  
**Acuan utama:** DBDD v0.2, SDD v0.2, Accounting & Transaction Posting Specification v0.2, serta audit kesiapan `DATABASE_INTEGRATION_READINESS.md`.

> Dokumen ini memetakan prototipe UI ke entitas logis yang telah diusulkan. Nama tabel dan atribut mengikuti DBDD v0.2 sebagai konsep, bukan jaminan nama tabel fisik. Dokumen ini bukan izin membuat atau mengubah database, menulis migrasi, menghubungkan produksi, atau deploy.

## 1. Kesimpulan

Seluruh workspace utama kini tersedia sebagai prototipe: Dashboard, Penjualan/Faktur, Master Data, Pembelian & Persediaan, Pengiriman & Piutang, serta Keuangan & Laporan. Implementasi yang ada masih menggunakan array data contoh dan state lokal halaman; belum ada satu sumber data lintas modul.

**Strategi integrasi yang direkomendasikan:** jangan mengubah tiap layar agar langsung melakukan CRUD database secara terpisah. Buat batas domain dan transaksi server-side, tentukan sumber kebenaran per dokumen, terapkan validasi/otorisasi di server/database, lalu susun ringkasan laporan dari transaksi posted dan subledger yang dapat direkonsiliasi.

Untuk mengurangi risiko, integrasikan satu alur bisnis end-to-end dalam lingkungan pengembangan/uji sebelum beralih ke alur berikutnya. UI yang sudah disetujui tetap dipertahankan; perubahan visual bukan tujuan tahap ini.

## 2. Pemetaan layar → entitas logis → tindakan

| Workspace / layar | Entitas logis DBDD v0.2 | Pola baca/tulis setelah integrasi | Aturan utama |
|---|---|---|---|
| Dashboard | Gabungan read model dari `sales_invoice`, `payment` + `payment_allocation`, `supplier_invoice`, `stock_movement`, `product_batch`, `stock_allocation`, `journal_entry`/`journal_line`, plus sumber pengiriman dan pengingat | **Read-only projection/query** dengan periode, waktu pembaruan, dan label aktual/estimasi/proyeksi | Tidak menjadi sumber transaksi. Jangan jumlahkan contoh dari modul terpisah. Saldo harus dapat dibangun ulang dari sumber transaksi. |
| Master pelanggan | `customer`, opsional `customer_contact` | Baca daftar/detail; create/update draft atau perubahan master melalui layanan domain | `code` unik; perubahan limit kredit dicatat pada `audit_event`; pelanggan yang dirujuk transaksi tidak dihapus secara fisik. |
| Master barang | `product`, `product_unit`, `unit_conversion`, `product_category`, opsional `customer_product_price`/versi harga | Baca katalog, satuan, kategori, harga efektif; perubahan disimpan dengan masa berlaku/snapshot | SKU unik; kuantitas konsisten dengan satuan dasar; perubahan konversi/harga tidak boleh mengubah histori transaksi posted. |
| Penjualan / pesanan | `sales_order`, `sales_order_line`, `price_override`/snapshot harga; `stock_allocation` saat alokasi | Draft/edit sebelum konfirmasi; konfirmasi pesanan dan alokasi melalui aksi domain | Pesanan tidak membentuk pendapatan, piutang, kas, HPP, atau mutasi stok fisik. Peringatan kredit/margin perlu menyimpan alasan jika dikecualikan. |
| Picking & pengiriman | `shipment`, `shipment_line`, `shipment_batch_line`, `stock_movement`, `stock_allocation`, `attachment_link`/bukti | Baca stok layak jual/tersedia; posting pengiriman mencatat batch dan kuantitas aktual dalam satu transaksi yang konsisten | FEFO untuk pilihan batch fisik jika relevan; stok karantina tidak dapat dipilih. Detail batch harus sama dengan jumlah pengiriman. Titik serah untuk posting perlu keputusan final. |
| Faktur penjualan | `sales_invoice`, `sales_invoice_line`, sumber `shipment_line`, `tax_transaction_lines` bila berlaku, `journal_entry`/baris setelah posting | Buat faktur dari kuantitas pengiriman yang layak ditagih; posting terotorisasi dan idempoten | Kuantitas kumulatif tidak boleh ditagih dua kali. Harga/satuan/diskon/pajak snapshot disimpan. Jurnal dan perubahan status tidak boleh separuh berhasil. |
| Pembelian / PO | `purchase_order`, `purchase_order_line`, `supplier`, `product` | Buat PO dan lihat sisa kuantitas yang belum diterima | PO tidak menambah stok dan tidak otomatis membentuk utang final. Harga perkiraan bukan biaya aktual yang sudah disahkan. |
| Penerimaan barang | `goods_receipt`, `goods_receipt_line`, `goods_receipt_batch_line`, `product_batch`, `stock_movement`, opsional `quarantine_record` | Penerimaan fisik, hitung diterima/ditolak, identifikasi batch/ED; posting hanya kuantitas yang diterima dan disetujui | Penerimaan sebagian menyisakan PO terbuka. Barang ditolak/menunggu inspeksi bukan stok layak jual. ED tidak boleh ditebak. |
| Faktur pemasok | `supplier_invoice`, `supplier_invoice_line`, relasi pencocokan dengan PO/penerimaan, `supplier_credit`, jurnal setelah posting | Pencocokan PO–receipt–invoice; tandai selisih untuk review sebelum posting | Faktur pemasok terpisah dari PO dan penerimaan. Jangan menghitung persediaan dua kali. Kebijakan GRNI menunggu pengesahan akuntansi. |
| Batch & stok | `product_batch`, `stock_movement`, `stock_allocation`, `stock_status_balance` sebagai projection/view, `stocktake`/baris, `stock_adjustment`/baris, `quarantine_record` | Saldo dibaca dari ledger atau projection terkendali; perubahan stok hanya melalui mutasi bersumber | ID batch internal stabil terpisah dari kode batch pemasok; dukung kode kosong/duplikat pada migrasi. Bedakan stok fisik, layak jual, tersedia, teralokasi, karantina, dan dalam perjalanan. |
| Retur pelanggan | `customer_return`, `customer_return_line`, `return_inspection`, `credit_note`, pengiriman pengganti, mutasi stok/jurnal yang relevan | Request → approval → terima/inspeksi → keputusan layak jual/rusak → nota kredit/penggantian | Permintaan/approval belum mengubah stok atau piutang. Kredit hanya berdasar kuantitas/nilai yang diterima dan disetujui; histori asal tetap ada. |
| Retur pemasok & write-off | `supplier_return`, `supplier_return_line`, `quarantine_record`, `stock_adjustment`, `supplier_credit` | Minta/approve retur, pindahkan status/buat mutasi bila relevan, tautkan kredit atau penggantian | Barang rusak/ED tidak otomatis tersedia kembali; klaim pemasok tidak mengurangi utang final sebelum disahkan. |
| Pengiriman & piutang | `shipment`, `sales_invoice`, `payment`, `payment_allocation`, `customer_credit`, `credit_note` | Query status surat jalan/faktur; pembayaran dicatat sekali lalu dialokasikan secara terpisah | Saldo AR berasal dari faktur posted dikurangi alokasi pembayaran dan kredit sah. Satu pembayaran dapat ke banyak faktur dan sebaliknya. Uang muka tetap kredit sampai dialokasikan. |
| Keuangan — kas/bank | `cash_account`, `payment`, `expense`, `owner_transaction`, `bank_reconciliation`, `reconciliation_line` | Transaksi kas aktual harus memiliki akun kas/bank, tanggal, referensi dan status posting; rekonsiliasi tidak memaksa saldo | Jangan buat jurnal/kas hanya dari pengingat. Transaksi pemilik berbeda dari penjualan/biaya. Selisih rekening dicatat sebagai item yang perlu penyelesaian, bukan diubah diam-diam. |
| Keuangan — buku besar | `account`, `posting_rule`, `accounting_period`, `journal_entry`, `journal_line` | Laporan baca jurnal posted dan subledger yang direkonsiliasi; posting melalui layanan domain | Jurnal harus balance; posted tidak diedit/hapus. Periode tertutup diblokir kecuali reopen terotorisasi dengan alasan dan audit. Akun final perlu disahkan. |
| Utang & biaya | `supplier_invoice`, `payment`/alokasi, `supplier_credit`, `expense_category`, `expense`, `recurring_expense_schedule`, `trip`, `trip_cost_allocation`, `owner_transaction` | Query aging dari dokumen terbuka; biaya hanya ketika biaya aktual dikonfirmasi | Jadwal biaya hanya pengingat. Modal/prive/pinjaman pemilik tidak otomatis dikategorikan sebagai penjualan atau biaya. |
| Pajak | `tax_business_profile`, `tax_profile_documents`, `tax_rules`, `tax_codes`, `tax_transaction_lines`, `tax_documents`, `tax_periods`, `tax_payments`, `tax_reconciliations`, `tax_audit_logs` | Kalkulasi menyimpan basis, hasil, versi aturan, tanggal efektif, sumber dan status verifikasi; posting final menunggu validasi | Tarif/status/klasifikasi tidak di-hard-code. Perhitungan belum tervalidasi tidak boleh otomatis menjadi kewajiban final. |
| Audit, persetujuan, dokumen, deduplikasi | `audit_event`, `approval_event`, `attachment`, `attachment_link`, `idempotency_key` | Dipakai oleh aksi sensitif lintas domain, bukan hanya ditampilkan sebagai log UI | Audit append-only secara konseptual; jangan menyimpan rahasia. Posting/pembayaran/penerimaan/pengiriman menggunakan idempotency key. |

## 3. Alur sumber data yang harus konsisten

### A. Penjualan → pengiriman → invoice → pembayaran
1. `customer` dan `product` menjadi referensi; pesanan menyimpan snapshot harga, satuan, diskon dan ketentuan.
2. Alokasi stok di `stock_allocation` hanya komitmen; belum mengurangi stok fisik.
3. Posting pengiriman merekam `shipment_batch_line` dan mutasi keluar `stock_movement` per batch, mengikuti titik serah yang disahkan.
4. `sales_invoice_line` mereferensikan kuantitas pengiriman yang layak ditagih. Sistem mencegah kuantitas kumulatif terfaktur berlebih.
5. Posting invoice membentuk saldo AR/jurnal sesuai kebijakan pendapatan dan pajak yang disahkan. Jangan mengurangi stok lagi jika mutasi sudah diposting saat penyerahan.
6. `payment` mencatat kas/bank sekali; `payment_allocation` mengurangi faktur yang dialokasikan. Dana lebih atau belum teralokasi disimpan sebagai `customer_credit`.

### B. PO → penerimaan → batch → faktur pemasok → pembayaran
1. `purchase_order`/`purchase_order_line` merekam pesanan dan jumlah terbuka; tidak mengubah stok/utang final.
2. `goods_receipt` merekam kedatangan fisik. Kuantitas diterima, disetujui, ditolak, dan pemeriksaan harus dapat dibedakan.
3. Batch dan ED direkam di `goods_receipt_batch_line`/`product_batch`; hanya jumlah disetujui yang dapat diposting sebagai stok. Barang menunggu inspeksi/ditolak dikarantina.
4. `supplier_invoice` dicocokkan dengan PO/penerimaan dan baris item. Faktur tidak menambah stok lagi jika penerimaan telah mem-postingnya.
5. Posting utang dan kebijakan receipt-not-invoiced/GRNI belum boleh difinalisasi sebelum keputusan akuntansi.
6. `payment` dan `payment_allocation` mencatat pembayaran pemasok; pembayaran muka/kredit pemasok ditangani terpisah.

### C. Stok → nilai persediaan/HPP → laporan
1. `stock_movement` adalah histori kuantitas yang dapat diaudit; saldo siap jual/tersedia merupakan turunan yang harus dapat dibangun ulang.
2. FEFO memilih batch fisik berdasarkan ED yang relevan; FIFO untuk HPP adalah kebijakan penilaian yang berbeda dan masih perlu pengesahan.
3. Lapisan biaya atau `cost_basis_reference` menghubungkan biaya HPP pada transaksi keluar ke sumber penerimaan/biaya yang sah.
4. `journal_entry`/`journal_line` menyimpan dampak keuangan sumber; dashboard/laporan tidak boleh menyimpulkan laba dari arus kas atau dari harga perkiraan.

### D. Retur → inspeksi → nota kredit/penggantian
1. Permintaan dan persetujuan retur hanya membuat catatan proses.
2. Barang yang kembali masuk inspeksi/karantina; hasil inspeksi memisahkan layak jual, rusak dan kedaluwarsa.
3. `credit_note` dibuat hanya untuk nilai yang memenuhi syarat dan sudah disetujui; mutasi stok mengikuti hasil inspeksi serta kebijakan pemulihan nilai.
4. Barang pengganti harus memiliki penerimaan/pengiriman baru dan referensi ke retur asal.

## 4. Aturan konsistensi lintas domain

| Kontrol | Titik validasi minimal | Hasil saat gagal |
|---|---|---|
| Nomor dokumen unik | Constraint database dan layanan pembuat dokumen | Tidak membuat dokumen duplikat; tampilkan konflik yang dapat dipulihkan. |
| Idempotensi | Semua aksi post, penerimaan, pengiriman, pembayaran, jurnal dan penyesuaian | Pengulangan request tidak menggandakan efek. |
| Posting stok | Layanan domain + transaksi database/proses pemulihan terdefinisi | Tidak ada perubahan saldo parsial; setiap mutasi menunjuk sumber dan batch bila relevan. |
| Batch dan kuantitas | Validasi lintas baris penerimaan/pengiriman/inspeksi | Jumlah detail harus sama dengan jumlah baris yang disahkan. |
| Penagihan | Akumulasi kuantitas shipment line yang layak ditagih | Menolak tagihan ganda/lebih kuantitas. |
| Alokasi pembayaran | Dana belum teralokasi + saldo target dengan perlindungan concurrency | Menolak alokasi melebihi dana/saldo kecuali dicatat sebagai kredit yang sah. |
| Jurnal | Total debit dan kredit diperiksa sebelum status posted | Menolak jurnal tidak seimbang; transaksi posting tidak dibiarkan separuh. |
| Periode tertutup | Validasi sebelum posting | Menolak posting biasa; reopen memerlukan otorisasi, alasan dan audit. |
| Snapshot historis | Saat transaksi dibuat/diposting | Perubahan master/harga/pajak tidak diam-diam mengubah transaksi lama. |
| Audit & persetujuan | Di dalam alur aksi sensitif | Aksi berisiko tidak dianggap selesai tanpa bukti/approval yang diwajibkan. |
| Laporan | Query/read-model dari sumber transaksi posted dan subledger | Tampilkan periode, waktu pembaruan, dan status aktual/estimasi/proyeksi; jangan samakan laba dengan kas. |

## 5. Keputusan yang perlu dipisahkan dari coding

Keputusan berikut belum boleh dianggap selesai hanya karena prototipe UI tersedia:

1. **DBMS dan desain fisik:** DBDD v0.2 menyatakan DBMS, tipe data, index, strategi PK, DDL, RLS/otorisasi fisik, penyimpanan dokumen, dan migrasi belum ditetapkan. Konfirmasi target pengembangan/uji dan produksi sebelum desain fisik.
2. **Bagan akun dan posting:** akun kontrol persediaan/HPP, piutang/utang, pendapatan/retur, pajak, beban, modal/prive/pinjaman; pola invoice lalu pembayaran; kapan pendapatan/HPP diakui; kebijakan GRNI; biaya masuk persediaan; periode dan koreksi — perlu keputusan akuntansi.
3. **HPP vs picking:** FEFO adalah aturan pengambilan batch, bukan metode biaya. FIFO masih pilihan awal yang perlu divalidasi oleh penasihat akuntansi.
4. **Pajak:** bentuk usaha/profil wajib pajak, status PKP dan tanggal efektif, skema PPh, klasifikasi, dokumen, pembulatan, dan akun final perlu diverifikasi. Kalkulasi belum tervalidasi tidak boleh diposting otomatis.
5. **Migrasi:** tanggal cutover, saldo awal stok per batch/ED/status, AR/AP terbuka, uang muka/kredit, kas/bank, pesanan/penerimaan/pengiriman/retur yang masih terbuka, dan sumber bukti harus direkonsiliasi serta disetujui.
6. **Akses dan operasi:** autentikasi, otorisasi server-side/RLS, lampiran privat, audit trail, backup/restore, idempotensi, monitoring, dan rollback harus ditetapkan sebelum memakai data nyata.

## 6. Tahapan implementasi yang diusulkan

| Tahap | Paket kerja | Gerbang selesai |
|---|---|---|
| 0 | Konfirmasi pilihan DBMS/lingkungan, bagan akun, titik pengakuan, GRNI, HPP, pajak, nomor dokumen dan migrasi | Keputusan yang belum final dicatat; tidak ada asumsi tersembunyi. |
| 1 | Repository/persistence foundation untuk environment pengembangan: koneksi server-side, validasi, error handling, auth boundary, migration tooling setelah disetujui | Tidak ada secret di Git; tidak terhubung ke produksi. |
| 2 | Master Data: produk, satuan/konversi, pelanggan, pemasok, harga efektif | Constraint unik, audit perubahan, dan seed/test fixtures. |
| 3 | Pembelian → penerimaan → batch/ED → ledger stok | Penerimaan parsial/ditolak/karantina dan saldo rebuild lulus tes. |
| 4 | Pesanan → alokasi FEFO → pengiriman parsial → invoice | Cegah stok minus/karantina dan tagihan ganda; kuantitas actual dapat ditelusuri. |
| 5 | Pembayaran pelanggan/pemasok, alokasi, kredit, AR/AP aging | Pembayaran parsial, multi-invoice, uang muka, dan concurrency lulus tes. |
| 6 | Jurnal, biaya, kas/bank, rekonsiliasi, periode | Jurnal balance, posting idempoten, penutupan/reopen dan audit lolos tes. |
| 7 | Retur, nota kredit, write-off, pajak konfigurabel | Histori sumber terpelihara; status verifikasi dan approval berfungsi. |
| 8 | Dashboard/reporting dari read-model dan migrasi/cutover | Rekonsiliasi stok/AR/AP/kas/jurnal, backup/restore, UAT, dan persetujuan pemilik. |

## 7. Gerbang sebelum koneksi database

- [ ] Pengguna menyetujui target DBMS/lingkungan; belum menggunakan credential produksi.
- [ ] Pemetaan logis ini direview; relasi fisik dan batas transaksi disetujui.
- [ ] Keputusan akuntansi/pajak yang mempengaruhi posting disahkan atau dikonfigurasi untuk ditunda.
- [ ] Skema fisik dan migration plan terpisah disetujui sebelum dibuat.
- [ ] Hak akses server-side, secrets, audit, backup/restore, serta jalur rollback direncanakan.
- [ ] Test case lintas modul dipetakan ke tiap invariant pada dokumen ini.
- [ ] Tidak ada perpindahan saldo atau cutover sampai rekonsiliasi dan persetujuan pemilik selesai.

## 8. Rujukan dan batasan

- `DBDD_ERP_Distribusi_Obat_B2B_Draf_v0.2.docx`: rancangan model logis, entitas/relasi, constraint, saldo, migrasi, pajak dan keputusan tertunda.
- `SDD_ERP_Distribusi_Obat_B2B_Draf_v0.2.docx`: arsitektur logis dan alur transaksi.
- `Accounting_Transaction_Posting_Spec_ERP_Distribusi_Obat_B2B_Draf_v0.2.docx`: pemicu posting, dampak stok/kas/AR/AP, jurnal konseptual, koreksi dan keputusan akuntansi/pajak.
- `DATABASE_INTEGRATION_READINESS.md`: audit kesiapan tingkat modul.

Pemetaan ini adalah review dokumen dan kode prototipe secara statis, bukan verifikasi database aktual atau hasil lint/build. Tidak ada koneksi database, skema, migrasi, seed produksi, maupun deployment yang dibuat/diubah oleh paket ini.
