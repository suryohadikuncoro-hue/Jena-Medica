# Catatan Keputusan D-09, D-10, dan D-11

**Tanggal keputusan:** 17 Oktober 2026  
**Pemutus:** Suryo (pemilik)  
**Status:** keputusan disahkan; implementasi teknis masih perlu PR terpisah. Catatan ini adalah rekam keputusan, bukan daftar instruksi yang harus ditempel secara manual ke dokumen lain.

Sumber kebenaran keputusan produk adalah PRODUCT_SPEC.md. Kebijakan akuntansi dan pajak rinci ada di ACCOUNTING_POLICY_AND_CUTOVER.md. Kondisi schema remote diperiksa di DATABASE_INTEGRATION_READINESS.md dan SUPABASE_INTEGRATION.md.

## D-09 — Tidak ada pencatatan pengiriman

Keputusan: pengiriman merupakan urusan supplier dan pelanggan, bukan fungsi sistem Jena. Hapus menu, halaman, komponen, tabel shipments/shipment_lines/shipment_status_events, RPC create_shipment/transition_shipment, serta trigger invoice otomatis berbasis status delivered. Jangan menambahkan resi, surat jalan, kurir, status kirim, timeline pengiriman, atau penerimaan barang.

**Instruksi implementasi pemilik:** record shipment tersebut diperlakukan sebagai data uji dan dihapus bersama objek shipment legacy. Tidak perlu menunggu backup sebagai prasyarat D-09. Record customer_payment dan supplier_payment tidak termasuk scope penghapusan dan harus tetap ada.

## D-10 — Invoice manual dari SO

Keputusan:

1. Owner/Admin membuat invoice manual dari SO yang telah dikonfirmasi.
2. Satu SO boleh memiliki beberapa invoice; total kuantitas dan nilai kumulatif semua invoice aktif tidak boleh melampaui SO. Aturan harus dijaga oleh database, bukan UI saja.
3. Invoice tidak memiliki shipment_id dan tidak bergantung pada event pengiriman.
4. Draft tidak mengakui pendapatan atau piutang. Pendapatan/piutang timbul saat invoice diterbitkan sesuai kebijakan akuntansi.
5. Pembayaran setelah invoice mengurangi piutang. Dana yang diterima sebelum invoice dicatat sebagai uang muka dan ditangani sesuai kebijakan pajak/akuntansi.
6. Invoice salah yang sudah diterbitkan dikoreksi melalui nota kredit dan dokumen baru yang tertaut, bukan mengubah histori tanpa jejak.

**Status implementasi saat audit 17 Oktober 2026:** tabel/RPC invoice masih mengikat sales invoice ke shipment, dan trigger auto-invoice masih aktif. Perubahan schema, RPC, route, tombol, serta batas kuantitas/nilai berbasis SO belum dikerjakan.

## D-11 — Supabase sebagai sumber kebenaran schema

Keputusan:

- Hanya ada satu proyek Supabase yang dipakai sebagai sumber kebenaran schema.
- Perubahan schema dijalankan secara terkontrol langsung pada proyek tersebut setelah ada persetujuan dan PR yang menjelaskan objek, risiko data, rencana pemulihan, dan validasi.
- Folder supabase/migrations adalah arsip. Version ID dan nama arsip harus sama dengan migration history remote; isi migration yang sudah diterapkan tidak boleh diedit.
- Jangan menjalankan supabase db push, menghapus data, mengubah schema, membuka gate posting, atau deploy tanpa langkah dan persetujuan yang sesuai.

**Status implementasi:** audit menemukan 9 migration remote. PR dokumentasi menyamakan nama/version prefix empat arsip migration dengan ID remote dan tidak mengubah konten SQL atau database.

## Urutan implementasi yang harus diikuti

1. Terapkan D-09: hapus objek dan seluruh record shipment legacy beserta RPC/trigger terkait sesuai keputusan pemilik; tidak perlu menunggu backup sebagai prasyarat.
2. Terapkan D-10 dalam perubahan yang terkoordinasi: invoice manual dari SO terkonfirmasi, kuantitas/nilai kumulatif dibatasi database, tanpa shipment_id.
3. Pertahankan tabel dan record pembayaran pelanggan/supplier.
4. Verifikasi RLS/policy, constraint, RPC/trigger, jumlah record yang tersisa, alur invoice parsial, dan role Owner/Admin/Viewer.
5. Perbarui status fitur dan hasil UAT di dokumentasi setelah implementasi benar-benar diverifikasi.

## Dokumen terkait

- PRODUCT_SPEC.md — keputusan produk, alur target, backlog dan cutover.
- ACCOUNTING_POLICY_AND_CUTOVER.md — pajak, pengakuan pendapatan/HPP, jurnal, cutover.
- DATA_MODEL_MAPPING_AND_INTEGRATION_PLAN.md — ERD target dan aturan integritas.
- DATABASE_INTEGRATION_READINESS.md — snapshot audit remote.
- SUPABASE_INTEGRATION.md — rincian integrasi/auth/RLS dan migration remote.
