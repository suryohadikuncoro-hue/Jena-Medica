# Catatan keputusan D-09 dan D-10 (siap ditempel ke repo)

Tanggal keputusan: 17 Oktober 2026. Pemutus: Suryo (pemilik).

## A. `docs/PRODUCT_SPEC.md`

### A1. Baris D-09 (ganti seluruh baris di tabel bagian 3)

| D-09 | **Tidak ada pencatatan pengiriman.** Pengiriman urusan suplier dan pelanggan, bukan urusan pemilik. Hapus modul pengiriman: menu, halaman, komponen, dan tabel `shipments`, `shipment_lines`, `shipment_status_events`, beserta RPC `create_shipment` dan `transition_shipment` dan trigger invoice otomatis saat shipment delivered. Perubahan skema dilakukan langsung di Supabase (lihat D-11) dan dicatat di PR. Hanya data uji yang terdampak. Jangan menambahkan resi, surat jalan, kurir, status kirim, atau penerimaan barang. | Disetujui 17 Okt 2026 |

### A2. Baris D-10 (ganti seluruh baris)

| D-10 | **Dasar dan pemicu invoice pelanggan.** (1) Invoice dibuat **manual** oleh Owner/Admin dari **SO yang sudah dikonfirmasi**. (2) Satu SO boleh memiliki **beberapa invoice**. (3) Total kuantitas dan nilai kumulatif semua invoice aktif dari satu SO tidak boleh melebihi SO; dibatasi di database. Harga memakai snapshot harga di baris SO. (4) Tidak ada hubungan ke pengiriman. Invoice tidak memiliki `shipment_id`. (5) **Draft invoice tidak mengakui pendapatan.** (6) Pendapatan diakui saat invoice **diterbitkan** (status issued) dan menjadi piutang usaha. Pembayaran dicatat saat diterima dan hanya melunasi piutang; pembayaran tidak mengakui pendapatan kedua kali. (7) Invoice yang salah dibatalkan dengan alasan lalu dibuat baru (D-07). | Disetujui pemilik 17 Okt 2026. Aturan akuntansinya ada di `ACCOUNTING_POLICY_AND_CUTOVER.md` bagian 7 dan 8; tidak ada butir terbuka |

### A3. Tambahkan baris baru D-11

| D-11 | **Cara kerja database.** Aplikasi dibangun dan diuji langsung di Supabase (satu proyek). Tidak ada alur "bangun di lokal lalu dorong". Supabase adalah sumber kebenaran skema. File di `supabase/migrations/` hanya arsip dan nama/versinya harus sama dengan yang tercatat di remote. Setiap perubahan skema dijelaskan di deskripsi PR (apa yang diubah, dampak ke data uji). | Disetujui 17 Okt 2026 |

### A4. Bagian 2 (alur target), kalimat dalam kurung

Ganti "(kirim via WhatsApp; pemicu pembuatan menunggu D-10)" dengan "(dibuat manual dari SO terkonfirmasi, D-10; kirim via WhatsApp)".

### A5. Bagian 4 (status fitur)

- Baris "Pengiriman langsung + timeline status": `Akan dihapus (D-09), disetujui 17 Okt 2026`
- Baris "Invoice pelanggan": `Draf aktif tetapi masih terikat pengiriman di database; diubah ke dasar SO (D-10)`

### A6. Bagian 5 (backlog), ganti butir 2

2. Hapus modul pengiriman (D-09) dan ubah invoice ke dasar SO (D-10): lepas `shipment_id` dari `sales_invoices`, hapus trigger auto-invoice, ubah RPC `create_customer_invoice` agar menerima SO dan kuantitas per baris dengan batas kumulatif di database, tambah tombol "Buat invoice" di halaman SO. Satu PR. Data uji saja yang terdampak.

### A7. Bagian 6 (pertanyaan terbuka), ganti seluruh isi

Semua pertanyaan di bagian ini telah dijawab di `ACCOUNTING_POLICY_AND_CUTOVER.md` (disahkan 17 Okt 2026): status PKP (bagian 2, pengaturan perusahaan), selisih pembulatan (bagian 5), alokasi diskon dan ongkir (bagian 6), penyetuju dan jadwal cutover (bagian 12), pembersihan data uji dan nomor dokumen (bagian 12). Tidak ada pertanyaan terbuka.

Satu-satunya hal teknis yang tersisa: apakah migration akuntansi `20261017140000` sudah diterapkan di Supabase. Ini dicek dan dicatat di tabel Status fitur, bukan pertanyaan kebijakan.

### A9. Perubahan status keputusan lain di bagian 3

- **D-01:** hapus "(penanganan selisih pembulatan [PERLU KONFIRMASI] dengan akuntan)". Ganti dengan: "Selisih pembulatan ditangani sesuai `ACCOUNTING_POLICY_AND_CUTOVER.md` bagian 5 (baris Penyesuaian pembulatan maksimal Rp10)."
- **D-02:** hapus kalimat "mana yang dipakai sebagai HPP menunggu keputusan akuntan". Ganti dengan: "Alokasi dan HPP mengikuti `ACCOUNTING_POLICY_AND_CUTOVER.md` bagian 6."
- **D-03:** status menjadi "Disetujui". Hapus kalimat "Status PKP ... [PERLU KONFIRMASI]". Ganti dengan: "Status PKP adalah pengaturan perusahaan (kebijakan akuntansi bagian 2). Tarif memakai kode pajak berversi: `PPN_UMUM` = 12% × 11/12 DPP, efektif 11%, berlaku mulai 1 Januari 2025."
- **Header dokumen:** hapus kalimat tentang bagian bertanda [PERLU KONFIRMASI]; sudah tidak ada.

### A8. Header dokumen

Ubah "draf untuk disahkan pemilik" menjadi "disahkan pemilik 17 Oktober 2026, kecuali butir bertanda [PERLU KONFIRMASI]".

## B. `AGENTS.md`

### B1. Bagian 1, baris Alur

`Pesanan Pelanggan → Order ke Suplier (bisa split) → Faktur Suplier → Invoice Pelanggan (manual dari SO, WhatsApp) → Pembayaran → Jurnal → Laporan dan Dashboard.`

### B2. Bagian 3, ganti dua butir pengiriman dan invoice

- **Tidak ada pencatatan pengiriman** (D-09). Modul pengiriman ditargetkan dihapus. Jangan mengembangkannya, dan jangan menambah kode yang bergantung padanya.
- Invoice pelanggan dibuat manual dari SO terkonfirmasi, boleh beberapa kali, total kumulatif dibatasi SO (D-10). Draft tidak mengakui pendapatan. Jangan menautkan invoice ke pengiriman.

### B3. Bagian 5, butir navigasi

Jika rute berbasis hash (`#customers`, `#invoices`) masih ada, jangan menambah yang baru. Pindahkan ke rute sungguhan secara bertahap sesuai `docs/UI_UX_GUIDELINES.md`.

### B4. Bagian 6, ganti butir migrasi

Perubahan skema dilakukan langsung di Supabase (D-11). Setiap perubahan dicatat di deskripsi PR. File di `supabase/migrations/` adalah arsip, dengan nama dan versi yang sama dengan yang tercatat di remote. Jangan mengubah arsip lama yang sudah diterapkan.

## C. `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md`

- Bagian 13 (shipment), 14 (invoice per shipment) dan 15 (auto-invoice): tambahkan di bawah judul `> DIBATALKAN 17 Okt 2026 oleh D-09 dan D-10. Dipertahankan hanya sebagai riwayat.`
- Bagian 1 (alur) dan ERD: hapus SHIPMENT dan SHIPMENT_LINE, ubah relasi invoice menjadi SALES_ORDER → SALES_INVOICE.
- Tabel bagian 2: hapus baris "Pengiriman". Pada baris "Invoice Pelanggan" ganti "sumber kuantitas/trigger invoice perlu dipastikan" dengan "dibuat manual dari SO (D-10)".
- Bagian 5 butir 4 dan bagian 6 butir 6: ganti dengan "invoice dari SO (D-10)".
- Bagian 8 sampai 12: beri label `Riwayat per tahap` dan jangan dipakai sebagai status terkini.

## D. `SUPABASE_INTEGRATION.md`, `DATABASE_INTEGRATION_READINESS.md`, `README.md`

- Hapus semua keterangan shipment (tabel, RPC, UI) setelah penghapusannya selesai. Selama belum selesai, tulis "akan dihapus (D-09)".
- Hapus kata "file lokal" dan "versi remote" pada daftar migration. Pakai satu nama versi yang sama dengan remote (D-11). Samakan nama migration invoice (`20261016175827` di READINESS vs `20261017100000` di dokumen lain) dengan yang tercatat di Supabase.
- README: perbarui jumlah migration dan tabel, serta status halaman. Tambahkan satu baris: "Sumber kebenaran: AGENTS.md dan docs/PRODUCT_SPEC.md".
