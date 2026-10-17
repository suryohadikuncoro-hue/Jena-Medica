# Kebijakan Akuntansi dan Cutover — Jena Medical Center Business Suite

**Status:** disahkan pemilik (Suryo), 17 Oktober 2026. Tidak ada butir terbuka. Dokumen ini menjawab seluruh pertanyaan di `PRODUCT_SPEC.md` bagian 6 dan menjadi dasar D-01, D-02, D-03, D-10.
**Peran:** sumber kebenaran untuk akuntansi dan pajak. Jika kode atau dokumen lain bertentangan, dokumen ini menang (urutan kedua setelah keputusan pemilik di PRODUCT_SPEC).
**Perubahan kebijakan:** hanya lewat revisi dokumen ini yang disetujui pemilik, dengan tanggal dan alasan di bagian 13.

## 1. Prinsip umum

- Mata uang IDR, tanpa desimal. Semua nilai dibulatkan ke rupiah terdekat (0,5 ke atas naik).
- Dasar akrual. Jena bertindak sebagai **principal** pada penjualan drop-ship: Jena menetapkan harga jual per pelanggan, memilih supplier, dan menanggung risiko tagihan ke pelanggan. Pendapatan dicatat **bruto** (nilai jual), HPP dicatat terpisah.
- Tidak ada persediaan. Barang yang sudah difaktur supplier tetapi belum ditagihkan ke pelanggan ditampung di akun clearing, bukan persediaan.
- Angka tercetak di dokumen asli (faktur supplier, faktur pajak) adalah sumber kebenaran. Hitungan sistem hanya usulan (D-01).
- Tidak ada hapus permanen. Koreksi lewat batalkan, nota kredit, atau jurnal balik (D-07).

## 2. Profil pajak perusahaan

Status pajak adalah **pengaturan perusahaan**, diisi satu kali oleh Owner sesuai surat pengukuhan, bukan keputusan yang menunggu. Sistem mendukung dua keadaan dan perilakunya sudah ditetapkan di bawah.

| Pengaturan | Nilai yang didukung |
|---|---|
| Status PKP | `PKP` atau `Non-PKP` |
| Tanggal mulai status | tanggal pengukuhan (untuk PKP) |

Aturan dasar (diverifikasi dari sumber DJP dan media perpajakan pada 17 Oktober 2026):

- Pengusaha dengan peredaran bruto lebih dari Rp4,8 miliar dalam satu tahun buku wajib dikukuhkan sebagai PKP. Di bawah itu boleh memilih PKP secara sukarela.
- **Jika Non-PKP:** invoice pelanggan tanpa PPN; PPN pada faktur supplier menjadi bagian modal (bagian 4).
- **Jika PKP:** berlaku bagian 3 dan 4.
- Bila omzet kumulatif tahun berjalan mencapai Rp4,0 miliar, Dashboard menampilkan peringatan agar Owner menyiapkan pengukuhan PKP. Pengajuan paling lambat akhir tahun buku saat omzet melewati Rp4,8 miliar.

## 3. PPN keluaran (penjualan)

**Tax code berversi** (tidak ditulis permanen di kode), disimpan di tabel kode pajak dengan tanggal efektif:

| Kode | Perhitungan | Efektif mulai | Keterangan |
|---|---|---|---|
| `PPN_UMUM` | PPN = 12% × (11/12 × DPP) = 11% × DPP | 2025-01-01 | Barang kena pajak non-mewah. Alat kesehatan Jena termasuk non-mewah. |
| `PPN_BEBAS` | PPN = 0 | selalu | Barang yang ditandai Owner sebagai tidak kena PPN, wajib mengisi alasan tertulis di master barang. |

- Default setiap barang adalah `PPN_UMUM`. Perubahan tarif di masa depan dilakukan dengan menambah baris kode pajak baru bertanggal efektif, bukan mengubah kode program.
- PPN dihitung **per dokumen** dari total DPP dokumen, bukan per baris, lalu dibulatkan ke rupiah terdekat.
- Harga jual per pelanggan **belum termasuk PPN** (pra-pajak). Invoice menampilkan DPP, PPN, dan total.
- Saat terutang: pada saat penyerahan barang, atau saat pembayaran diterima jika lebih dulu. Karena itu berlaku aturan bagian 7 (invoice terbit saat penyerahan, dan pembayaran tidak boleh mendahului invoice tanpa faktur pajak).
- **Faktur Pajak/e-Faktur dibuat di Coretax secara manual oleh Owner.** Sistem tidak membuat e-Faktur. Tanggal faktur pajak sama dengan tanggal invoice. Unggah dan memperoleh persetujuan DJP paling lambat tanggal 20 bulan berikutnya setelah tanggal pembuatan e-Faktur, sesuai PER-11/PJ/2025 Pasal 44 ([sumber resmi DJP](https://pajak.go.id/index.php/id/peraturan/ketentuan-pelaporan-pajak-penghasilan-pajak-pertambahan-nilai-pajak-penjualan-atas-barang)). Periksa kembali ketentuan yang berlaku sebelum menyusun SOP pajak perusahaan. Nomor faktur pajak dicatat di kolom catatan invoice.
- Dokumen untuk pelanggan tidak boleh memuat istilah internal (D-06).

## 4. PPN masukan (pembelian)

- PPN pada faktur supplier **ditranskripsi dari faktur sumber**, tidak ditebak dari status PKP supplier (aturan yang sudah berlaku di sistem).
- **Dapat dikreditkan** hanya jika semuanya benar: (1) Jena berstatus PKP; (2) ada faktur pajak masukan yang sah dan sudah dicatat nomornya; (3) barang dipakai untuk penyerahan kena pajak. Maka dicatat ke akun **PPN Masukan**.
- Selain itu (Jena Non-PKP, tidak ada faktur pajak, atau barang `PPN_BEBAS`): PPN **tidak dikreditkan** dan **menjadi bagian modal** barang (masuk ke clearing bersama harga barang).
- Flag `recoverable` per faktur supplier ditetapkan Owner/Admin saat mencatat, dengan default mengikuti aturan di atas. Perubahan setelah posting hanya lewat jurnal koreksi.

## 5. Faktur supplier: hitung usulan dan rekonsiliasi (D-01)

Sistem menampilkan **hitungan usulan** di samping **angka tercetak**, beserta selisih.

**Mode eksklusif** (harga belum termasuk PPN):
- Subtotal neto = Σ (harga × qty − diskon baris) − diskon faktur
- Total usulan = subtotal neto + PPN + biaya lain (ongkir dan sejenisnya)

**Mode inklusif** (harga sudah termasuk PPN):
- PPN = total × 11/111, dibulatkan; DPP = total − PPN
- Total usulan = subtotal neto + biaya lain (PPN sudah tercakup di subtotal)

**Aturan selisih:**
1. Draft boleh disimpan dengan selisih. **Posting ke pembukuan hanya jika selisih nol.**
2. Selisih kecil karena pembulatan supplier diselesaikan dengan satu baris **Penyesuaian pembulatan** bernilai paling besar Rp10 per faktur, dicatat ke akun *Selisih Pembulatan*. Dengan baris ini selisih akhir menjadi nol, jadi tidak ada toleransi diam-diam.
3. Selisih lebih dari Rp10 tidak boleh diposting. Faktur diperbaiki dulu (salah ketik, diskon lupa, ongkir lupa).
4. Kuantitas faktur tidak boleh melebihi kuantitas PO-line tertaut kecuali Owner menandai alasan tertulis (barang tambahan dari supplier). Alasan disimpan.

## 6. Modal efektif dan HPP (D-02)

**Alokasi (satu aturan untuk semua faktur):**
- Diskon faktur dibagi ke baris **proporsional** terhadap nilai baris setelah diskon baris.
- Ongkir/biaya angkut pembelian dan biaya lain dibagi proporsional dengan cara yang sama.
- Sisa pembulatan masuk ke baris bernilai terbesar.
- PPN yang tidak dapat dikreditkan (bagian 4) ikut dialokasikan ke baris dengan aturan yang sama.

**Modal efektif per item** = (harga × qty − diskon baris − bagian diskon faktur + bagian ongkir/biaya lain + bagian PPN tidak dikreditkan) ÷ qty. Ditampilkan sebagai dua angka: modal sebelum PPN dan PPN tercetak (D-02).

**HPP:**
- HPP diakui **saat invoice pelanggan diterbitkan**, sebesar modal efektif × kuantitas yang ditagihkan, sehingga pendapatan dan HPP jatuh di periode yang sama.
- Biaya yang dipakai adalah biaya aktual dari faktur supplier yang sudah diposting dan tertaut ke PO-line dari baris SO tersebut.
- Jika faktur supplier belum diposting saat invoice terbit, HPP memakai **estimasi dari harga PO** dan selisihnya (estimasi vs aktual) ditutup ke HPP saat faktur supplier diposting. Estimasi ini dicatat ke akun *Hutang Akrual Pembelian*.
- Margin negatif diperingatkan di layar Pesanan dan saat menerbitkan invoice, tetapi tidak diblokir.

## 7. Pengakuan pendapatan dan invoice (D-10)

- Invoice dibuat manual oleh Owner/Admin dari SO yang dikonfirmasi; boleh beberapa kali; total kumulatif dibatasi SO.
- **Draft tidak mengakui pendapatan.** Pendapatan diakui saat invoice **diterbitkan** (status issued). Piutang usaha timbul saat itu.
- **Prosedur wajib sebelum menerbitkan (SOP, bukan fitur sistem):** Owner/Admin memastikan barang sudah diserahkan supplier ke pelanggan (konfirmasi supplier atau pelanggan). Tanggal invoice dianggap tanggal penyerahan. Sistem tidak mencatat pengiriman (D-09).
- Pembayaran mengurangi piutang dan **tidak mengakui pendapatan lagi**.
- Pembayaran yang masuk **sebelum** invoice diterbitkan dicatat sebagai **Uang Muka Pelanggan** (liabilitas). Bila Jena PKP, PPN terutang saat pembayaran diterima, jadi Owner membuat faktur pajak atas uang muka di Coretax saat itu. Uang muka dialokasikan ke invoice saat diterbitkan. Praktik yang dianjurkan: terbitkan invoice sebelum atau segera setelah pembayaran diterima.
- Invoice yang salah: sebelum terbit, batalkan dengan alasan; setelah terbit, buat **nota kredit** penuh atau sebagian, terhubung ke invoice asal, lalu terbitkan invoice baru.

## 8. Jurnal (ringkas, dengan contoh)

Contoh PKP: beli Rp10.000.000 (neto), jual Rp12.000.000 (pra-pajak).

| Peristiwa | Debit | Kredit |
|---|---|---|
| Faktur supplier diposting (PPN 11% = 1.100.000, dapat dikreditkan) | Clearing Pembelian 10.000.000; PPN Masukan 1.100.000 | Hutang Usaha 11.100.000 |
| Invoice pelanggan diterbitkan (PPN 11% = 1.320.000) | Piutang Usaha 13.320.000 | Penjualan 12.000.000; PPN Keluaran 1.320.000 |
| HPP saat invoice diterbitkan | HPP 10.000.000 | Clearing Pembelian 10.000.000 |
| Pelanggan membayar | Kas/Bank 13.320.000 | Piutang Usaha 13.320.000 |
| Bayar supplier | Hutang Usaha 11.100.000 | Kas/Bank 11.100.000 |
| Pembayaran masuk sebelum invoice | Kas/Bank | Uang Muka Pelanggan |

Contoh **Non-PKP**: faktur supplier: Debit Clearing 11.100.000 (PPN ikut modal), Kredit Hutang 11.100.000. Invoice pelanggan tanpa PPN. HPP = 11.100.000.

Akun minimal COA: Kas/Bank, Piutang Usaha, Uang Muka Pelanggan, PPN Masukan, Clearing Pembelian, Hutang Usaha, Hutang Akrual Pembelian, PPN Keluaran, Penjualan, HPP, Selisih Pembulatan, Modal Pemilik, Laba Ditahan. Nomor dan pemetaan akun diisi di pengaturan COA oleh Owner sebelum approval gate dibuka.

## 9. Pembayaran dan alokasi

- Pembayaran parsial dan ke banyak invoice didukung. Total alokasi ≤ dana tersedia dan ≤ sisa invoice.
- Dana yang belum dialokasikan = uang muka (pelanggan) atau uang muka ke supplier.
- Kelebihan bayar tidak dikembalikan otomatis. Dicatat sebagai uang muka sampai dialokasikan atau dikembalikan lewat pencatatan pembayaran keluar.
- Idempotency key wajib pada setiap pembayaran (sudah ada).

## 10. Retur, koreksi, dan selisih kuantitas

- **Retur pelanggan / koreksi invoice terbit:** nota kredit terhubung ke invoice (bagian 7). Mengurangi pendapatan, PPN keluaran (bila PKP), dan HPP proporsional.
- **Retur ke supplier / kredit supplier:** nota kredit supplier terhubung ke faktur asal, mengurangi hutang, clearing/HPP, dan PPN masukan proporsional.
- **Selisih kuantitas** (barang diterima kurang dari pesanan): invoice pelanggan hanya untuk kuantitas yang benar-benar diserahkan; kuantitas SO yang tidak terpenuhi dibatalkan lewat perubahan SO (dengan alasan) sebelum invoice dibuat.
- Tidak ada hapus; semua lewat dokumen lawan atau jurnal balik yang tertaut ke sumbernya.

## 11. Periode dan tutup buku

- Periode bulanan. Owner menutup periode setelah rekonsiliasi dan mengunci posting.
- **Tidak ada buka kembali periode.** Koreksi untuk periode tertutup dibuat sebagai jurnal koreksi pada periode berjalan, dengan alasan dan referensi dokumen sumber.
- Audit log wajib untuk: issue/void, posting, pembatalan, nota kredit, perubahan pengaturan pajak/COA, tutup periode. Rahasia tidak disimpan di log.
- Laporan wajib (dari jurnal diposting): Laba Rugi, Neraca, Arus Kas sederhana, Umur Piutang dan Hutang, Rekap PPN Keluaran/Masukan.

## 12. Cutover dan pembersihan data uji

- **Tanggal cutover: 1 Januari 2027** (awal tahun buku). Posting jurnal baru dinyalakan setelah UAT lulus dan pembersihan selesai; paling lambat sehari sebelum tanggal itu.
- **Penyetuju COA dan kebijakan: Owner.** Persetujuan dicatat dengan tanggal di bagian 13.
- Langkah wajib berurutan: (1) UAT role Owner/Admin/Viewer lulus pada skenario: split supplier, invoice berulang per SO, pembayaran parsial, uang muka, nota kredit, margin negatif, PKP dan Non-PKP; (2) backup penuh dan uji pemulihan; (3) pembersihan data uji dengan skrip SQL yang direview (bagian 6a PRODUCT_SPEC); (4) isi pengaturan pajak dan COA; (5) buka periode Januari 2027.
- **Penomoran dokumen setelah pembersihan:** format `PREFIX-TAHUN-NNNN` (mis. `SO-2027-0001`), urut per tahun. Draft memakai prefix `DRAFT-`.
- **Saldo awal:** bila ada piutang atau hutang berjalan pada 31 Desember 2026, dimasukkan sebagai dokumen saldo awal berdokumen asli dan tanggal asli, bukan sebagai angka total.

## 13. Pengesahan dan riwayat perubahan

| Tanggal | Perubahan | Disetujui |
|---|---|---|
| 17 Oktober 2026 | Kebijakan awal: PPN, modal/HPP, pengakuan pendapatan, rekonsiliasi, retur, tutup buku, cutover | Suryo (pemilik) |
