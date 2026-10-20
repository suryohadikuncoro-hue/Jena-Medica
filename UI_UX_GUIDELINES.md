# UI/UX Guidelines — Jena Business Suite

> **Peran:** satu-satunya rujukan tampilan dan interaksi. Keputusan bisnis ada di `PRODUCT_SPEC.md` (prioritasnya lebih tinggi, lihat `AGENTS.md` bagian 2).
> **Sumber kebenaran tampilan:** `Mockup_Jena_Business_Suite` (disimpan di `design/Mockup_Jena_Business_Suite.pdf` dan `.html`). Dokumen ini diturunkan dari mockup. Kalau berbeda, **mockup menang**, kecuali butir di bagian 9 (teknis) dan bagian 10 (konflik dengan keputusan produk).
> Aturan lama "menu tetap di atas / navbar atas / hamburger" **dicabut**. Menu ada di rail kiri (desktop) dan bottom bar (mobile).
> Pengguna utama adalah pemilik bisnis yang sering membuka dari HP, bukan akuntan.
> **Mockup HP (390 px):** `design/mockup-hp/index.html`, 15 layar. Layar 1–13 disetujui; **layar 14–15 (Keuangan) masih draf dan perlu diskusi**.

**Cara membaca ukuran.** Layar Dashboard diambil dari kode sumber mockup, jadi angka pikselnya pasti. Layar Pesanan, Faktur Supplier, dan Invoice diambil dari PDF (tanpa kode), jadi struktur, warna, dan teksnya pasti, tetapi ukuran pikselnya **perkiraan** dan mengikuti token/komponen Dashboard. Jangan menebak angka baru; pakai komponen di bagian 5.

---

## 1. Prinsip

1. Mockup yang disetujui adalah acuan. Agent tidak boleh "memperbaiki" tampilan di luar bagian 9.
2. Satu pola per kebutuhan: pakai komponen di bagian 5, jangan membuat varian baru.
3. Semua warna lewat token (bagian 3). Dilarang hex langsung di komponen.
4. Terang dan gelap wajib jalan.
5. Target sentuh minimal 44×44 px.
6. Pengiriman tidak dicatat di sistem (urusan supplier dan pelanggan). Jangan membuat UI pengiriman.
7. Angka di faktur kertas supplier selalu menang atas hitungan sistem (D-01).
8. **Jujur.** Jangan menampilkan kontrol yang belum berfungsi (notifikasi palsu, avatar tetap, form yang tidak menyimpan). Fitur belum jadi: sembunyikan atau tandai jelas "Segera".
9. **Mobile-first.** Semua alur utama harus nyaman di HP, tanpa scroll horizontal pada halaman.

## 2. Tipografi

Font **Plus Jakarta Sans**, fallback `system-ui, sans-serif` (lisensi SIL OFL 1.1). Ukuran dasar 14 px.

| Peran | Ukuran | Bobot |
|---|---|---|
| Judul halaman (h1) | 28 px, letter-spacing −0.03em | 800 |
| Judul kartu (h2) | 20 px, −0.02em | 700 |
| Angka besar ringkasan | 22 px | 800 |
| Total besar (detail pesanan, total tagihan) | besar, jelas di atas h1 | 800 |
| Teks isi | 14 px | 400–600 |
| Subjudul / keterangan | 12 px (13 px di bawah h1) | 400, `--muted` |
| Label kecil / satuan / pil status | 11–12 px | 600–700 |
| Tombol | 13 px | 600 |

## 3. Token warna

Dua tema: kelas `t-light` dan `t-dark`.

| Token | Terang | Gelap | Fungsi |
|---|---|---|---|
| `--page` | `#eceeed` | `#0d0e10` | latar halaman |
| `--shell` | `#ffffff` | `#16171a` | cangkang, panel |
| `--card` | `#f5f5f3` | `#1f2024` | kartu |
| `--ink` | `#17181c` | `#f1f2f3` | teks utama, tombol solid |
| `--on-ink` | `#ffffff` | `#121316` | teks di atas `--ink` |
| `--muted` | `#6b6e75` | `#a3a6ad` | teks sekunder |
| `--line` | `#e4e5e2` | `#2c2d33` | garis, border |
| `--pink` | `#f8c9d3` | `#4d2c36` | pastel: selisih, peringatan keras, margin minus |
| `--pink-ink` | `#d9677f` | `#f08aa2` | seri grafik "Ditagih", penanda draf |
| `--yellow` | `#fcebc3` | `#4a3f22` | pastel: sedang berjalan / perlu dicek |
| `--mint` | `#c2ecdd` | `#21443a` | pastel: selesai / aman |
| `--teal` | `#1e8c86` | `#4cc9c0` | aksen utama, fokus, progres |
| `--good` | `#17795a` | `#6fd9b0` | baik / lunas |
| `--warn` | `#9a6a05` | `#f3c15a` | peringatan |
| `--bad` | `#c2415d` | `#f08aa2` | buruk, aksi destruktif |

Tetap di kedua tema: rail dan bottom bar `#1b1c21`, ikon rail diam `#a9acb4`, ikon aktif `#17181c` di atas `#f8c9d3`, avatar `#f4c9a8`.
Fokus keyboard: `outline: 3px solid var(--teal); outline-offset: 2px`.

**Arti warna pastel (konsisten di semua layar):** mint = selesai/benar/lunas, kuning = berjalan atau menunggu, pink = ada masalah/selisih/margin minus.

## 4. Layout dan navigasi

### Kerangka
Halaman (`--page`) berisi satu shell putih: maks 1480 px, rata tengah, padding 22, sudut 34, bayangan `0 24px 70px rgba(20,24,28,.07)`. Isi: kolom rail kiri 72 px + area utama, jarak 22. Padding halaman 24.

### Desktop: rail kiri
- Logo bulat 56 px ("J", latar `#1b1c21`, huruf `#f8c9d3`) di atas rail, tautan ke Dashboard.
- Rail 72 px, latar `#1b1c21`, sudut 36, ikon vertikal jarak 8. Tombol ikon 44×44 bulat. Aktif: latar `#f8c9d3`, ikon `#17181c`, `aria-current="page"`.
- **Hanya ikon**, tanpa teks. Nama lewat `title` dan `aria-label`.
- Urutan: Dashboard, Pesanan, Order supplier / Faktur supplier, Master data, Invoice, Pembayaran, Keuangan; spasi fleksibel; Pemberitahuan; avatar pengguna 44 px.
- Ikon: SVG garis 24×24, stroke 1.8, ujung bulat, `currentColor`.

### Mobile (≤ 820 px)
- Rail hilang; muncul **bottom bar** menempel di bawah layar (referensi pola: aplikasi perbankan; warna: mockup Jena). Latar `#1b1c21`, sudut atas 24, padding 10/8/18 (bawah menyertakan jarak aman gestur HP), 5 slot sama lebar.
- Slot (tiap ikon **berlabel teks** 11 px/600): **Dashboard, Pesanan, Order, Invoice, Lainnya**.
- Tidak aktif: ikon dan label `#a9acb4`. Aktif: ikon `#17181c` di dalam lingkaran/pil `#f8c9d3` (44×32), label `#f8c9d3`, `aria-current="page"`. Target sentuh minimal 44 px.
- **Order** adalah satu menu "Order supplier" berisi dua tab, **Order** dan **Faktur** (tab memperbarui URL; lencana pink pada Faktur = jumlah faktur perlu dicek).
- **Lainnya** membuka halaman sendiri (rute sungguhan, bukan lembar geser) berisi kartu profil, lalu menu **Pembayaran, Master Data, Keuangan, Pengaturan**, dan Keluar. Saat di halaman Pembayaran, Master Data, atau Keuangan, slot Lainnya yang tampil aktif. Tidak ada ikon pemberitahuan sampai fiturnya ada (prinsip 8).
- Shell mobile: lebar 390 px, padding halaman 20 px.

### Pola kepala halaman
- **Dashboard:** sapaan h1 + tanggal; kanan: tombol Cari dan "+ Pesanan baru".
- **Halaman detail:** tautan kembali kecil di atas judul (desktop: "‹ Semua pesanan"; mobile: tombol bulat 44 px bergaris dengan panah) lalu h1 + pil status + keterangan satu baris. Aksi destruktif (mis. "Batalkan pesanan") di kanan atas sebagai tombol garis merah.
- **Halaman daftar (HP):** h1 28 px + keterangan 13 px; kanan: tombol cari (44 px, bergaris) dan tombol bulat "+" 48 px (aksi utama membuat dokumen baru). Di bawahnya: tab segmen bila ada dua bagian (Order|Faktur, Piutang|Hutang, Pelanggan|Supplier|Barang), banner aksi, kartu ringkas, filter, lalu daftar.
- **Halaman faktur supplier:** jejak kecil "Order supplier · Faktur supplier" di atas h1.
- **Daftar + editor (Invoice):** h1 + satu kalimat penjelasan; di bawahnya dua kartu berdampingan (daftar kiri, editor kanan).

### Grid per layar (desktop)
- **Dashboard:** 3 kolom (300 / fleksibel / 270), jarak 18: Ringkasan + progres | Aktivitas Pesanan + Perlu Tindakan | Perlu Dipantau.
- **Detail pesanan:** 2 kolom: kiri lebar (Detail Pesanan, Barang yang Dipesan), kanan sempit (Langkah Berikutnya).
- **Faktur supplier:** 2 kolom: kiri lebar (Isi Faktur, Cocokkan dengan Hitungan Sistem, Modal per Barang), kanan sempit (Jika Dicatat, Periksa Dulu).
- **Invoice:** 2 kolom: kiri (Daftar Invoice), kanan lebih lebar (Buat Invoice Baru).
- Mobile: semua kolom menjadi satu, urut dari atas ke bawah.

## 5. Komponen

| Komponen | Spesifikasi |
|---|---|
| Kartu | padding 20, sudut 24, latar `--card` |
| Panel | padding 16, sudut 20, latar `--shell`, di dalam kartu |
| Tombol solid | tinggi min 44, padding 0 20, pil, `--ink`/`--on-ink`, 13/600. Hanya untuk aksi utama |
| Tombol garis | sama, border 1.5 `--ink`, transparan; hover terisi `--ink` |
| Tombol garis merah | border dan teks `--bad`; untuk aksi destruktif (Batalkan pesanan, Batalkan faktur) |
| Tombol nonaktif | latar abu (`--line`), teks `--muted`; mis. "Catat ke pembukuan" saat masih ada selisih |
| Tombol ikon | 44×44 bulat, border 1.5 `--line` |
| Segmen / tab | pil tinggi min 44; aktif `--ink`+`--on-ink`; lain transparan `--muted`; `aria-pressed`. Dipakai di rentang waktu, filter Invoice (Semua/Draf/Terbit/Lunas), dan pilihan "Harga di faktur" |
| Filter pelanggan | tombol bulat 44; aktif border `--pink-ink` + latar `--pink` |
| Pil status | pil kecil 11–12 px/700. Pemetaan: lihat tabel di bawah |
| Pil atribut | pil kecil: "Harga khusus" mint, "Diubah manual" kuning, "Margin +x%" mint, "Margin −x%" pink |
| Kartu pastel (langkah, pantau, dampak) | padding 16, sudut 22, latar `--mint` / `--yellow` / `--pink`, teks `--ink` |
| Spanduk peringatan | blok lebar penuh sudut ±20, latar `--pink` (masalah) atau `--yellow` (perhatian), teks `--ink`, kalimat pertama tebal |
| Baris barang | panel putih: kiri nama (tebal) + "jumlah × harga" (`--muted`); kanan pil atribut + subtotal tebal |
| Tabel | di dalam panel putih; kepala kolom 12 px `--muted`; angka rata kanan; baris total tebal dengan garis atas |
| Baris selisih | baris tabel yang selisihnya bukan nol diberi latar `--pink`; selisih nol ditampilkan "0" `--muted` |
| Input | latar `--shell`, border `--line`, sudut ±14, tinggi min 44; angka di dalam tabel rata kanan |
| Progres batang | tinggi 4 (kecil) atau ±8 (langkah), sudut penuh; latar trek `--line` atau kuning lebih gelap; isi `--ink` / `--teal` |
| Donat progres | 130×130, ring tebal 12, latar ring `--pink`, progres `--teal`, mulai jam 12; `role="img"` + `aria-label` |
| Grafik garis | SVG `role="img"` + `aria-label`; kisi `--line`; seri Pesanan `--ink`, Ditagih `--pink-ink`; titik data terpilih diberi pil label |
| Kartu "Perlu Dipantau" | tautan blok pastel: kiri atas jenis dokumen (12 px, opacity .75), kanan atas nomor (15/800), bawah grid label–nilai |

**Pemetaan pil status**

| Status | Warna |
|---|---|
| Terkonfirmasi (pesanan) | mint |
| Selesai (langkah) | putih di atas kartu mint |
| Draf (invoice) | abu |
| Draf · ada selisih (faktur) | pink |
| Terbit | kuning |
| Dibayar sebagian | pink |
| Lunas | mint |

**Tambahan dari mockup HP**

| Komponen | Spesifikasi |
|---|---|
| Pil status tambahan | Menunggu balasan = kuning; Dibalas = mint; Dicatat = mint; Draf (order/faktur) = abu; Draf · ada selisih = pink |
| Banner aksi | blok pastel (kuning = perlu tinjauan; pink = ada masalah), kalimat pertama tebal, tombol solid kecil di kanan ("Tinjau", "Periksa", "Buat order") |
| Kartu ringkas | dua kartu sebaris di atas daftar: label 12 px `--muted`, angka 20–22 px/800, satuan 12 px `--teal-text` |
| Kartu total gelap | latar `#17181c`, teks putih, label 12 px opacity .75, angka 26–34 px/800; dipakai untuk total pesanan, total tagihan, saldo ringkasan |
| Baris daftar | kartu `--card`, ikon bulat 44 (warna pastel sesuai status), kiri "nomor · nama" 14/700 dan keterangan langkah berikutnya 12 px `--muted`, kanan nilai 14/800 dan pil status |
| Baris riwayat transaksi | ikon bulat panah turun hijau (masuk, nominal `+`, `--good`) atau panah naik pink (keluar, nominal `−`, `--bad`), nama, keterangan "dokumen · cara bayar · tanggal" |
| Chip filter | pil 44 px dapat digeser horizontal; aktif `--ink` |
| Tombol nonaktif | `--line` + `--muted`, `aria-disabled="true"`; dipakai untuk "Catat ke pembukuan" selama selisih belum nol |

Aturan komponen:
- Satu aksi utama per kartu. Tombol solid hanya untuk aksi utama halaman/kartu langkah ("Buat invoice dari pesanan ini", "Terbitkan invoice", "+ Pesanan baru"). Aksi sekunder: tombol garis.
- Angka yang belum berasal dari pembukuan diberi keterangan (mockup: "angka dari dokumen, belum dari pembukuan").
- Teks wajib dipertahankan: "Pengiriman diurus supplier dan pelanggan, tidak dicatat di sini."
- Draf tidak dihapus, hanya dibatalkan dengan alasan. Draf tidak masuk pembukuan sampai diterbitkan/dicatat.

## 6. Bahasa dan istilah

Ejaan **supplier** (bukan "suplier"). Uang: `Rp 1.887.000`, ringkas `Rp 8,4 jt`. Tanggal: `16 Nov 2026` atau `17 Oktober 2026`.

Istilah di mockup (sudah sejalan dengan `AGENTS.md`): **Hutang usaha**, **Batalkan** (pesanan/faktur), **Catat ke pembukuan**, Pesanan, Order supplier, Faktur supplier, Draf, Terbit, Lunas, Dibayar sebagian, Jatuh tempo, Selisih, Penyesuaian pembulatan, Modal per barang, HPP, Pembayaran, Keuangan, Master data.

Kamus ini hanya berlaku untuk **teks yang dibaca pengguna di layar**. Kode, nama tabel/fungsi, migrasi, dan dokumen teknis tetap memakai istilah teknis.

| Hindari | Gunakan |
|---|---|
| PO-line | Baris order |
| AP / Utang usaha | Hutang usaha |
| AR | Piutang usaha |
| Posting / diposting | Catat ke pembukuan / sudah dibukukan |
| Clearing | Akun penampung |
| Snapshot | Salinan data saat transaksi |
| Capture | Pencatatan dokumen |
| Void | Batalkan |
| Reported | Tercetak di faktur |
| Suplier | Supplier |

## 7. Aksesibilitas

- Rail `<nav aria-label="Menu utama">`; bottom bar `<nav aria-label="Menu bawah">`; halaman aktif `aria-current="page"`.
- Tombol ikon wajib `aria-label`; SVG dekoratif `aria-hidden="true"`.
- Toggle/tab wajib `aria-pressed`.
- Status tidak hanya dibedakan lewat warna; selalu ada teks.
- Kontras teks minimum 4,5 : 1 (lihat bagian 9, P1–P2).

## 8. Status verifikasi layar

Acuan: `design/` (PDF dan HTML Dashboard desktop) dan `design/mockup-hp/` (15 layar HP).

| # | Layar | Berkas | Status |
|---|---|---|---|
| — | Dashboard desktop | `design/Mockup_Jena_Business_Suite.html` | Disetujui, ukuran pasti |
| — | Detail pesanan (desktop dan HP), faktur supplier desktop, invoice desktop | `design/Mockup_Jena_Business_Suite.pdf` | Disetujui, ukuran perkiraan |
| 1 | Pesanan Baru | `mockup-hp/01-pesanan-baru.html` | Disetujui |
| 2 | Daftar Pesanan | `02-daftar-pesanan.html` | Disetujui |
| 3 | Order Supplier, tab Order | `03-order-supplier.html` | Disetujui |
| 4 | Order Supplier, tab Faktur | `04-order-supplier-faktur.html` | Disetujui (tunduk K2, K3) |
| 5 | Detail / Catat Faktur Supplier | `05-detail-faktur-supplier.html` | Disetujui (tunduk K2, K3) |
| 6 | Daftar Invoice | `06-daftar-invoice.html` | Disetujui (tunduk K1, K5) |
| 7 | Tinjau dan Edit Draf Invoice | `07-tinjau-draf-invoice.html` | Disetujui (tunduk K1, K4, K5) |
| 8 | Invoice Terbit + Kirim WhatsApp | `08-invoice-terbit.html` | Disetujui (tunduk K4, K6) |
| 9 | Pembayaran (tab Piutang) | `09-pembayaran.html` | Disetujui |
| 10 | Catat Pembayaran | `10-catat-pembayaran.html` | Disetujui (lihat pertanyaan 5, bagian 13) |
| 11 | Lainnya (menu) | `11-lainnya.html` | Disetujui |
| 12 | Master Data (tab Pelanggan) | `12-master-data.html` | Disetujui |
| 13 | Detail Pelanggan + Harga Khusus | `13-detail-pelanggan.html` | Disetujui |
| 14 | Keuangan: Ikhtisar | `14-keuangan-ikhtisar.html` | **Draf, perlu diskusi** |
| 15 | Keuangan: Laba Rugi | `15-keuangan-laba-rugi.html` | **Draf, perlu diskusi** |

**Belum ada acuan** (pakai token dan komponen bagian 3 dan 5, jangan menebak, tandai di PR): Dashboard versi HP; versi desktop layar 1–15 selain yang ada di PDF; Login dan atur kata sandi; Pengaturan; tab Supplier dan Barang di Master Data; tab Hutang di Pembayaran; form tambah/ubah data master dan harga khusus; Keuangan selain Ikhtisar dan Laba Rugi (Neraca, Jurnal umum, Buku Besar, Tutup Buku, PPN, Hutang & piutang); form biaya operasional; keadaan kosong, memuat, error, dan tanpa izin; tampilan Viewer; mode gelap per layar; tablet (820–1100 px).

Angka, nama pelanggan/supplier, dan nomor dokumen di mockup adalah data contoh (P3).

## 9. Penyimpangan teknis dari mockup

Perbaikan yang tidak mengubah desain. Hanya butir ini yang boleh berbeda dari mockup (selain bagian 10).

| # | Mockup | Implementasi | Alasan |
|---|---|---|---|
| P1 | Teks aksen `--teal` `#1e8c86` (label 11–12 px) | token `--teal-text`: terang `#17766f`, gelap `#4cc9c0` | kontras `#1e8c86` hanya 3,73 : 1 di atas `--card` dan 4,08 : 1 di atas `--shell` (batas 4,5); `#17766f` memberi 4,99 dan 5,44. `--teal` asli tetap untuk elemen grafis |
| P2 | `--warn` `#9a6a05` sebagai teks | `--warn-text` terang `#865a03` | 4,33 : 1 menjadi 5,53 : 1 |
| P3 | Data contoh (Klinik Contoh A/B/C, Supplier 2, Faktur 8821, SO-0007, angka) | data nyata dari Supabase | data ilustrasi |
| P4 | Menu hanya `title` | tambah `aria-label` | `title` tidak tampil di layar sentuh |
| P5 | Flyout rail tidak ada | tidak dibuat | ikut mockup |

Kontras lain yang sudah lulus: `--ink` di atas `--pink`/`--yellow`/`--mint` 12,07 / 15,04 / 13,80 : 1 (gelap 9,25–10,84); ikon rail 7,49 : 1.

## 10. Mockup yang bertentangan dengan keputusan produk

Mockup menampilkan beberapa hal yang tidak sejalan dengan keputusan pemilik atau dokumen berprioritas lebih tinggi. Karena `PRODUCT_SPEC.md` dan `ACCOUNTING_POLICY_AND_CUTOVER.md` menang atas dokumen UI, **jangan membangun bagian ini dari mockup**. Ikuti kolom "Sikap sementara" dan tanyakan pemilik (`AGENTS.md` bagian 3). Setelah keputusan dicatat di `PRODUCT_SPEC.md`, baris ini dihapus atau dijadikan aturan.

| # | Yang tampil di mockup | Keputusan pemilik / dokumen lain | Sikap sementara |
|---|---|---|---|
| K1 | PPN 11% di pesanan dan invoice pelanggan: "Belum termasuk PPN", "(sebelum PPN)", baris PPN, total = jumlah + PPN, kolom "nomor faktur pajak" | Pemilik menyatakan Jena **bukan PKP**. Status PKP adalah konfigurasi perusahaan dan profil pajak masih `draft` (D-03) | Tampilkan unsur PPN keluaran **hanya bila profil pajak aktif berstatus PKP**. Selama belum, sembunyikan; total tagihan = jumlah barang yang ditagih |
| K2 | Faktur supplier: "PPN bisa dikreditkan: Ya", baris "PPN masukan (dikreditkan)", "Total modal sebelum PPN" | `ACCOUNTING_POLICY` bagian 4: bila bukan PKP, PPN tidak dikreditkan dan **menjadi bagian modal**; pemilik menegaskan hal yang sama | Field dan baris kredit PPN hanya tampil bila PKP. Selama belum, PPN faktur supplier ikut masuk modal per barang |
| K3 | Baris "Ongkos kirim dan biaya lain" di faktur supplier dan alokasinya ke modal | Pemilik menyatakan faktur supplier tidak mencatat ongkir atau biaya lain. D-02 dan `ACCOUNTING_POLICY` bagian 5 masih menyebut biaya angkut/biaya lain | **Konflik dokumen.** Jangan membangun baris ini sampai pemilik memutuskan dan `PRODUCT_SPEC.md` diperbarui |
| K4 | Teks invoice: "…kalau salah, buat nota kredit" | Pemilik menyatakan tidak ada nota kredit: invoice terbit yang salah dibatalkan lalu dibuat ulang. D-07 dan `ACCOUNTING_POLICY` bagian 7 masih menyebut nota kredit | **Konflik dokumen.** Jangan membangun nota kredit atau teks itu sampai diputuskan |
| K5 | Mockup desktop awal: invoice dibuat manual lewat tombol "Buat invoice dari pesanan ini". Mockup HP: draf dibuat otomatis, ditinjau dan diedit, lalu diterbitkan | D-10 di `PRODUCT_SPEC.md` kini menetapkan draf otomatis setelah SO terkonfirmasi, ditinjau/diedit sebelum diterbitkan | **Keputusan sudah dicatat.** Implementasi database wajib idempoten dan menjaga batas kuantitas/nilai kumulatif invoice; verifikasi migration dan alur penerbitan sebelum Production |
| K6 | Tombol "Kirim WhatsApp" | D-06: aplikasi tidak mengirim pesan; WhatsApp memakai tautan PDF | Tombol membuka WhatsApp dengan pesan dan tautan PDF; tidak ada pengiriman otomatis |

## 11. Aturan interaksi dan form

Bagian ini dipertahankan dari pedoman lama karena mockup tidak membahasnya dan tidak bertentangan dengannya.

### Navigasi
- Setiap item menu adalah **rute sungguhan** (mis. `/pesanan/SO-0007`), bukan hash. Tab di dalam halaman memperbarui URL. Halaman setelah login adalah Dashboard.
- Pencarian global diberi label sesuai isinya ("Cari menu" bila hanya menu; "Cari transaksi" bila sudah mencari transaksi). Mendukung panah, Enter, Escape, focus trap, dan mengembalikan fokus.

### Komponen bersama
Target lokasi `app/components/ui/` (belum ada; buat saat implementasi): `Field`, `MoneyInput`, `Select/Combobox` (dengan pencarian), `DataTable` (mode kartu di mobile, pagination dari server), `StatCard`, `StatusBadge`, `Stepper`, `Drawer`, `Dialog`, `ConfirmDialog`, `Toast`, `EmptyState`, `Skeleton`, `PageHeader`.
- Satu definisi kelas input; tidak ada kelas yang tidak terdefinisi. `StatCard` hanya satu definisi.
- `Dialog` dan `Drawer`: menutup dengan Escape, mengunci fokus, mengembalikan fokus ke pemicu.
- Tema diterapkan sebelum render (skrip inline atau cookie) agar tidak berkedip. Ikon dari satu set (mis. lucide-react), bukan karakter Unicode.

### Form transaksi
1. Kolom uang memakai `MoneyInput`: pemisah ribuan, `inputMode="decimal"`, tidak berubah saat scroll mouse.
2. Label kolom **selalu terlihat** (bukan hanya `aria-label`/placeholder), termasuk pada baris item.
3. Validasi per kolom: pesan di bawah kolom yang salah, semua kesalahan sekaligus, lalu scroll dan fokus ke kolom pertama yang bermasalah. Pesan sukses lewat Toast.
4. Ringkasan total (subtotal, diskon, total) menempel dan diperbarui langsung.
5. Faktur supplier (D-01, D-02): "Tercetak di faktur", "Hitungan sistem", dan "Selisih" berdampingan; selisih nol tampil `--muted`, selisih bukan nol tampil pink. Tampilkan **modal per barang**.
6. Form pesanan: penanda "Harga khusus" atau "Diubah manual", peringatan bila harga di bawah modal terakhir, peringatan bila pelanggan belum punya harga khusus.
7. Pilih barang/baris PO lewat combobox dengan pencarian; sediakan "tarik semua baris dari PO ini".
8. Aksi yang mengubah status (konfirmasi, batalkan, catat ke pembukuan) memakai `ConfirmDialog` dengan ringkasan dampak.
9. Setelah tombol "Buat/Catat" ditekan, scroll ke form dan fokuskan kolom pertama. Simpan draf otomatis pada form panjang.

### Alur lintas layar
- Alur: Pesanan → Order supplier → Faktur supplier → **Draf invoice otomatis** → tinjau dan edit → **Terbitkan** → **Kirim WhatsApp** → Pembayaran → Lunas. Tidak ada layar atau menu Pengiriman (D-09).
- Pesanan terkonfirmasi: tombol **Buat order supplier**. Draf invoice yang belum ditinjau ditandai dengan banner "menunggu tinjauan" di Daftar Pesanan, Daftar Invoice, dan Dashboard.
- Invoice terbit: tombol **Kirim WhatsApp**, **Unduh PDF**, **Catat pembayaran**, **Batalkan invoice**. Tombol Kirim WhatsApp **membuka WhatsApp** dengan pesan dan tautan PDF; aplikasi tidak mengirim pesan sendiri (D-06).
- Pembayaran mendukung alokasi ke satu atau banyak invoice; sisa dana dicatat sebagai uang muka (`ACCOUNTING_POLICY_AND_CUTOVER.md` bagian 9).
- Langkah di setiap pesanan ditampilkan sebagai kartu "Langkah Berikutnya".
- **Catatan:** D-10 menetapkan draf invoice otomatis setelah SO terkonfirmasi; keputusan ini tercatat di `PRODUCT_SPEC.md`. Pastikan implementasi idempoten, draf dapat ditinjau/diedit, dan hanya penerbitan yang mengakui pendapatan/piutang.

### Dokumen cetak untuk pelanggan
- Area cetak berisi hanya isi invoice: identitas Jena, nomor, tanggal, jatuh tempo, pelanggan, item, total, **rekening dan instruksi pembayaran**.
- Catatan internal (status draf, piutang, keputusan pajak, model drop-ship) tampil di layar saja dengan kelas `screen-only`.
- Pesan WhatsApp memuat tautan PDF (D-06).

### Data dan kinerja
- Daftar memakai pagination dan filter dari server; jangan menarik ribuan baris ke browser. Gunakan query count atau view.
- Keadaan memuat memakai Skeleton. Viewer melihat catatan "Akses hanya-baca" pada halaman yang aksinya disembunyikan.

## 12. Backlog implementasi UI

Centang bila selesai. Satu PR = satu tujuan jelas.

**Migrasi ke mockup**
- [x] M-01 Font Plus Jakarta Sans dan token bagian 3 (terang dan gelap), termasuk `--teal-text` dan `--warn-text`. Ganti token lama (`--accent`, `--success`, dan seterusnya) secara bertahap; jangan mencampur dua sistem token dalam satu komponen
- [x] M-02 Shell: rail kiri desktop dan bottom bar HP (5 slot berlabel, halaman Lainnya) menggantikan bar atas
- [x] M-03 Komponen bersama (`app/components/ui/`): kartu, panel, tombol, pil status, tab segmen, banner aksi, kartu ringkas, baris daftar, baris riwayat
- [x] M-04 Dashboard sesuai mockup (U-05 sudah menyiapkan data dari server)
- [ ] M-05 Pesanan: daftar, form pesanan baru, detail pesanan (layar 1, 2, dan detail) — daftar sedang dikerjakan; form mendapat subtotal/total langsung dan validasi diskon di PR terpisah
- [ ] M-06 Order Supplier satu menu dengan tab Order dan Faktur (layar 3, 4)
- [ ] M-07 Faktur supplier: isi, cocokkan dengan hitungan sistem, modal per barang, jika dicatat (layar 5; tunduk K2, K3)
- [ ] M-08 Invoice: daftar, tinjau dan edit draf, invoice terbit dan kirim WhatsApp (layar 6–8; tunduk K1, K4, K5, K6) — trigger draf otomatis dan RPC edit draf ditambahkan pada PR D-10; perlu UAT sebelum checklist ditutup
- [ ] M-09 Pembayaran: daftar piutang/hutang dan catat pembayaran dengan alokasi (layar 9, 10)
- [ ] M-10 Master Data: pelanggan, supplier, barang, harga khusus (layar 12, 13)
- [ ] M-11 Keuangan: Ikhtisar dan Laba Rugi (layar 14, 15) — **tunda sampai didiskusikan**

**Perbaikan dari audit lama yang masih berlaku**
- [ ] U-01 Hapus atau fungsikan elemen palsu: titik notifikasi, avatar, label pencarian, form yang tidak menyimpan, tombol "(segera)"
- [ ] U-02 Ganti navigasi hash dengan rute sungguhan; tab memperbarui URL
- [x] U-05 Dashboard: daftar tindakan, filter periode, pipeline status dengan hitungan dari server
- [ ] U-06 Faktur supplier: usulan, selisih langsung, modal per barang (D-01, D-02)
- [ ] U-07 Invoice cetak: pisahkan catatan internal, tambah rekening/instruksi pembayaran, tautan PDF di WhatsApp
- [ ] U-08 Satu gaya input (kelas `field-input`/`field-label` tidak terdefinisi di Pembayaran dan Buku Besar)
- [ ] U-09 Validasi per kolom dengan scroll dan fokus ke kesalahan pertama
- [ ] U-10 Ganti warna Tailwind langsung dengan token; lengkapi mode gelap
- [ ] U-11 Form pesanan: total langsung, label terlihat, penanda harga khusus, peringatan margin — total pra-pajak, validasi diskon, dan penanda harga khusus/manual diimplementasikan; label terlihat dan peringatan margin masih tersisa. Peringatan margin menunggu sumber biaya modal yang tervalidasi.
- [ ] U-12 Combobox dengan pencarian untuk barang dan baris PO
- [ ] U-13 `MoneyInput` dengan format Rp
- [ ] U-14 Ganti istilah teknis sesuai kamus; ringkas banner peringatan
- [ ] U-16 Dialog/Drawer: Escape, focus trap, kembalikan fokus
- [ ] U-18 Pagination dan filter dari server pada semua daftar
- [ ] U-20 Tema tanpa kedipan; ikon dari satu set
- [ ] U-21 Skeleton loading; catatan "Akses hanya-baca" untuk Viewer
- [ ] U-23 Verifikasi build/UAT akhir D-09/D-10 (PR #31): Pengiriman sudah dihapus; Pembayaran/Piutang & Hutang di `/pembayaran`; dashboard tanpa kartu shipment

Dihapus karena tidak berlaku lagi setelah mockup: U-03 (dropdown menu atas), U-04 (kontras `--muted-soft`, digantikan P1–P2), U-15 dan U-17 (pola Drawer/tombol antar layar, digantikan bagian 4–5 dan 11), U-19 (bar atas 1024–1280 px), U-22.

## 13. Pertanyaan terbuka untuk pemilik

Sudah diputuskan: bottom bar HP 5 slot berlabel dengan halaman Lainnya; satu menu Order supplier dengan tab Order dan Faktur; draf invoice otomatis yang ditinjau dan diedit (K5, perlu dicatat di `PRODUCT_SPEC.md`).

1. **Keuangan (layar 14, 15) perlu diskusi:** isi tab, siapa yang mencatat biaya operasional, alur Tutup Buku dan PPN, dan bagaimana tampilan Buku Besar yang belum dirilis. Jangan dibangun sebelum dibahas (M-11).
2. K1 sampai K4: putuskan dan catat di `PRODUCT_SPEC.md` (status PKP, ongkir/biaya lain, nota kredit) bersama pembaruan D-10 (K5).
3. Master data ada di balik slot Lainnya, jadi dua ketukan dari bottom bar. Cukup, atau ingin satu ketukan?
4. Tab Supplier dan Barang (Master Data), tab Hutang (Pembayaran), dan form tambah/ubah data belum ada mockup. Cukup dijelaskan lewat pola yang ada, atau perlu mockup sendiri?
5. Pembayaran yang sudah tersimpan: apakah dibatalkan dengan alasan lalu dicatat ulang (asumsi di layar 10)? Dokumen belum menegaskan ini.
6. Layar yang belum ada: Login, Pengaturan, keadaan umum (kosong, memuat, error, tanpa izin, Viewer), mode gelap, tablet, dan versi desktop. Prioritas mana yang dibuat dulu?

## 14. Checklist PR yang mengubah tampilan

- [ ] Memakai token, tidak ada hex langsung
- [ ] Terang dan gelap diperiksa
- [ ] Desktop (rail) dan mobile ≤ 820 px (bottom bar) diperiksa
- [ ] Tangkapan layar dibandingkan dengan mockup, ditempel di PR
- [ ] Penyimpangan hanya dari bagian 9; hal di bagian 10 tidak dibangun dari mockup
- [ ] Layar yang dibangun punya acuan di bagian 8; layar berstatus draf (14–15) tidak dibangun
- [ ] Item backlog bagian 12 yang selesai dicentang
