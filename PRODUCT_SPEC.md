# Spesifikasi Produk — Jena Medical Center Business Suite

**Status dokumen:** draf untuk disahkan pemilik (Suryo). Bagian bertanda **[PERLU KONFIRMASI]** belum final.
**Peran:** sumber kebenaran untuk *apa yang harus dibuat dan keputusan bisnis*. Kebijakan akuntansi rinci ada di `ACCOUNTING_POLICY_AND_CUTOVER.md`; aturan tampilan ada di `docs/UI_UX_GUIDELINES.md`.
**Perbarui dokumen ini di setiap PR yang mengubah perilaku produk.**

## 1. Model bisnis
- Jena Medical Center adalah distributor alat/barang medis dengan model **drop-ship**: suplier mengirim langsung ke pelanggan. Tidak ada gudang, stok, batch, FEFO, atau persediaan fisik.
- **Pengiriman bukan urusan sistem.** Suplier dan pelanggan mengurus pengiriman sendiri; Jena tidak mencatat resi, surat jalan, status kirim, atau penerimaan barang (D-09).
- Skala saat ini: 5 pelanggan tetap, 2 suplier tetap (desain tetap harus bisa bertambah).
- Pengguna: pemilik (Owner), Admin, Viewer (hanya baca). Satu pemilik bukan akuntan, jadi bahasa di layar harus mudah dipahami.

## 2. Alur target
Pesanan Pelanggan (SO) → Order ke Suplier (PO, bisa dipecah) → Faktur Suplier → Invoice Pelanggan (kirim via WhatsApp; pemicu pembuatan menunggu D-10) → Pembayaran (cash/kredit, parsial) → Jurnal otomatis → Laporan dan Dashboard. Tidak ada langkah pengiriman di dalam sistem.

Harga jual **berbeda per pelanggan** untuk barang yang sama, dengan riwayat tanggal berlaku. Transaksi lama tidak berubah saat harga berubah (salinan harga disimpan di baris transaksi).

## 3. Keputusan pemilik
Setiap keputusan punya ID. Jika kode, dokumen lain, atau instruksi agent bertentangan dengan keputusan di sini, **berhenti dan tanyakan**, jangan memilih sendiri.

| ID | Keputusan | Status |
|---|---|---|
| D-01 | Perhitungan otomatis di faktur suplier berlaku sebagai **usulan**. Angka tercetak di faktur asli tetap sumber kebenaran. UI menampilkan hitungan sistem berdampingan dengan angka tercetak beserta **selisihnya**, memakai rumus rekonsiliasi di `ACCOUNTING_POLICY_AND_CUTOVER.md`. Draf boleh disimpan walau ada selisih; pencatatan ke pembukuan **hanya boleh jika selisih nol** (sama dengan aturan database). Tidak ada toleransi. | Disetujui (penanganan selisih pembulatan **[PERLU KONFIRMASI]** dengan akuntan) |
| D-02 | **Modal efektif per item** ditampilkan sebagai usulan tampilan: (harga × qty − diskon baris − bagian diskon faktur secara proporsional) ÷ qty. Tampilkan dua angka terpisah: modal sebelum PPN dan PPN tercetak. PPN tidak dinyatakan dapat dikreditkan sebelum perlakuan `recoverable` ditinjau (kebijakan akuntansi); mana yang dipakai sebagai HPP menunggu keputusan akuntan, begitu juga pembulatan, ongkir, dan alokasi final. | Disetujui sebagai tampilan usulan |
| D-03 | **Tarif PPN tidak ditulis permanen di kode.** Gunakan tax code berversi per tanggal efektif (lihat kebijakan akuntansi). Catatan: sejak 2025 tarif umum 12% dengan DPP Nilai Lain 11/12 sehingga beban efektif umumnya 11% untuk barang non-mewah. Wajib diverifikasi ke sumber resmi sebelum dipakai. Status PKP Jena Medical Center: **[PERLU KONFIRMASI]**. | Menunggu akuntan |
| D-04 | Dashboard boleh menampilkan KPI keuangan (penjualan, laba, kas, piutang, hutang) **hanya dari jurnal yang sudah diposting**, dengan label periode dan waktu pembaruan. Sebelum jurnal aktif, tampilkan hitungan dokumen operasional saja, dengan label jelas. | Disetujui |
| D-05 | Hanya ada **satu proyek Supabase** (disebut Production). Data uji (TEST) boleh ada selama pengembangan, tetapi **harus dibersihkan sebelum dipakai sungguhan** (lihat bagian 6). Sebelum pembersihan, data bisnis riil tidak dimasukkan. Tidak ada skrip seed otomatis di proyek ini. | Disetujui |
| D-06 | Dokumen yang dikirim ke pelanggan **tidak boleh memuat teks internal** (status AR, keputusan pajak manual, model drop-ship). Bukan Faktur Pajak/e-Faktur. PDF dibagikan lewat tautan pada pesan WhatsApp. | Disetujui |
| D-07 | Tidak ada hapus permanen pada transaksi: gunakan batalkan (void) dengan alasan, jurnal balik, dan periode tutup. Audit log wajib. | Disetujui |
| D-08 | Istilah di layar memakai bahasa bisnis sehari-hari (kamus di `UI_UX_GUIDELINES.md`). | Disetujui |
| D-09 | **Tidak ada pencatatan pengiriman.** Hapus modul pengiriman: menu, halaman, komponen, dan tabel `shipments`, `shipment_lines`, `shipment_status_events`, lewat migrasi baru yang terkontrol (data uji saja yang terdampak). Jangan menambahkan resi, surat jalan, kurir, status kirim, atau penerimaan barang. | Disetujui |
| D-10 | **Dasar dan pemicu invoice pelanggan** (menggantikan "draf per pengiriman"). Invoice kini harus bersumber dari pesanan pelanggan, bukan pengiriman. Kapan invoice dibuat, apakah boleh parsial, dan kapan pendapatan diakui: **[PERLU KEPUTUSAN]** pemilik dan akuntan. Sampai diputuskan, jangan membuat migrasi invoice baru. | Menunggu keputusan |

## 4. Status fitur
Perbarui tabel ini di setiap PR. Status per 17 Oktober 2026 menurut `DATABASE_INTEGRATION_READINESS.md`.

| Fitur | Status |
|---|---|
| Master pelanggan, suplier, barang | Aktif |
| Harga per pelanggan (riwayat berlaku) | Aktif; koreksi mundur belum didukung |
| Pesanan pelanggan, Order ke suplier (split) | Aktif |
| Faktur suplier | Pencatatan draf saja; hitung usulan, selisih, dan modal per item **belum ada** (D-01, D-02) |
| Pengiriman langsung + timeline status | Aktif di kode, **akan dihapus (D-09)** |
| Invoice pelanggan (draf), cetak, WhatsApp | Draf aktif tetapi terikat pengiriman di database (`shipment_id` wajib); harus diubah ke dasar baru (D-10). PDF tertaut di WhatsApp belum ada |
| Pembayaran dan alokasi | Pencatatan dan alokasi aktif; posting menunggu kebijakan |
| Posting hutang/piutang, jurnal, COA | Kerangka ada, belum disahkan akuntan |
| Laporan (Laba Rugi, Neraca, Arus Kas, aging, PPN) | Belum |
| Dashboard keuangan | Belum (hanya hitungan dokumen) |
| Tutup buku, audit log, backup/restore teruji | Sebagian / belum |

## 5. Urutan pengerjaan (backlog)
1. Fondasi UI: komponen bersama dan token (lihat UI guidelines).
2. Hapus modul pengiriman dan ubah dasar invoice ke pesanan (D-09, D-10). Menunggu keputusan D-10. Dikerjakan sebagai satu migrasi dan satu PR terpisah.
3. Faktur suplier: hitung usulan, selisih langsung, modal efektif per item (D-01, D-02).
4. Invoice cetak bersih (D-06) dan tautan PDF untuk WhatsApp.
5. Form pesanan: total langsung, penanda harga khusus/override, peringatan margin di bawah modal.
6. Hubungkan aksi antar layar (pesanan → buat PO; pesanan → buat invoice sesuai D-10).
7. Pengesahan COA dan kebijakan oleh pemilik/akuntan, lalu posting dan jurnal.
8. Laporan dari jurnal, lalu Dashboard keuangan (D-04).
9. Tutup buku, uji backup/restore, UAT oleh akuntan.

## 6. Pertanyaan terbuka
1. Apakah Jena berstatus PKP? Apakah penjualan ke pelanggan dikenai PPN keluaran?
2. Penanganan selisih pembulatan pada faktur suplier (D-01): bagaimana akuntan ingin menanganinya?
3. Cara pembulatan dan alokasi diskon faktur dan ongkir ke modal per item.
4. Siapa penyetuju COA dan kebijakan (pemilik, akuntan)? Kapan target cutover?
5. Kapan jadwal cutover dan pembersihan data uji (D-05)? Apakah migration akuntansi `20261017140000` sudah diterapkan di Supabase?

## 6a. Pembersihan data uji sebelum dipakai sungguhan (D-05)
Dilakukan setelah UAT akuntan selesai dan sebelum cutover.
1. Catat daftar data uji yang ada (per dokumen kesiapan: satu pelanggan, satu suplier, satu barang, harga, SO dan PO).
2. Buat backup dan pastikan bisa dipulihkan.
3. Bersihkan lewat skrip SQL/migrasi yang direview, bukan klik manual. Jangan menghapus akun Owner/Admin/Viewer, role, konfigurasi, atau skema.
4. Putuskan nomor dokumen otomatis (SO/PO/invoice) mulai dari mana setelah pembersihan.
5. Verifikasi: tabel transaksi kosong, RLS tetap aktif, login dan role berfungsi.
6. Catat tanggal dan pelaksana pembersihan di dokumen ini dan di audit log.

## 7. Definisi selesai untuk setiap PR
- Perilaku sesuai bagian 3 dan 4 dokumen ini; jika berubah, dokumen ini ikut diperbarui.
- Lulus `npm run lint` dan `npm run build`.
- Mengikuti `docs/UI_UX_GUIDELINES.md` (komponen bersama, token warna, aksesibilitas).
- Tidak ada rahasia di Git; hanya publishable key di browser.
- Perubahan yang menyentuh akuntansi atau pajak tidak diaktifkan sebelum ada persetujuan tertulis di bagian 3.
