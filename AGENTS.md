# AGENTS.md — Jena Medical Center Business Suite

Aplikasi web ERP distribusi B2B untuk Jena Medical Center, dipakai pemilik bisnis nyata. Baca seluruh file ini sebelum menulis kode.

<!-- BEGIN:jena-project-rules -->

## 1. Konteks singkat
- **Bisnis:** distributor alat/barang medis, model **drop-ship** (supplier kirim langsung ke pelanggan). 5 pelanggan tetap, 2 supplier tetap, desain tetap harus bisa bertambah.
- **Alur target:** Pesanan Pelanggan → Order ke Supplier (bisa split) → Faktur Supplier → Invoice Pelanggan manual dari SO terkonfirmasi → Pembayaran/alokasi → Jurnal → Laporan dan Dashboard.
- **Stack:** Next.js (App Router, TypeScript, Tailwind), Supabase (Auth, Postgres, RLS, RPC), deploy Cloudflare Workers lewat OpenNext.
- **Database:** sesuai D-11, satu proyek Supabase adalah sumber kebenaran schema. Dokumen status harus merujuk kondisi remote terverifikasi, bukan menganggap file migration sama dengan status penerapan.
- **Pengguna:** pemilik bukan akuntan. Tampilan harus mudah, terutama di HP.

## 2. Urutan prioritas dokumen
Jika dokumen atau instruksi bertentangan, yang di atas menang:
1. `PRODUCT_SPEC.md` bagian "Keputusan pemilik" (D-01 dan seterusnya)
2. `ACCOUNTING_POLICY_AND_CUTOVER.md` (akuntansi dan pajak)
3. `UI_UX_GUIDELINES.md` (tampilan dan interaksi)
4. `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md`, `DATABASE_INTEGRATION_READINESS.md`, `SUPABASE_INTEGRATION.md`
5. `README.md` (ringkasan, bisa tertinggal)

## 3. Aturan konflik dan batasan (WAJIB)
- Jika instruksi, kode, dan dokumen saling bertentangan atau ambigu pada hal yang berdampak bisnis, **berhenti dan tanyakan pemilik**. Jangan memilih sendiri.
- Kebijakan pajak dan akuntansi disetujui dalam `PRODUCT_SPEC.md` dan `ACCOUNTING_POLICY_AND_CUTOVER.md`, tetapi itu **bukan** berarti konfigurasi perusahaan sudah diisi atau posting sudah aktif. Jangan melewati approval gate: profile saat ini masih `draft`, mapping akun dan periode belum ada. Jangan membuat asumsi status PKP atau klasifikasi pajak barang.
- Hitungan sistem pada faktur supplier hanya **usulan**. Angka tercetak di faktur asli tetap sumber kebenaran, dan selisih harus nol sebelum dicatat ke pembukuan (D-01).
- Tidak ada stok, gudang, batch, FEFO, atau persediaan fisik. Jangan ditambahkan.
- **Tidak ada pencatatan pengiriman** (D-09, sudah disetujui): jangan menambahkan resi, surat jalan, kurir, status kirim, atau penerimaan barang. Hapus langsung modul/tabel/RPC/trigger dan record shipment legacy sesuai instruksi pemilik; penghapusan tidak menunggu backup sebagai prasyarat. Pertahankan tabel dan record pembayaran pelanggan/supplier.
- **Invoice pelanggan** (D-10, sudah disetujui): invoice dibuat manual dari SO terkonfirmasi, dapat parsial, batas kuantitas/nilai kumulatif dijaga database, tanpa `shipment_id`. Kode UI/RPC target ada pada branch PR ini; schema Supabase remote masih legacy sampai migration baru diterapkan. Jangan mengklaim siap dipakai terhadap Production sebelum kode dan migration dirilis bersama.
- Harga jual berbeda per pelanggan dengan riwayat tanggal berlaku. Simpan salinan harga di baris transaksi; transaksi lama tidak boleh berubah.
- Tidak ada hapus permanen pada transaksi. Gunakan batalkan (void) dengan alasan, jurnal balik, dan periode tutup.
- Jangan menambahkan kontrol palsu atau yang belum berfungsi di UI.

## 4. Keamanan dan data
- Hanya publishable key di browser. Service-role key tidak boleh ada di Git, klien, atau log.
- Perubahan transaksi lewat RPC server-side dengan cek role (`app_metadata.business_role`: owner, admin, viewer). Semua tabel ber-RLS.
- Hanya ada satu proyek Supabase. Data uji (TEST) boleh ada selama pengembangan dan **harus dibersihkan sebelum dipakai sungguhan** (`PRODUCT_SPEC.md` D-05 dan bagian 6a). Jangan memasukkan data bisnis riil sebelum pembersihan, dan jangan membuat skrip seed otomatis di proyek ini.
- Jangan menyimpan rahasia, kata sandi, token, atau nomor kartu di log atau audit.

## 5. UI/UX
- Ikuti `UI_UX_GUIDELINES.md`. Tampilan mengikuti mockup yang disetujui pemilik (`design/Mockup_Jena_Business_Suite.pdf` dan `.html` untuk desktop, `design/mockup-hp/index.html` untuk 15 layar HP): menu di **rail kiri** pada desktop dan **bottom bar 5 slot berlabel** pada HP (Dashboard, Pesanan, Order, Invoice, Lainnya). Aturan lama "menu tetap di atas" sudah dicabut. Navigasi berupa rute sungguhan (bukan hash).
- Hanya penyimpangan di `UI_UX_GUIDELINES.md` bagian 9 yang boleh berbeda dari mockup. Hal yang tercantum di bagian 10 (PPN, ongkir, nota kredit, alur invoice, pengiriman WhatsApp) **jangan dibangun dari mockup**; layar berstatus draf (Keuangan, layar 14–15) belum boleh dibangun: ikuti `PRODUCT_SPEC.md` dan tanyakan pemilik.
- Pakai komponen bersama di `app/components/ui/`. Jangan membuat varian baru per halaman, dan jangan memakai kelas yang tidak terdefinisi.
- Pakai token warna dari `UI_UX_GUIDELINES.md` bagian 3 (`--page`, `--shell`, `--card`, `--ink`, `--teal`, `--good`, `--warn`, `--bad`, dan seterusnya), bukan warna Tailwind atau hex langsung. Semua harus mendukung mode terang dan gelap.
- Istilah di layar mengikuti kamus di UI guidelines: Hutang usaha (bukan AP), Piutang usaha (bukan AR), Batalkan (bukan void), Catat ke pembukuan (bukan posting).
- Daftar memakai pagination dan filter dari server, bukan menarik ribuan baris ke browser.

## 6. Cara kerja
- Kerjakan bertahap dan berurutan sesuai backlog di `PRODUCT_SPEC.md` bagian 5. Satu PR = satu tujuan jelas.
- Penamaan cabang mengikuti pola repo: `feat/...`, `fix/...`, `docs/...`. Pesan commit: `feat:`, `fix:`, `docs:`.
- Perubahan skema mengikuti D-11: perubahan diterapkan langsung pada satu proyek Supabase dan dicatat dengan arsip migration yang version ID-nya sesuai remote history. Isi migration yang sudah diterapkan tidak boleh diedit. D-09 adalah persetujuan eksplisit pemilik untuk menghapus objek/record shipment legacy tanpa menunggu backup sebagai prasyarat; record pembayaran tetap dipertahankan. Untuk perubahan destructive lain di luar D-09, tetap minta persetujuan pemilik.
- Jika ragu antara dua pendekatan, jelaskan opsinya di deskripsi PR dan tanyakan.

## 7. Checklist setiap PR
1. Perbarui tabel "Status fitur" di `PRODUCT_SPEC.md` dan centang item di `UI_UX_GUIDELINES.md` bagian 12 yang selesai.
2. Jalankan `npm run lint`, `npm run build`, dan `npm run build:worker`.
3. Di deskripsi PR tulis: keputusan (D-xx) yang diikuti, hal yang belum bisa diuji, dan pertanyaan terbuka.
4. Jika `README.md` tidak lagi akurat, perbarui.

<!-- END:jena-project-rules -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
