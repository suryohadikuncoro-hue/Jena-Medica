# Kebijakan Akuntansi & Gerbang Cutover — Jena Medical Center

**Status:** rancangan implementasi; belum disetujui pemilik/akuntan dan belum diterapkan ke database.  
**Model:** drop-ship langsung dari supplier ke pelanggan; sistem tidak mengelola persediaan fisik.

## Aturan yang sudah dapat dipakai

- **Invoice pelanggan:** satu draft per shipment yang dicatat `delivered`; setiap shipment parsial dapat ditagih dengan draft terpisah. Nilai neto berasal dari snapshot SO, dialokasikan pro-rata pada baris, dan sisa pembulatan masuk ke shipment terakhir. Void hanya untuk draft dan menyimpan alasan. Draft bukan invoice resmi, Faktur Pajak, piutang, atau pendapatan.
- **Titik operasional penagihan:** status delivered berarti penerimaan pelanggan telah dicatat pada shipment. Perubahan status ini belum membuat invoice atau jurnal otomatis. Aturan tersebut harus dicocokkan dengan kontrak, bukti serah terima, dan saat penyerahan hak/kendali yang ditetapkan perusahaan.
- **Dokumen supplier:** capture angka faktur seperti sumbernya. Draft saat ini tidak mengakui AP, HPP, pajak masukan yang dapat dikreditkan, atau jurnal. Selisih kuantitas/harga terhadap PO harus direkonsiliasi sebelum posting.

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
- **Pembayaran pelanggan:** pembayaran menjadi kas/bank dan kredit AR saat dana terverifikasi; alokasi mengurangi piutang invoice, dengan overpayment tetap menjadi kredit pelanggan. **Pembayaran supplier:** debit AP dan kredit kas/bank; uang muka supplier disimpan sebagai uang muka, bukan alokasi ke faktur draft.
- **Biaya total/diskon:** alokasikan ke baris memakai basis yang konsisten dan simpan metode serta angka pembulatan; sisa sen dikoreksi deterministik pada baris terakhir. Credit note/retur setelah posting harus memakai dokumen reversal/penyesuaian, bukan mengedit transaksi lama.

Jurnal contoh untuk diputuskan bersama akuntan:

- Saat invoice pelanggan resmi: Dr Piutang; Cr Pendapatan neto; Cr PPN Keluaran (jika berlaku).
- Saat pengakuan biaya direct-delivery: Dr HPP; Cr AP atau akrual biaya belum ditagih. Tidak ada akun persediaan fisik.
- Saat faktur supplier diposting setelah akrual: Dr akrual biaya belum ditagih/akun penyesuaian biaya dan Dr PPN Masukan yang memenuhi syarat; Cr AP.
- Saat penerimaan pelanggan: Dr Bank/Kas; Cr Piutang. Saat bayar supplier: Dr AP; Cr Bank/Kas.

Pemetaan COA, pembebanan biaya kirim, diskon header, retur, uang muka, margin negatif, rounding dan akun selisih belum disahkan. Posting harus idempoten, debit=kredit, atomik, memakai idempotency key, dan memiliki reversal yang menaut ke jurnal asal.

## Pembayaran dan alokasi

Rancangan perlindungan database: RPC server-side memvalidasi role Owner/Admin; tanggal dan rekening; jumlah positif; penguncian pembayaran/invoice saat alokasi; jumlah total alokasi tidak melampaui dana tersedia atau saldo invoice; tidak mengalokasikan ke draft/void; multi-invoice dan pembayaran cicilan boleh; kredit lebih/uang muka terpisah; pembatalan hanya dengan reversal/void beralasan. Viewer hanya baca. Bukti pembayaran disimpan sebagai dokumen privat dengan kontrol akses, bukan URL publik.

Belum ada tabel/RPC UI pembayaran yang aktif dan invoice pelanggan masih draft-only. Maka pembayaran belum dapat dicatat atau dialokasikan tanpa lebih dulu menyetujui serta menerapkan siklus invoice resmi dan ledger.

## Jurnal, tutup buku, audit dan dokumen

- COA harus disetujui pemilik/akuntan; jurnal mempunyai nomor, sumber, periode, pengguna, tanggal, currency, total debit/kredit dan status draft/posted/reversed.
- Jurnal posted tidak diedit/dihapus. Periode ditutup hanya setelah rekonsiliasi bank, AR/AP, pajak, trial balance, jurnal manual dan transaksi cutoff diperiksa. Reopen memerlukan role lebih tinggi, alasan dan audit event.
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
- Invoice resmi, posting AP/HPP/pendapatan, pembayaran parsial/multi-invoice, overpayment, supplier prepayment, race allocation, jurnal seimbang/idempoten, reversal dan tutup/reopen periode.
- Role/RLS untuk semua tabel dan RPC: Viewer tidak dapat menulis; user tanpa role ditolak; perubahan API langsung tidak dapat melewati RPC.
- Ekspor laporan, audit, lampiran, backup dan restore diverifikasi. Jalankan UAT desktop/mobile, keyboard/screen reader, error/loading/empty states dan alur cetak.

## Status cutover saat ini

Project yang diperiksa didokumentasikan sebagai Production dan berisi data uji pada tabel operasional. Perubahan UI lokal dalam branch saat ini menghilangkan angka demo dari dashboard/halaman keuangan, tetapi **tidak** membuat laporan buku besar. Tidak ada migration keuangan yang diterapkan remote dalam pekerjaan ini. Modul pembayaran, penerbitan invoice resmi, pajak jual, AP/HPP, jurnal, audit umum, backup/restore dan UAT role-based masih belum aktif. Jangan mengoperasikan pembukuan atau melakukan deployment cutover sampai kebijakan dan seluruh UAT di atas disetujui dan dilaksanakan.
