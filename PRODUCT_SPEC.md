# Spesifikasi Produk — Jena Medical Center Business Suite

**Status:** keputusan bisnis pada dokumen ini disahkan pemilik pada 17 Oktober 2026. Tidak ada pertanyaan kebijakan bisnis terbuka. Implementasi teknis dan kesiapan cutover dicatat terpisah di bagian 4 dan 6.
**Sumber kebenaran:** keputusan produk ada di dokumen ini; kebijakan akuntansi/pajak rinci ada di `ACCOUNTING_POLICY_AND_CUTOVER.md`; pedoman tampilan ada di `UI_UX_GUIDELINES.md`. Aturan kerja agent ada di `AGENTS.md`.
**Prinsip status:** keputusan yang disetujui tidak berarti implementasinya sudah tersedia. Untuk status skema terkini, gunakan `DATABASE_INTEGRATION_READINESS.md` dan `SUPABASE_INTEGRATION.md`.

> **Status implementasi Production — 23 Oktober 2026:** Seluruh migration D-10 dan master data (24 migration total) sudah diterapkan di Supabase dan arsip `supabase/migrations/` sinkron 24/24 dengan history remote (md5 identik). Objek shipment legacy sudah tidak ada di remote (D-09 selesai di schema). Deployment Cloudflare live `https://jena-medica.fa-mitra.my.id` terverifikasi menjalankan commit `main` terkini (build `3a8ecc7e`, commit `ea42494`), dan CI `main` lulus. Ini belum menyatakan cutover siap: UAT pembulatan/nilai kumulatif/concurrency/UI ber-role, klasifikasi data uji vs riil (D-05) termasuk dua SO lama tanpa invoice, aktivasi Leaked Password Protection, dan backup/restore teruji masih perlu diselesaikan.

## 1. Model bisnis

- Jena Medical Center adalah distributor B2B barang medis dengan model **drop-ship**. Tidak ada gudang, saldo stok, batch, FEFO, atau persediaan fisik dalam sistem.
- Supplier dan pelanggan mengurus pengiriman langsung. Sistem **tidak** mencatat resi, surat jalan, kurir, status kirim, atau penerimaan barang (D-09).
- Skala awal: 5 pelanggan tetap dan 2 supplier tetap; desain tetap dapat berkembang.
- Peran aplikasi: Owner, Admin, dan Viewer (hanya baca). Bahasa layar ditujukan kepada pemilik bisnis yang bukan akuntan.
- Satu proyek Supabase digunakan untuk satu perusahaan. Belum ada isolasi multi-tenant.

## 2. Alur target

Pesanan Pelanggan (SO) → Draf invoice pelanggan otomatis untuk ditinjau → Terbitkan invoice → Pembayaran dan alokasi → Jurnal → Laporan dan Dashboard. Pembelian supplier dicatat sebagai Faktur Supplier langsung dari dokumen; PO dibuat manual di luar ERP dan bukan prasyarat pencatatan.

Invoice pelanggan tidak bergantung pada shipment atau event pengiriman sistem. Sebelum menerbitkan invoice, Owner/Admin wajib mengonfirmasi penyerahan barang melalui komunikasi/bukti di luar aplikasi sesuai kebijakan akuntansi.

Harga jual berbeda per pelanggan untuk barang yang sama. Harga dan detail penting disalin ke transaksi agar perubahan master tidak mengubah histori transaksi.

## 3. Keputusan pemilik

Jika kode, dokumen teknis, atau instruksi agent bertentangan dengan keputusan ini dan kebijakan akuntansi, berhenti dan klarifikasi kepada pemilik. Keputusan berikut disahkan 17 Oktober 2026.

| ID | Keputusan yang berlaku | Status |
|---|---|---|
| D-01 | Hitungan faktur Supplier oleh sistem adalah **usulan**. Angka tercetak pada faktur asli adalah sumber kebenaran. Tampilkan usulan, angka tercetak, dan selisih. Draft boleh disimpan dengan selisih; catat ke pembukuan hanya bila selisih akhir nol. Penyesuaian pembulatan maksimal Rp10/faktur mengikuti `ACCOUNTING_POLICY_AND_CUTOVER.md` bagian 5 dan harus dicatat eksplisit. | Disetujui |
| D-02 | Modal efektif dihitung dengan alokasi proporsional diskon faktur, biaya angkut/biaya lain, dan PPN yang tidak dapat dikreditkan. Tampilkan modal sebelum PPN dan PPN faktur secara terpisah. HPP mengikuti kebijakan akuntansi bagian 6; harga estimasi PO tidak boleh disebut HPP aktual. | Disetujui |
| D-03 | Status PKP adalah konfigurasi perusahaan berdasarkan dokumen resmi. Gunakan tax code berversi berdasarkan tanggal efektif, bukan tarif permanen di kode. Kebijakan awal menetapkan `PPN_UMUM` dan `PPN_BEBAS`; klasifikasi serta aktivasi harus mengikuti kebijakan akuntansi dan konfigurasi yang disetujui. Tarif umum 12% dengan DPP Nilai Lain 11/12 (efektif 11%) hanya diterapkan pada transaksi yang memenuhi ketentuan. | Disetujui sebagai kebijakan awal; konfigurasi perusahaan belum diisi |
| D-04 | KPI keuangan hanya dihitung dari jurnal yang sudah dibukukan. Sebelum itu, layar hanya boleh menampilkan hitungan operasional dengan label yang jelas. | Disetujui |
| D-05 | Hanya ada satu proyek Supabase yang digunakan sebagai Production. Data uji harus diinventarisasi, dicadangkan, dan dibersihkan secara terkontrol sebelum cutover. Jangan membuat seed otomatis atau memasukkan data bisnis riil sebelum pembersihan disetujui. | Disetujui |
| D-06 | Dokumen pelanggan hanya berisi informasi bisnis pelanggan, bukan istilah/status internal. PDF invoice komersial bukan Faktur Pajak/e-Faktur. Pengiriman ke pelanggan memakai berkas PDF A4 yang dibuat aplikasi dan dibagikan lewat menu bagikan perangkat (WhatsApp); aplikasi tidak mengirim pesan otomatis dan tidak membuat e-Faktur. | Disetujui |
| D-07 | Transaksi tidak dihapus permanen. Gunakan pembatalan beralasan, nota kredit, atau jurnal pembalik sesuai status transaksi; jurnal yang dibukukan tidak diedit atau dihapus. | Disetujui |
| D-08 | UI menggunakan bahasa bisnis sehari-hari sesuai kamus di `UI_UX_GUIDELINES.md`. | Disetujui |
| D-09 | Tidak ada pencatatan pengiriman. Hapus menu, halaman, komponen, tabel `shipments`, `shipment_lines`, `shipment_status_events`, RPC terkait, dan trigger auto-invoice berbasis delivered. Jangan menambah kembali fitur pengiriman. Penghapusan modul pengiriman, semua record shipment dan tabel/objek dependennya dilakukan langsung sesuai instruksi pemilik; tidak menunggu backup sebagai prasyarat. Tabel dan record pembayaran tidak termasuk scope. | Disetujui; migration dasar D-09/D-10 sudah tercatat di Production |
| D-10 | Setelah SO dikonfirmasi, sistem membuat **draf invoice pelanggan otomatis** untuk ditinjau Owner/Admin. Draf dapat diedit sebelum diterbitkan; draf tidak mengakui pendapatan atau piutang. Invoice baru diakui saat diterbitkan. Satu SO boleh memiliki beberapa invoice; kuantitas dan nilai kumulatif seluruh invoice aktif tidak boleh melebihi SO dan wajib dijaga di database. Pembuatan draf harus idempoten agar konfirmasi ulang/retry tidak membuat draf ganda. Invoice tidak memiliki `shipment_id`. Pengiriman invoice memakai berkas PDF A4 hasil generator aplikasi lewat menu bagikan perangkat; aplikasi tidak mengirim pesan otomatis. Pembayaran hanya melunasi piutang atau dicatat sebagai uang muka bila diterima sebelumnya. | Disetujui; dokumentasi target. Implementasi dan skema remote harus diverifikasi sebelum Production |
| D-11 | Supabase adalah sumber kebenaran skema untuk satu proyek. File di `supabase/migrations/` merupakan arsip berisi perubahan skema yang benar-benar diterapkan; versi/nama file harus cocok dengan migration history remote. Setiap perubahan skema harus dijelaskan dalam PR beserta dampak data dan langkah verifikasinya. Jangan menjalankan `db push` atau perubahan skema tanpa persetujuan dan prosedur perubahan yang jelas. | Disetujui |

## 4. Status fitur dan skema saat audit

Status berikut adalah **snapshot historis per 17 Oktober 2026**, bukan status remote terkini. Untuk kondisi terkini, gunakan blok rekonsiliasi di awal dokumen dan `DATABASE_INTEGRATION_READINESS.md`.

| Area | Kondisi remote yang teramati | Target/pekerjaan tersisa |
|---|---|---|
| Dashboard operasional | Tidak dinilai terpisah pada audit remote 17 Oktober 2026 | Branch `feat/dashboard-mockup` menambahkan filter 7 hari/30 hari/tahun berjalan, ringkasan status dan antrean tindakan berbasis hitungan server Supabase, serta grafik aktivitas 7 hari. Deployment dan verifikasi data aktual masih diperlukan. |
| Master pelanggan/supplier/barang dan harga khusus | Ada dan aktif | UAT role-based dan verifikasi data sebelum cutover |
| SO/PO split dan capture faktur supplier | Ada | Validasi akhir sesuai D-01/D-02 dan alur invoice supplier |
| Shipment/pengiriman | Objek shipment (tabel, RPC, trigger) sudah dihapus dari Production oleh migration `20261017185346`; diverifikasi ulang 23 Oktober 2026 | Selesai di tingkat schema; jangan menambah kembali modul pengiriman |
| Invoice pelanggan | Model D-10 aktif penuh di Production: draf otomatis saat SO dikonfirmasi (idempoten), edit draf, lock order, batas nilai kumulatif jalur create/edit, dan tanggal invoice masa depan | UAT pembulatan, nilai kumulatif lintas invoice, concurrency, dan UI ber-role masih diperlukan |
| Pembayaran | 2 customer payment dan 1 supplier payment tercatat | Konfirmasi apakah data uji (D-05); jangan anggap otomatis aman dihapus |
| Kerangka akuntansi | 10 akun COA, profile `approved` (21 Oktober 2026), mapping 10, periode 1, jurnal 4 entri | Rekonsiliasi kualitas data dan UAT sebelum angka laporan dianggap final |
| Laporan GL/keuangan final, audit umum, backup/restore teruji | Belum lengkap/terverifikasi | Selesaikan sebelum cutover |

Data yang teramati pada 23 Oktober 2026 mencakup 2 customer, 1 supplier, 2 produk, 5 SO berstatus `confirmed` (6 baris), 1 harga customer-product, 3 PO (4 baris), 3 invoice `issued` (4 baris), 1 faktur supplier, dan 4 entri jurnal. Dua SO `confirmed` belum memiliki invoice sama sekali. Status/kegunaan record harus diverifikasi sebelum pembersihan; jangan mengasumsikan seluruh record operasional adalah data uji.

## 5. Urutan pengerjaan

1. Rekonsiliasi arsip migration dan status remote selesai (24/24 sinkron per 23 Oktober 2026); pertahankan version ID dan isi SQL arsip tetap cocok dengan history remote.
2. D-09/D-10: seluruh migration sudah diterapkan bersama kode dan terverifikasi di Production. Sisa pekerjaan adalah UAT alur tinjau/edit/terbitkan, guard nilai kumulatif, concurrency, dan pembulatan.
3. Lengkapi validasi faktur Supplier: hitungan usulan, angka tercetak, selisih, modal efektif, dan aturan posting D-01/D-02.
4. Lengkapi invoice komersial, pratinjau/cetak bersih, dan pengiriman berkas PDF A4 via WhatsApp sesuai D-06.
5. Konfigurasikan profil pajak dan COA, mapping akun, referensi approval, serta periode akuntansi. Kerangka posting yang ada masih terkunci oleh konfigurasi.
6. Selesaikan UAT Owner/Admin/Viewer, backup/restore, rekonsiliasi dan laporan sebelum cutover.

## 6. Cutover dan pembersihan data uji

Target cutover awal tahun buku adalah **1 Januari 2027**, tetapi hanya berlaku jika seluruh prasyarat pembukuan selesai. Keputusan D-09 secara terpisah menyetujui penghapusan langsung objek dan record shipment yang dianggap data uji; penghapusan itu tidak menunggu cutover.

1. Selesaikan D-09/D-10: hapus tabel/RPC/trigger dan record shipment, lalu lepaskan semua dependensi invoice lama.
2. Pertahankan tabel dan record pembayaran pelanggan/supplier.
3. Verifikasi RLS, role, constraint, saldo, dan relasi setelah perubahan skema.
4. Untuk cutover pembukuan, buat backup penuh dan uji pemulihan pada lingkungan terisolasi.
5. Isi pengaturan pajak dan COA/mapping; rekam persetujuan Owner dan buka periode hanya setelah UAT lulus.
6. Tetapkan nomor dokumen sesuai kebijakan penomoran dan catat tanggal/pelaksana di audit/dokumen.

## 7. Definisi selesai untuk setiap PR

- Perilaku sesuai keputusan D-01–D-11 dan status implementasi tidak diklaim lebih maju dari kondisi sebenarnya.
- PR skema menyatakan tabel/fungsi/trigger yang berubah, data terdampak, cara validasi, dan status penerapan. Untuk D-09, penghapusan sudah disetujui pemilik dan tidak ditunda untuk peringatan backup.
- Jalankan `npm run lint`, `npm run build`, dan `npm run build:worker` untuk perubahan aplikasi; jangan mengklaim lulus bila belum dijalankan.
- Jangan commit rahasia. Hanya publishable key yang boleh dipakai di browser.


## Keputusan implementasi — Faktur Supplier langsung

- PO dibuat manual di luar ERP; PO bukan prasyarat untuk mencatat faktur supplier.
- Faktur supplier adalah sumber data utama. Setiap baris menyimpan kode barang (opsional), nama barang, satuan, kuantitas, harga/unit, diskon baris, dan total baris sesuai dokumen.
- UI tidak meminta `Mode Harga`; sistem tidak boleh menyimpulkan apakah harga termasuk PPN. Status pajak dan angka yang tercetak disalin dari dokumen, tanpa menghitung atau menebak pajak.
- Referensi PO historis tetap dipertahankan bila ada, tetapi baris baru boleh tanpa PO. Data faktur tetap berstatus draft dan belum membentuk hutang/jurnal sampai alur akuntansi yang disetujui tersedia.
- Status rilis: sudah diterapkan ke Production melalui migration `20261021195006` (supplier invoice direct capture); UAT alur faktur supplier tetap diperlukan sebelum cutover.


## Addendum keputusan pemilik — Penyederhanaan alur transaksi (23 Oktober 2026)

Addendum ini merupakan keputusan terbaru pemilik dan mengesampingkan alur lama yang bertentangan. Kebijakan akuntansi/pajak dan kontrol audit tetap berlaku.

### D-12 — Persetujuan supplier melalui WhatsApp
- Setelah pesanan pelanggan dibuat, pengguna menyiapkan dan membagikan rincian pesanan ke supplier melalui WhatsApp.
- Status pesanan menunggu balasan supplier. Aplikasi tidak mengklaim dapat membaca atau mendeteksi balasan WhatsApp secara otomatis.
- Setelah pengguna menerima balasan/persetujuan supplier, pengguna mencatat persetujuan tersebut di Jena. Konfirmasi bukan tombol administratif yang boleh ditekan tanpa persetujuan.
- Jika supplier meminta perubahan, pesanan dikoreksi dan dikirim ulang sebelum dikonfirmasi. Perubahan setelah konfirmasi harus mengikuti aturan koreksi transaksi dan audit trail.
- Konfirmasi SO membuat draf invoice pelanggan secara otomatis dan idempoten. Pengguna tidak membuat invoice secara manual.

### D-13 — Review, penerbitan invoice, berbagi WhatsApp, dan posting otomatis
- Pengguna meninjau/mengoreksi draf invoice yang dibuat otomatis dari SO terkonfirmasi.
- Tidak ada langkah verifikasi penyerahan barang di aplikasi dan tidak ada status pengiriman. Ini sesuai model drop-ship D-09 dan instruksi pemilik terbaru.
- Satu aksi utama **Terbitkan & Bagikan Invoice** menjalankan penerbitan invoice melalui mekanisme posting akuntansi yang aman, lalu membuka menu berbagi perangkat untuk PDF A4 dan WhatsApp.
- Penerbitan invoice otomatis mencatat piutang dan jurnal sesuai konfigurasi akuntansi/pajak yang telah disetujui. Pengguna tidak perlu membuka Keuangan/Jurnal Umum atau menjalankan posting manual untuk transaksi rutin.
- Penerbitan dan pembentukan jurnal harus idempoten serta atomik sesuai kemampuan transaksi database. Jika posting gagal, invoice tidak boleh dilaporkan berhasil terbit.
- Status terbit adalah status dokumen di Jena; keberhasilan membuka menu berbagi atau pengiriman aktual di WhatsApp harus ditampilkan terpisah. Retry berbagi tidak boleh menerbitkan invoice/jurnal kedua kali.
- Jika konfigurasi akuntansi atau pajak yang diwajibkan belum valid, sistem menjelaskan pengaturan yang perlu diperbaiki dan tidak melewati kontrol tersebut.

### D-14 — Unggah faktur supplier dan ekstraksi otomatis
- Form faktur supplier selalu tersedia dengan kolom yang dapat diisi atau diedit manual.
- Pengguna dapat mengunggah foto atau PDF faktur. Sistem mengekstrak data dokumen dan mengisi field yang sesuai; hasil ekstraksi harus dapat ditinjau dan dikoreksi sebelum posting.
- Dokumen asli tetap tersedia sebagai referensi. Teks/angka yang tidak terbaca dibiarkan kosong dan ditandai untuk pemeriksaan; sistem tidak boleh mengarang nilai.
- Angka tercetak pada faktur asli tetap menjadi sumber kebenaran (D-01). Tampilkan nilai hasil hitungan sistem, nilai tercetak, dan selisih. Draft boleh disimpan dengan selisih, tetapi posting diblokir sampai selisih akhir memenuhi kebijakan D-01.
- Terapkan validasi format/ukuran file, pemeriksaan kemungkinan faktur duplikat, akses dokumen berbasis role, dan pencatatan koreksi/approval. Rahasia OCR tidak boleh berada di browser atau Git.
- Status implementasi D-14: keputusan produk disetujui; implementasi OCR, penyimpanan dokumen, dan pengujian masih harus diverifikasi/dikerjakan sebelum dinyatakan aktif.
