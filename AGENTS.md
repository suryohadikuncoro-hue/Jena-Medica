# AGENTS.md — Jena Medical Center Business Suite

Aplikasi web ERP distribusi B2B untuk Jena Medical Center, dipakai pemilik bisnis nyata. Baca seluruh file ini sebelum menulis kode.

<!-- BEGIN:jena-project-rules -->

## 1. Konteks singkat
- **Bisnis:** distributor alat/barang medis, model **drop-ship** (suplier kirim langsung ke pelanggan). 5 pelanggan tetap, 2 suplier tetap, desain tetap harus bisa bertambah.
- **Alur:** Pesanan Pelanggan → Order ke Suplier (bisa split) → Faktur Suplier → Invoice Pelanggan (WhatsApp) → Pembayaran → Jurnal → Laporan dan Dashboard.
- **Stack:** Next.js (App Router, TypeScript, Tailwind), Supabase (Auth, Postgres, RLS, RPC), deploy Cloudflare Workers lewat OpenNext.
- **Pengguna:** pemilik bukan akuntan. Tampilan harus mudah, terutama di HP.

## 2. Urutan prioritas dokumen
Jika dokumen atau instruksi bertentangan, yang di atas menang:
1. `docs/PRODUCT_SPEC.md` bagian "Keputusan pemilik" (D-01 dan seterusnya)
2. `ACCOUNTING_POLICY_AND_CUTOVER.md` (akuntansi dan pajak)
3. `docs/UI_UX_GUIDELINES.md` (tampilan dan interaksi)
4. `DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md`, `DATABASE_INTEGRATION_READINESS.md`, `SUPABASE_INTEGRATION.md`
5. `README.md` (ringkasan, bisa tertinggal)

## 3. Aturan konflik dan batasan (WAJIB)
- Jika instruksi, kode, dan dokumen saling bertentangan atau ambigu pada hal yang berdampak bisnis, **berhenti dan tanyakan pemilik**. Jangan memilih sendiri.
- Jangan mengaktifkan perhitungan pajak, tarif PPN, pemetaan akun, atau posting jurnal yang belum disetujui di `docs/PRODUCT_SPEC.md` bagian 3.
- Hitungan sistem pada faktur suplier hanya **usulan**. Angka tercetak di faktur asli tetap sumber kebenaran, dan selisih harus nol sebelum dicatat ke pembukuan (D-01).
- Tidak ada stok, gudang, batch, FEFO, atau persediaan fisik. Jangan ditambahkan.
- **Tidak ada pencatatan pengiriman** (D-09): pengiriman urusan suplier dan pelanggan. Jangan menambahkan resi, surat jalan, kurir, status kirim, atau penerimaan barang. Modul pengiriman yang masih ada di kode akan dihapus; jangan mengembangkannya lebih lanjut.
- Dasar invoice pelanggan sedang berubah dari pengiriman ke pesanan (D-10). **Jangan membuat migrasi atau kode invoice baru sebelum D-10 diputuskan.**
- Harga jual berbeda per pelanggan dengan riwayat tanggal berlaku. Simpan salinan harga di baris transaksi; transaksi lama tidak boleh berubah.
- Tidak ada hapus permanen pada transaksi. Gunakan batalkan (void) dengan alasan, jurnal balik, dan periode tutup.
- Jangan menambahkan kontrol palsu atau yang belum berfungsi di UI.

## 4. Keamanan dan data
- Hanya publishable key di browser. Service-role key tidak boleh ada di Git, klien, atau log.
- Perubahan transaksi lewat RPC server-side dengan cek role (`app_metadata.business_role`: owner, admin, viewer). Semua tabel ber-RLS.
- Hanya ada satu proyek Supabase. Data uji (TEST) boleh ada selama pengembangan dan **harus dibersihkan sebelum dipakai sungguhan** (`docs/PRODUCT_SPEC.md` D-05 dan bagian 6a). Jangan memasukkan data bisnis riil sebelum pembersihan, dan jangan membuat skrip seed otomatis di proyek ini.
- Jangan menyimpan rahasia, kata sandi, token, atau nomor kartu di log atau audit.

## 5. UI/UX
- Ikuti `docs/UI_UX_GUIDELINES.md`. Menu tetap di atas, navigasi berupa rute sungguhan (bukan hash).
- Pakai komponen bersama di `app/components/ui/`. Jangan membuat varian baru per halaman, dan jangan memakai kelas yang tidak terdefinisi.
- Pakai token warna (`--accent`, `--success`, `--warning`, `--danger`, dan sebagainya), bukan warna Tailwind langsung. Semua harus mendukung mode gelap.
- Istilah di layar mengikuti kamus di UI guidelines: Hutang usaha (bukan AP), Piutang usaha (bukan AR), Batalkan (bukan void), Catat ke pembukuan (bukan posting).
- Daftar memakai pagination dan filter dari server, bukan menarik ribuan baris ke browser.

## 6. Cara kerja
- Kerjakan bertahap dan berurutan sesuai backlog di `docs/PRODUCT_SPEC.md` bagian 5. Satu PR = satu tujuan jelas.
- Penamaan cabang mengikuti pola repo: `feat/...`, `fix/...`, `docs/...`. Pesan commit: `feat:`, `fix:`, `docs:`.
- Migrasi database baru dibuat di `supabase/migrations/` dengan nama berstempel waktu. Jangan mengubah migrasi lama yang sudah diterapkan.
- Jika ragu antara dua pendekatan, jelaskan opsinya di deskripsi PR dan tanyakan.

## 7. Checklist setiap PR
1. Perbarui tabel "Status fitur" di `docs/PRODUCT_SPEC.md` dan centang item di `docs/UI_UX_GUIDELINES.md` bagian 10 yang selesai.
2. Jalankan `npm run lint`, `npm run build`, dan `npm run build:worker`.
3. Di deskripsi PR tulis: keputusan (D-xx) yang diikuti, hal yang belum bisa diuji, dan pertanyaan terbuka.
4. Jika `README.md` tidak lagi akurat, perbarui.

<!-- END:jena-project-rules -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
