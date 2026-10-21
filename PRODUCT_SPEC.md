# Spesifikasi Produk — Jena Medical Center Business Suite

**Status:** keputusan bisnis pada dokumen ini disahkan pemilik pada 17 Oktober 2026. Tidak ada pertanyaan kebijakan bisnis terbuka. Implementasi teknis dan kesiapan cutover dicatat terpisah di bagian 4 dan 6.
**Sumber kebenaran:** keputusan produk ada di dokumen ini; kebijakan akuntansi/pajak rinci ada di `ACCOUNTING_POLICY_AND_CUTOVER.md`; pedoman tampilan ada di `UI_UX_GUIDELINES.md`. Aturan kerja agent ada di `AGENTS.md`.
**Prinsip status:** keputusan yang disetujui tidak berarti implementasinya sudah tersedia. Untuk status skema terkini, gunakan `DATABASE_INTEGRATION_READINESS.md` dan `SUPABASE_INTEGRATION.md`.

## 1. Model bisnis

- Jena Medical Center adalah distributor B2B barang medis dengan model **drop-ship**. Tidak ada gudang, saldo stok, batch, FEFO, atau persediaan fisik dalam sistem.
- Supplier dan pelanggan mengurus pengiriman langsung. Sistem **tidak** mencatat resi, surat jalan, kurir, status kirim, atau penerimaan barang (D-09).
- Skala awal: 5 pelanggan tetap dan 2 supplier tetap; desain tetap dapat berkembang.
- Peran aplikasi: Owner, Admin, dan Viewer (hanya baca). Bahasa layar ditujukan kepada pemilik bisnis yang bukan akuntan.
- Satu proyek Supabase digunakan untuk satu perusahaan. Belum ada isolasi multi-tenant.

## 2. Alur target

Pesanan Pelanggan (SO) → Order ke Supplier (PO; satu SO dapat dipecah ke beberapa supplier) → Faktur Supplier → Invoice Pelanggan manual dari SO terkonfirmasi → Pembayaran dan alokasi → Jurnal → Laporan dan Dashboard.

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
| D-06 | Dokumen pelanggan hanya berisi informasi bisnis pelanggan, bukan istilah/status internal. PDF invoice komersial bukan Faktur Pajak/e-Faktur. WhatsApp menggunakan tautan PDF; aplikasi tidak mengirim pesan atau membuat e-Faktur secara otomatis. | Disetujui |
| D-07 | Transaksi tidak dihapus permanen. Gunakan pembatalan beralasan, nota kredit, atau jurnal pembalik sesuai status transaksi; jurnal yang dibukukan tidak diedit atau dihapus. | Disetujui |
| D-08 | UI menggunakan bahasa bisnis sehari-hari sesuai kamus di `UI_UX_GUIDELINES.md`. | Disetujui |
| D-09 | Tidak ada pencatatan pengiriman. Hapus menu, halaman, komponen, tabel `shipments`, `shipment_lines`, `shipment_status_events`, RPC terkait, dan trigger auto-invoice berbasis delivered. Jangan menambah kembali fitur pengiriman. Penghapusan modul pengiriman, semua record shipment dan tabel/objek dependennya dilakukan langsung sesuai instruksi pemilik; tidak menunggu backup sebagai prasyarat. Tabel dan record pembayaran tidak termasuk scope. | Disetujui; UI legacy sudah dihapus pada branch ini, migration schema menunggu penerapan |
| D-10 | Setelah SO dikonfirmasi, sistem membuat **draf invoice pelanggan otomatis** untuk ditinjau Owner/Admin. Draf dapat diedit sebelum diterbitkan; draf tidak mengakui pendapatan atau piutang. Invoice baru diakui saat diterbitkan. Satu SO boleh memiliki beberapa invoice; kuantitas dan nilai kumulatif seluruh invoice aktif tidak boleh melebihi SO dan wajib dijaga di database. Pembuatan draf harus idempoten agar konfirmasi ulang/retry tidak membuat draf ganda. Invoice tidak memiliki `shipment_id`. WhatsApp hanya dibuka dengan pesan dan tautan PDF; aplikasi tidak mengirim pesan otomatis. Pembayaran hanya melunasi piutang atau dicatat sebagai uang muka bila diterima sebelumnya. | Disetujui; dokumentasi target. Implementasi dan skema remote harus diverifikasi sebelum Production |
| D-11 | Supabase adalah sumber kebenaran skema untuk satu proyek. File di `supabase/migrations/` merupakan arsip berisi perubahan skema yang benar-benar diterapkan; versi/nama file harus cocok dengan migration history remote. Setiap perubahan skema harus dijelaskan dalam PR beserta dampak data dan langkah verifikasinya. Jangan menjalankan `db push` atau perubahan skema tanpa persetujuan dan prosedur perubahan yang jelas. | Disetujui |

## 4. Status fitur dan skema saat audit

Status berikut adalah **kondisi teramati per 17 Oktober 2026**, bukan target desain. Supabase memiliki 9 migration dan 27 tabel publik; semua tabel publik memakai RLS dan memiliki policy.

| Area | Kondisi remote yang teramati | Target/pekerjaan tersisa |
|---|---|---|
| Dashboard operasional | Tidak dinilai terpisah pada audit remote 17 Oktober 2026 | Branch `feat/dashboard-mockup` menambahkan filter 7 hari/30 hari/tahun berjalan, ringkasan status dan antrean tindakan berbasis hitungan server Supabase, serta grafik aktivitas 7 hari. Deployment dan verifikasi data aktual masih diperlukan. |
| Master pelanggan/supplier/barang dan harga khusus | Ada dan aktif | UAT role-based dan verifikasi data sebelum cutover |
| SO/PO split dan capture faktur supplier | Ada | Validasi akhir sesuai D-01/D-02 dan alur invoice supplier |
| Shipment/pengiriman | Remote audit: tabel dan RPC ada, 1 record `shipped`; kode branch ini telah menghapus UI shipment | Migration D-09 menghapus tabel/record/RPC/trigger; belum diterapkan remote |
| Invoice pelanggan | Migration accounting framework telah menyediakan metadata dan RPC penerbitan/posting. Migration D-09/D-10 di repo memutus relasi shipment, tetapi belum mengimplementasikan trigger D-10 dan editor draf. Status remote belum diverifikasi ulang. | PR D-10 menambahkan draf otomatis pada transisi SO ke confirmed, RPC edit draf, dan pembatas satu draf aktif per SO. PR #49/#50 memperbaiki urutan lock dan batas nilai saat edit draf; PR lanjutan mengusulkan batas nilai pada jalur pembuatan invoice. Migration belum diterapkan ke production. Perlu rekonsiliasi D-11, review SQL, pengujian pembulatan/concurrency, build, dan UAT sebelum rilis bersama kode. |
| Pembayaran | 1 customer payment dan 1 supplier payment berstatus `recorded` | Konfirmasi apakah data uji; jangan anggap otomatis aman dihapus |
| Kerangka akuntansi | Migration sudah diterapkan; 10 akun COA, profile `draft`, mapping 0, periode 0, jurnal 0 | Konfigurasi COA/mapping/policy dan periode, lalu UAT sebelum posting |
| Laporan GL/keuangan final, audit umum, backup/restore teruji | Belum lengkap/terverifikasi | Selesaikan sebelum cutover |

Data yang teramati juga mencakup 1 customer, 1 supplier, 2 produk, 2 SO berstatus `confirmed`, 2 baris SO, 1 harga customer-product, dan 1 PO berstatus `sent`. Status/kegunaan record harus diverifikasi sebelum pembersihan; jangan mengasumsikan seluruh record operasional adalah data uji.

## 5. Urutan pengerjaan

1. Selesaikan rekonsiliasi dokumentasi dan pastikan lokasi dokumen tunggal di root repository ini.
2. D-09/D-10: UI shipment dihapus dan migration repository memutus relasi shipment dari invoice. PR lanjutan menambahkan draf otomatis saat SO dikonfirmasi, edit draf, serta pembatas satu draf aktif per SO. Validasi trigger, concurrency, alur tinjau/edit/terbitkan dan posting sebelum menerapkan migration bersama kode; jangan release parsial.
3. Lengkapi validasi faktur Supplier: hitungan usulan, angka tercetak, selisih, modal efektif, dan aturan posting D-01/D-02.
4. Lengkapi invoice komersial, pratinjau/cetak bersih, dan tautan PDF WhatsApp sesuai D-06.
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
