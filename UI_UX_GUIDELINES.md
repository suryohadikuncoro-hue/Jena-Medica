# Pedoman UI/UX — Jena Medical Center Business Suite

**Peran:** satu-satunya rujukan tampilan dan interaksi. Keputusan bisnis ada di `PRODUCT_SPEC.md`.
Pengguna utama adalah pemilik bisnis yang sering membuka dari HP, bukan akuntan.

## 1. Prinsip
1. **Jelas sebelum cantik.** Satu tujuan per layar, tindakan berikutnya selalu terlihat.
2. **Jujur.** Jangan menampilkan kontrol yang belum berfungsi (notifikasi palsu, avatar tetap, form yang tidak menyimpan). Fitur belum jadi: sembunyikan, atau tandai jelas "Segera".
3. **Bahasa sehari-hari.** Gunakan kamus istilah di bagian 7.
4. **Mobile-first.** Semua alur utama harus nyaman di HP (target sentuh minimal 44px, tanpa scroll horizontal pada halaman).
5. **Satu cara untuk satu hal.** Pakai komponen bersama, jangan membuat variasi baru per halaman.

## 2. Navigasi (menu tetap di atas)
- Bar atas sticky (tinggi 68px), isi: logo → menu utama → pencarian → "+ Buat Baru" → notifikasi → tema → akun.
- Menu utama: Dashboard · Transaksi · Master Data · Akuntansi · Laporan · Pengaturan. Setiap item **rute sungguhan** (mis. `/laporan/laba-rugi`), bukan hash (`#jurnal`). Tab di dalam halaman harus memperbarui URL.
- Dropdown: satu terbuka pada satu waktu; menutup saat klik di luar, pilih item, ganti rute, atau Escape; dapat dioperasikan dengan panah keyboard. Grup yang sedang aktif diberi penanda dan `aria-current`.
- Tidak ada item ganda. Halaman utama setelah login adalah Dashboard.
- Mobile (<1024px): hamburger + bottom bar 4 aksi (Dashboard, Pesanan, Invoice, Bayar). Breakpoint menu penuh diuji pada 1024, 1100, 1280px.
- Pencarian global hanya diberi label sesuai isinya. Jika hanya mencari menu, labelnya "Cari menu"; jika sudah mencari transaksi, baru "Cari transaksi". Mendukung panah, Enter, Escape, focus trap, dan mengembalikan fokus.

## 3. Token visual
- Aksen teal (`--accent`), latar netral, kartu putih; mode terang dan gelap.
- **Dilarang** memakai warna Tailwind langsung (`bg-amber-50`, `text-red-700`, dst.). Pakai token semantik: `--success`, `--warning`, `--danger`, `--info` dan padanan latarnya. Semua harus punya nilai gelap.
- Kontras teks minimal 4,5:1. `--muted-soft` (#859391) di latar putih sekitar 3,2:1 sehingga **tidak boleh** dipakai untuk teks kecil; gelapkan nilainya.
- Ukuran teks minimal 12px untuk sekunder, 14px untuk isi. Hindari 10 sampai 11px.
- Ikon memakai satu set ikon (mis. lucide-react), bukan karakter Unicode.
- Tema diterapkan sebelum render (skrip inline atau cookie) agar tidak berkedip.

## 4. Komponen bersama (wajib dipakai, taruh di `app/components/ui/`)
`Field`, `MoneyInput`, `Select/Combobox` (dengan pencarian), `DataTable` (mode kartu di mobile, pagination dari server), `StatCard`, `StatusBadge`, `Stepper`, `Drawer`, `Dialog`, `ConfirmDialog`, `Toast`, `EmptyState`, `Skeleton`, `PageHeader`.
- Satu definisi kelas input (`.field`); tidak boleh ada `field-input` atau `field-label` yang tidak terdefinisi.
- `StatCard` hanya satu definisi, bukan salinan per halaman.
- `Dialog` dan `Drawer`: menutup dengan Escape, mengunci fokus, mengembalikan fokus ke pemicu.

## 5. Aturan form transaksi
1. Kolom uang memakai `MoneyInput`: pemisah ribuan, `inputMode="decimal"`, tidak berubah saat scroll mouse.
2. Label kolom **selalu terlihat** (bukan hanya `aria-label`/placeholder), termasuk pada baris item.
3. Validasi per kolom: pesan di bawah kolom yang salah, semua kesalahan sekaligus, lalu scroll dan fokus ke kolom pertama yang bermasalah. Pesan sukses lewat Toast.
4. Total berjalan: ringkasan (subtotal, diskon, pajak, total) menempel dan diperbarui langsung.
5. Faktur suplier (D-01, D-02): tampilkan "hitungan sistem" berdampingan dengan "tercetak di faktur" dan selisih (hijau = cocok, merah = selisih). Tampilkan **modal efektif per item**.
6. Form pesanan: penanda "Harga khusus [nama pelanggan]" atau "Diubah manual", peringatan bila harga di bawah modal terakhir, peringatan bila pelanggan belum punya harga khusus.
7. Pilih barang/baris PO lewat combobox dengan pencarian; sediakan "tarik semua baris dari PO ini".
8. Aksi yang mengubah status (konfirmasi, batalkan, posting) memakai `ConfirmDialog` dengan ringkasan dampak. Pembatalan dilakukan di dialog dekat baris yang dipilih.
9. Setelah tombol "Buat/Catat" ditekan, scroll ke form dan fokuskan kolom pertama.
10. Simpan draf otomatis pada form panjang.

## 6. Dokumen cetak untuk pelanggan
- Area cetak berisi hanya isi invoice: identitas Jena, nomor, tanggal, jatuh tempo, pelanggan, item, total, **rekening dan instruksi pembayaran**.
- Catatan internal (status draf, AR, keputusan pajak, model drop-ship) tampil di layar saja dan diberi kelas `screen-only`.
- Pesan WhatsApp memuat tautan PDF, bukan hanya teks (D-06).

## 7. Kamus istilah
Kamus ini hanya berlaku untuk **teks yang dibaca pengguna di layar**. Kode, nama tabel/fungsi, migrasi, dan dokumen teknis tetap memakai istilah teknis (AP, AR, posting, dan sebagainya).

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

## 8. Alur lintas layar
- Baris pesanan terkonfirmasi: tombol **Buat PO**.
- Pesanan terkonfirmasi: tombol **Buat invoice** (sesuai D-10). Tidak ada layar atau menu Pengiriman (D-09).
- Invoice terbit: tombol **Kirim WhatsApp** dan **Catat pembayaran**.
- Stepper status di setiap pesanan: Pesanan → Order Suplier → Faktur Suplier → Invoice → Lunas (tanpa langkah pengiriman).
- Pola layar daftar seragam: tabel/kartu + panel detail geser (Drawer) dengan riwayat status.

## 9. Data dan kinerja
- Daftar memakai pagination dan filter dari server. Jangan menarik 2000 sampai 3000 baris ke browser untuk dihitung di klien; gunakan query count atau view.
- Keadaan memuat memakai Skeleton, bukan hanya teks.
- Pengguna Viewer melihat catatan "Akses hanya-baca" pada halaman yang aksinya disembunyikan.

## 10. Checklist perbaikan hasil audit
Centang dan hapus bila selesai. Urutan = prioritas.

**Tinggi**
- [ ] U-01 Hapus atau fungsikan elemen palsu: titik notifikasi, avatar "JM", label pencarian, form Daftar Akun yang tidak menyimpan, tombol "(segera)"
- [ ] U-02 Ganti navigasi hash menjadi rute sungguhan; tab memperbarui URL
- [ ] U-03 Dropdown menu: tutup saat klik luar/ganti rute/Escape, satu terbuka, penanda grup aktif, `aria-current`
- [ ] U-04 Kontras `--muted-soft` dan ukuran teks 10 sampai 11px
- [x] U-05 Dashboard: daftar tindakan, filter periode, pipeline status; hitungan dari server (bukan batas 2000 baris)
- [ ] U-06 Faktur suplier: hitung usulan, selisih langsung, modal efektif per item (D-01, D-02)
- [ ] U-07 Invoice cetak: pisahkan catatan internal, tambah rekening/instruksi pembayaran; tautan PDF di WhatsApp
- [ ] U-08 Definisikan gaya input tunggal (`field-input`/`field-label` tidak terdefinisi di Pembayaran dan Buku Besar)
- [ ] U-09 Validasi per kolom dengan scroll dan fokus ke kesalahan pertama

**Sedang**
- [ ] U-10 Ganti warna Tailwind langsung dengan token (sekitar 140 tempat); lengkapi mode gelap
- [ ] U-11 Form pesanan: total langsung, label terlihat, penanda harga khusus, peringatan margin
- [ ] U-12 Combobox dengan pencarian untuk barang dan baris PO
- [ ] U-13 `MoneyInput` dengan format Rp
- [ ] U-14 Ganti istilah teknis sesuai kamus; ringkas banner peringatan
- [ ] U-15 Samakan pola layar: Drawer + riwayat status untuk Pesanan dan Faktur; `ConfirmDialog` untuk konfirmasi
- [ ] U-16 Dialog/Drawer: Escape, focus trap, kembalikan fokus
- [ ] U-17 Tombol aksi antar layar (Buat PO, Buat invoice)
- [ ] U-18 Pagination dan filter dari server pada semua daftar
- [ ] U-19 Uji bar atas pada lebar 1024 sampai 1280px; perbaiki "Buat Baru" di mobile

**Rendah**
- [ ] U-20 Tema tanpa kedipan; ikon dari satu set; lebar header dan konten selaras
- [ ] U-21 Skeleton loading; catatan "Akses hanya-baca" untuk Viewer
- [ ] U-22 Arahkan setelah login ke Dashboard; perbaiki ikon "＋" di bottom bar
- [ ] U-23 Verifikasi build/UAT akhir untuk perubahan D-09/D-10 di PR #31: menu, halaman, dan komponen Pengiriman sudah dihapus; Pembayaran/Piutang & Hutang dipindah ke rute `/pembayaran`; dashboard tidak lagi menampilkan kartu shipment. Checklist tetap terbuka sampai lint/build dan pengujian alur terverifikasi.
