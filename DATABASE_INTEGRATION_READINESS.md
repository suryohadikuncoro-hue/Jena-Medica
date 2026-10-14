# Audit Kesiapan Integrasi Database — Jena Medical Center

**Tanggal audit:** 14 Oktober 2026  
**Status:** Belum siap untuk memakai data produksi. Siap melanjutkan ke tahap desain pemetaan data dan rencana integrasi tanpa mengubah database.

## Ringkasan eksekutif

Workspace prototipe saat ini mencakup Penjualan/Faktur, Master Data, Pembelian & Persediaan, Pengiriman & Piutang, Keuangan & Laporan, serta Dashboard manajemen. Namun, tampilan ini belum merupakan satu sistem transaksi terintegrasi. Data di setiap halaman disimpan sebagai konstanta atau state lokal browser; beberapa aksi hanya mengubah state lokal atau menampilkan notifikasi. Perubahan lokal akan hilang saat halaman dimuat ulang.

Dashboard menggabungkan angka ilustratif yang dibuat terpisah. Ia belum membaca satu sumber data bersama, sehingga nilainya tidak boleh dipakai untuk operasi, penagihan, pembelian, atau pembukuan aktual.

**Keputusan:** jangan hubungkan workspace ini langsung ke database produksi dulu. Tahap berikutnya harus memetakan skema/relasi dan aturan posting, lalu implementasi bertahap pada lingkungan pengembangan atau database uji. Perubahan schema, migrasi, dan deployment tetap memerlukan persetujuan eksplisit.

## Status tiap modul

| Modul | Kondisi prototipe saat ini | Penghalang utama sebelum integrasi |
|---|---|---|
| Dashboard | KPI dan pengingat bersifat ilustratif dan statis. | Buat query/read-model dari sumber data yang sama; definisikan periode, status retur, piutang, utang, dan stok agar konsisten. |
| Penjualan/Faktur | Daftar faktur dan item contoh berada di app/page.tsx; beberapa tombol aksi masih placeholder. | Hubungkan ke pelanggan/barang, alokasi batch, jumlah yang diserahkan, status invoice, pengiriman, dan piutang. Validasi dan posting harus server-side. |
| Master Data | Pelanggan/barang memakai seed array dan React state lokal. | Tentukan kode unik, field wajib, relasi, status aktif/nonaktif, aturan perubahan, serta persistensi dan audit. |
| Pembelian & Persediaan | PO dan batch contoh terpisah dalam state lokal; penerimaan simulasi membuat batch generik karantina. | Relasikan PO-line → penerimaan → pemeriksaan fisik → batch. Simpan jumlah dipesan, diterima, ditolak/rusak, supplier, biaya, ED, dan status secara terkontrol. PO sendiri tidak boleh menambah stok. |
| Pengiriman & Piutang | Status surat jalan dan pembayaran parsial diubah di state lokal. | Relasikan surat jalan ke invoice dan kuantitas aktual; proses gagal/retur harus melewati inspeksi fisik. Pembayaran harus memiliki alokasi, tanggal, metode, referensi, dan penanganan uang muka/kelebihan. |
| Keuangan & Laporan | Transaksi kas bersifat lokal; laba rugi dan beberapa saldo menggunakan nilai contoh tetap. | Perlu ledger/jurnal yang dapat diaudit, sumber data AR/AP yang konsisten, aturan posting, rekonsiliasi bank, serta pemisahan laba, kas, persediaan, utang, piutang dan modal. |

## Gerbang kesiapan wajib

### 1. Pemetaan data dan sumber kebenaran
- [ ] Cocokkan setiap entitas/relasi dengan DBDD v0.2 dan spesifikasi posting akuntansi yang sudah disepakati.
- [ ] Tetapkan sumber data utama untuk pelanggan, barang, supplier, purchase order, penerimaan, batch, invoice, surat jalan, pembayaran, AR/AP, kas/bank, jurnal, dan audit log.
- [ ] Tetapkan primary key, foreign key, unique constraint, status, indeks, aturan penghapusan/nonaktif, dan strategi nomor dokumen.
- [ ] Konfirmasikan platform/lingkungan database tujuan, konfigurasi lokal, uji, dan produksi. Jangan memasukkan .env atau kredensial ke Git.

### 2. Aturan transaksi dan posting
- [ ] Purchase order tidak menambah stok; stok bertambah setelah kuantitas penerimaan fisik disetujui.
- [ ] Stok karantina/rusak tidak termasuk stok siap jual.
- [ ] Gunakan FEFO untuk alokasi pengeluaran/picking; metode HPP/FIFO harus tetap menunggu validasi akuntansi yang disepakati.
- [ ] Invoice dibuat berdasarkan jumlah yang benar-benar diserahkan dan sudah dikonfirmasi sesuai alur yang disepakati.
- [ ] Pengiriman gagal/retur tidak otomatis menambah kembali stok; wajib inspeksi, dan retur pelanggan hanya mengkredit kuantitas yang disetujui serta diterima.
- [ ] Faktur supplier/AP dipisahkan dari PO dan penerimaan barang.
- [ ] Pembayaran dapat parsial dan dialokasikan per invoice; kelebihan/uang muka tidak boleh dipaksa menjadi pembayaran invoice.
- [ ] Dokumen yang sudah diposting tidak boleh diubah/dihapus diam-diam; koreksi harus berupa pembalikan/penyesuaian terkait dengan audit trail.
- [ ] Pajak tetap konfigurabel sesuai kebijakan, tidak di-hard-code sebagai tarif universal.

### 3. Keamanan dan jejak audit
- [ ] Autentikasi dan aturan akses server-side ditetapkan sebelum data bisnis disimpan.
- [ ] Pastikan RLS/otorisasi sesuai pengguna dan kepemilikan data; jangan mengandalkan penyembunyian tombol di UI.
- [ ] Validasi semua input/nominal/status dan transaksi bersamaan di sisi server/database.
- [ ] Audit log mencatat siapa, kapan, apa yang berubah, dan alasan koreksi untuk transaksi penting.
- [ ] Siapkan backup, prosedur restore, migration versioning, dan jalur rollback sebelum perubahan schema.

### 4. Uji penerimaan lintas modul
- [ ] Duplikasi kode pelanggan/barang ditolak juga di server/database.
- [ ] PO, penerimaan parsial, penerimaan rusak/karantina, ED, dan pembaruan stok menghasilkan saldo yang benar.
- [ ] Picking tidak mengambil stok karantina; aturan FEFO diuji dengan beberapa batch/ED.
- [ ] Faktur dan surat jalan parsial memakai kuantitas yang sesuai; pengiriman gagal hanya kembali ke stok setelah inspeksi.
- [ ] Pembayaran parsial, pelunasan, alokasi, kelebihan/uang muka, AR aging, faktur supplier, dan jatuh tempo AP konsisten.
- [ ] Jurnal, buku besar, laba rugi, arus kas, dan posisi AR/AP dapat ditelusuri kembali ke dokumen sumber.
- [ ] Transaksi yang sudah diposting dikoreksi lewat proses yang dapat diaudit; uji hak akses dan batas periode.
- [ ] Jalankan lint, build, unit/integration test yang tersedia, serta uji skenario manual di database non-produksi.

## Urutan implementasi yang disarankan

1. Finalisasi pemetaan skema/relasi dan keputusan posting dengan DBDD v0.2 serta spesifikasi akuntansi.
2. Siapkan koneksi database untuk lingkungan pengembangan/uji dengan secret lokal yang tidak di-commit.
3. Integrasikan Master Data terlebih dahulu, lengkap dengan constraint dan validasi server-side.
4. Integrasikan Pembelian → Penerimaan → Batch/ED → saldo stok.
5. Integrasikan Penjualan → picking batch → serah-terima/pengiriman → invoice → piutang.
6. Integrasikan pembayaran/alokasi, faktur supplier/AP, transaksi kas/bank, dan jurnal.
7. Bentuk laporan dan dashboard dari query/read-model yang konsisten; jangan lagi mengandalkan angka statis.
8. Uji skenario lintas modul, backup/restore, serta rekonsiliasi sebelum meminta persetujuan migrasi dan deployment.

## Batasan audit

Ini adalah audit statis atas struktur dan perilaku kode prototipe saat ini serta aturan bisnis yang sudah disepakati. Audit ini **bukan** verifikasi terhadap database aktual, konfigurasi produksi, keamanan runtime, atau hasil lint/build; semua itu perlu diuji di lingkungan masing-masing.

**Belum ada perubahan schema, migrasi, koneksi produksi, atau deployment sebagai bagian dari audit ini.**
