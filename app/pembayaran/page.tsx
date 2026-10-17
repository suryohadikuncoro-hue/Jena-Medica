import { PaymentManager } from "@/app/components/payment-manager";

export default function PaymentsPage() {
  return <main className="page-wrap">
    <div className="mb-6">
      <p className="page-kicker">Transaksi · Kas masuk dan keluar</p>
      <h1 className="page-title">Pembayaran</h1>
      <p className="page-description">Catat penerimaan pelanggan dan pembayaran supplier, lalu alokasikan ke invoice atau faktur yang memenuhi syarat. Catatan operasional belum tentu sudah menjadi jurnal buku besar.</p>
    </div>
    <PaymentManager />
  </main>;
}
