# Kebijakan Akuntansi & Gerbang Cutover — Jena Medical Center

**Status (audit read-only 17 Oktober 2026):** migration `20261016225329_accounting_posting_framework` sudah tercatat pada Supabase. Posting masih terkunci dan belum disetujui pemilik/akuntan: profile berstatus `draft`, 10 akun COA sudah ada, mapping akun kosong, periode belum dibuat, dan belum ada jurnal.
**Model:** drop-ship langsung dari supplier ke pelanggan; sistem tidak mengelola persediaan fisik.

## Aturan yang sudah dapat dipakai

- **Invoice pelanggan:** satu draft per shipment yang dicatat `delivered`; setiap shipment parsial dapat ditagih dengan draft terpisah. Nilai neto berasal dari snapshot SO, dialokasikan pro-rata pada baris, dan sisa pembulatan masuk ke shipment terakhir. Void hanya untuk draft dan menyimpan alasan. Draft bukan invoice resmi, Faktur Pajak, piutang, atau pendapatan.
- **Titik operasional penagihan:** status delivered berarti penerimaan pelanggan telah dicatat pada shipment dan membuat draft invoice secara atomik. Perubahan tersebut tidak menerbitkan invoice komersial atau jurnal; issue & posting AR harus dijalankan setelah kebijakan/COA disetujui dan tanggal invoice masuk periode terbuka. Aturan pengakuan harus cocok dengan kontrak dan bukti penyerahan hak/kendali.
- **Dokumen supplier:** capture angka faktur seperti sumbernya. Posting AP tersedia dalam kerangka baru setelah review manual; total supplier didebit ke akun clearing biaya (bukan HPP) dan dikreditkan ke AP. Header harus merekonsiliasi: untuk `exclusive`, `subtotal − diskon + PPN + biaya lain = total`; untuk `inclusive`, subtotal sudah memuat PPN sehingga `subtotal − diskon + biaya lain = total`. PPN masukan hanya didebit ke akun PPN masukan setelah perlakuan `recoverable` direview; selisih kuantitas/harga terhadap PO tetap harus direkonsiliasi manual.

## Pajak/PPN: kontrol sistem yang diperlukan

Pada 2025 tarif PPN umum berubah menjadi 12%. Untuk sejumlah penyerahan barang/jasa non-mewah, aturan memakai DPP Nilai Lain sebesar 11/12 sehingga beban efektif umumnya 11%; PMK 11/2025 juga mengatur jenis DPP Nilai Lain/Besaran Tertentu lainnya. Karena perlakuan tergantung kategori barang/jasa dan syarat transaksi, sistem **tidak boleh menganggap semua produk medis mengikuti rumus umum**. Kategori barang medis dapat memiliki pengecualian atau syarat khusus yang perlu diperiksa per klasifikasi.

Rancangan kontrol sebelum penerbitan:

1. Profil legal perusahaan: nama, alamat, NPWP, status PKP, nomor seri/otorisasi Faktur Pajak dan identitas penerbit. Tanpa konfigurasi tervalidasi, penerbitan resmi dinonaktifkan.
2. Tax code berversi berdasarkan tanggal efektif: tidak kena pajak/dikecualikan, umum dengan DPP aktual, umum dengan DPP Nilai Lain 11/12, besaran tertentu, atau perlakuan khusus. Tax code menyimpan dasar hukum, tarif nominal, faktor DPP, cara pembulatan, dan persetujuan.
3. Produk berstatus `unreviewed` secara default. Penerbitan invoice diblokir sampai klasifikasi produk dan status PKP penjual/pembeli ditinjau oleh pihak berwenang. Tarif PPN di faktur supplier tetap data laporan dokumen, bukan konfigurasi pajak jual.
4. Simpan snapshot tax code, tarif, faktor DPP, dasar pajak, nilai PPN dan aturan pembulatan pada invoice; perubahan kebijakan tidak mengubah invoice yang sudah diterbitkan.
5. Jangan menerbitkan e-Faktur atau menyatakan faktur valid pajak hanya dengan PDF cetak browser. Integrasi/otorisasi platform DJP merupakan alur terpisah.

**Belum ada tarif atau klasifikasi pajak yang diaktifkan dalam aplikasi.** Sumber resmi DJP: [PMK 11/2025—DPP Nilai Lain dan Besaran Tertentu PPN](https://www.pajak.go.id/en/node/114038). Dokumen produk dan ketentuan terbaru tetap harus diperiksa sebelum aktivasi.

## Rancangan pengakuan AP/HPP/pendapatan

Ini kebijakan usulan untuk direview, bukan saran akuntansi final:

- **Utang supplier (AP):** diakui ketika faktur supplier valid telah dicocokkan dan diposting, bukan ketika PO dibuat. Jika barang sudah dikirim ke pelanggan sebelum tagihan supplier diterima, gunakan akun akrual biaya langsung/utang barang diterima belum ditagih berdasarkan bukti dan kebijakan cut-off; reklasifikasi ketika faktur supplier diposting.
- **Modal/HPP:** tidak membuat saldo persediaan gudang. Biaya aktual supplier, diskon dan ongkos yang dapat diatribusikan ditautkan ke PO-line dan dialokasikan konsisten pada jumlah unit. Akui HPP pada titik transfer kendali/pemenuhan pelanggan sesuai kontrak dan bukti penerimaan. Jika faktur supplier belum tersedia saat itu, gunakan estimasi yang disetujui lalu catat selisih terhadap biaya aktual sebagai penyesuaian terjejak. Jangan menampilkan HPP aktual dari `quoted_unit_cost` PO.
- **Pendapatan/AR:** pada penyerahan yang memenuhi syarat pengakuan sesuai kontrak (default rancangan: penerimaan pelanggan yang terdokumentasi), buat invoice resmi dan jurnal. Status `delivered` saja tidak membuktikan kewajiban hukum/pajak terpenuhi.
- **PPN keluaran/masukan:** pisahkan dari pendapatan dan biaya hanya setelah klasifikasi serta kelayakan kredit pajak disahkan. PPN masukan pada capture invoice supplier belum otomatis dapat dikreditkan.
- **Pembayaran pelanggan:** capture operasional yang sudah termigrasi menyimpan receipt sebagai dana terverifikasi; saat journal-post, debit kas/bank dan kredit uang muka pelanggan. Alokasi yang dijurnal kemudian mendebit uang muka dan mengkredit AR invoice; sisa dana tetap kredit pelanggan. **Pembayaran supplier:** saat journal-post debit uang muka supplier dan kredit kas/bank; alokasi kemudian mendebit AP dan mengkredit uang muka supplier. Alokasi operasional tidak otomatis membuat jurnal.
- **Biaya total/diskon:** alokasikan ke baris memakai basis yang konsisten dan simpan metode serta angka pembulatan; sisa sen dikoreksi deterministik pada baris terakhir. Credit note/retur setelah posting harus memakai dokumen reversal/penyesuaian, bukan mengedit transaksi lama.

Jurnal contoh untuk diputuskan bersama akuntan:

- Saat invoice pelanggan resmi: Dr Piutang; Cr Pendapatan neto; Cr PPN Keluaran (jika berlaku).
- Saat pengakuan biaya direct-delivery: Dr HPP; Cr AP atau akrual biaya belum ditagih. Tidak ada akun persediaan fisik.
- Saat faktur supplier diposting setelah akrual: Dr akrual biaya belum ditagih/akun penyesuaian biaya dan Dr PPN Masukan yang memenuhi syarat; Cr AP.
- Saat penerimaan pelanggan: Dr Bank/Kas; Cr Piutang. Saat bayar supplier: Dr AP; Cr Bank/Kas.

Pemetaan COA, pembebanan biaya kirim, diskon header, retur, HPP aktual, uang muka, margin negatif, rounding dan akun selisih belum disahkan. Kerangka posting memakai referensi kebijakan, debit=kredit, transaksi atomik, source idempotency untuk payment, dan reversal yang menaut ke jurnal asal. DPP/nominal/rate invoice pelanggan harus presisi sesuai skala rupiah; tarif dan DPP tidak dihitung otomatis. `cash` dan `bank_transfer` didukung; metode check/card/other tidak memiliki pemetaan ledger dan belum boleh diposting.

## Pembayaran dan alokasi

Keputusan tahap pembayaran: Owner/Admin dapat mencatat penerimaan pelanggan dan pengeluaran supplier yang telah terverifikasi, dengan referensi dan metode; sisa dana tetap sebagai uang muka yang belum teralokasi. RPC server-side memvalidasi role, nominal positif IDR, dan audit reason untuk void. Idempotency key juga mencegah retry capture menggandakan transaksi. Batch alokasi parsial/multi-invoice hanya menerima invoice pelanggan `issued` atau faktur supplier `posted`; transaksi mengunci pembayaran dan dokumen, memeriksa saldo, dan idempotency key mencegah duplikasi request. Void pembayaran membatalkan batch aktifnya dengan alasan/audit yang tercatat. Viewer hanya baca. Uang muka supplier tidak boleh dialokasikan ke faktur draft.

Migration pembayaran `20261016215508` sudah tercatat remote: receipt/disbursement dapat dicatat dan alokasi dibatasi ke dokumen posted. Belum ada invoice/faktur eligible untuk alokasi. Accounting migration `20261016225329` juga sudah tercatat remote; pembayaran belum memengaruhi ledger sampai jurnal diposting setelah konfigurasi dan approval disahkan.

## Jurnal, tutup buku, audit dan dokumen

- COA harus disetujui pemilik/akuntan; framework mencatat nomor jurnal, sumber, periode, pengguna, tanggal, IDR, total debit/kredit dan status posted/reversed. Migration tidak men-seed COA/mapping; audit remote menemukan 10 akun COA sudah ada tetapi belum direview, sementara mapping masih kosong. Approval gate membutuhkan 10 mapping, empat referensi kebijakan, referensi persetujuan, dan periode terbuka.
- Jurnal posted tidak diedit/dihapus. Posting payment/allocations hanya memiliki jalur reversal terhubung ke transaksi sumber; invoice reversal/credit note belum didukung. Tutup periode dasar menolak source draft dan jurnal tidak seimbang, tetapi **tidak menggantikan** rekonsiliasi bank, AR/AP, pajak, trial balance, jurnal manual dan pemeriksaan cutoff. Reopen workflow belum tersedia.
- Audit umum mencatat actor, timestamp, aksi, entitas, nilai sebelum/sesudah yang aman, dan alasan. Jangan simpan password, token, nomor kartu, atau rahasia dalam log.
- Metadata lampiran harus terhubung ke object storage privat, memakai signed URL singkat, MIME/size allowlist, checksum, pemindaian file, retensi dan audit unduh.
- Ekspor laporan mesti dapat direproduksi untuk rentang tanggal dan menyertakan waktu dibuat, timezone, currency, filter, status, nomor halaman serta label sumber data.

## Backup/restore dan keamanan

1. Tetapkan backup terjadwal dan retensi sesuai kebijakan perusahaan. Verifikasi opsi backup/PITR project Supabase secara terpisah; jangan menganggap migration atau Git sebagai salinan data bisnis.
2. Simpan salinan terenkripsi di lokasi terpisah dengan akses terbatas, rotasi/retensi, checksum dan bukti keberhasilan. Backup harus mencakup data, konfigurasi migration, metadata auth yang dibutuhkan, dan daftar konfigurasi object storage; rahasia dikelola terpisah.
3. Uji restore di project non-production yang terisolasi; cek row count, constraint, RLS, role, file, totals dan saldo trial balance. Catat RPO/RTO yang disepakati. Jangan uji restore pada Production.
4. Pastikan publishable key saja berada di browser; service-role key tidak boleh di Git/client/log. RLS deny-by-default, SECURITY DEFINER dengan search_path kosong dan role check, MFA bagi administrator jika tersedia, least privilege, audit akses, dependency scan, HTTPS dan kebijakan sesi.
5. Sebelum release jalankan security/performance advisor; tinjau temuan SECURITY DEFINER dan dependency advisories. Jangan menganggap build berhasil sebagai persetujuan keamanan.

## UAT wajib sebelum cutover

Gunakan project non-production dengan akun Owner, Admin, dan Viewer terpisah serta data sintetis. Uji minimum:

- SO dengan harga snapshot/override; PO split supplier; oversell, race condition dan cancellation.
- Faktur supplier duplikat, mismatch PO/supplier/quantity/tax arithmetic, void dan rekonsiliasi diskon/ongkos.
- Shipment parsial beberapa kali; shipment yang issue/cancelled; invoice draft terpisah per delivered; jumlah invoiced tidak melebihi SO; sisa pembulatan tepat; void/recreate.
- Setiap klasifikasi PPN termasuk produk belum ditinjau, PKP/non-PKP, inclusive/exclusive, DPP aktual/nilai lain, pembulatan, tanggal efektif, pengecualian dan reversal diuji oleh akuntan/pajak.
- Invoice resmi, posting AP/HPP/pendapatan, penerimaan/pembayaran parsial dan multi-invoice, saldo uang muka, alokasi yang bersaing, void beralasan, jurnal seimbang/idempoten, reversal dan tutup/reopen periode.
- Role/RLS untuk semua tabel dan RPC: Viewer tidak dapat menulis; user tanpa role ditolak; perubahan API langsung tidak dapat melewati RPC.
- Ekspor laporan, audit, lampiran, backup dan restore diverifikasi. Jalankan UAT desktop/mobile, keyboard/screen reader, error/loading/empty states dan alur cetak.

## Status cutover saat ini

Project yang diperiksa berstatus aktif dan memiliki record operasional terbatas: 1 shipment dan 1 record masing-masing penerimaan pelanggan/pembayaran supplier, sedangkan invoice pelanggan, faktur supplier, mapping, periode, dan jurnal masih kosong. Pastikan record yang ada diklasifikasikan sebagai data uji atau transaksi yang perlu dipertahankan. Accounting migration sudah tercatat remote; framework menyediakan posting AP/AR/jurnal setelah konfigurasi disetujui, tetapi bukan e-Faktur, belum menghitung pajak otomatis, belum mengakui HPP aktual, dan belum menyediakan laporan GL, audit umum, backup/restore atau UAT role-based penuh. Jangan mengoperasikan pembukuan atau cutover sebelum kebijakan dan seluruh UAT disetujui dan dilaksanakan.
