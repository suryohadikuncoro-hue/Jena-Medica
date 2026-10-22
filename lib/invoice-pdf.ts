import { jsPDF } from "jspdf";

export type InvoicePdfLine = {
  productName: string;
  productCode: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  status: "draft" | "issued" | "void";
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerCode: string;
  customerPhone?: string | null;
  shipToAddress: string;
  orderNumber?: string | null;
  orderDate?: string | null;
  notes?: string | null;
  subtotal: number | string;
  taxAmount: number | string;
  total: number | string;
  taxStatus?: string | null;
  paymentTermsDays?: number | null;
  lines: InvoicePdfLine[];
};

const INK: [number, number, number] = [23, 24, 28];
const MUTED: [number, number, number] = [107, 110, 117];
const LINE: [number, number, number] = [228, 229, 226];
const PANEL: [number, number, number] = [245, 245, 243];
const MINT: [number, number, number] = [194, 236, 221];
const PINK: [number, number, number] = [248, 201, 211];
const AMBER: [number, number, number] = [252, 235, 195];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const rupiah = (value: number | string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const qty = (value: number | string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(Number(value) || 0);

function longDate(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function statusLabel(status: InvoicePdfData["status"]) {
  if (status === "issued") return "DITERBITKAN";
  if (status === "void") return "DIBATALKAN";
  return "DRAFT - BELUM DITERBITKAN";
}

export function invoicePdfFileName(data: InvoicePdfData) {
  const safe = (data.invoiceNumber || "invoice").replace(/[^A-Za-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  const customer = (data.customerName || "pelanggan").replace(/[^A-Za-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `Invoice-${safe}-${customer}.pdf`;
}

export function buildInvoicePdf(data: InvoicePdfData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const isIssued = data.status === "issued";

  // Header band
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_WIDTH, 34, "F");
  doc.setFillColor(...MINT);
  doc.roundedRect(MARGIN, 9, 15, 15, 3, 3, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("JM", MARGIN + 7.5, 18.6, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("JENA MEDICAL CENTER", MARGIN + 20, 15.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(169, 172, 180);
  doc.text("Distribusi alat kesehatan - Dokumen penagihan komersial", MARGIN + 20, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", PAGE_WIDTH - MARGIN, 15.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(194, 236, 221);
  doc.text(data.invoiceNumber || "-", PAGE_WIDTH - MARGIN, 21.5, { align: "right" });

  // Status badge
  let cursorY = 42;
  const badgeColor: [number, number, number] = data.status === "issued" ? MINT : data.status === "void" ? PINK : AMBER;
  doc.setFillColor(...badgeColor);
  const badgeText = statusLabel(data.status);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const badgeWidth = doc.getTextWidth(badgeText) + 10;
  doc.roundedRect(MARGIN, cursorY, badgeWidth, 8, 4, 4, "F");
  doc.setTextColor(...INK);
  doc.text(badgeText, MARGIN + badgeWidth / 2, cursorY + 5.4, { align: "center" });

  // Meta grid
  cursorY = 58;
  const meta: Array<[string, string]> = [
    ["TANGGAL INVOICE", longDate(data.invoiceDate)],
    ["JATUH TEMPO", longDate(data.dueDate)],
    ["NOMOR PESANAN", data.orderNumber || "-"],
    ["TANGGAL PESANAN", longDate(data.orderDate)],
  ];
  const colWidth = CONTENT_WIDTH / 2;
  meta.forEach(([label, value], index) => {
    const x = MARGIN + (index % 2) * colWidth;
    const y = cursorY + Math.floor(index / 2) * 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(value, x, y + 5);
  });

  // Bill to / ship to panels
  cursorY = 84;
  const panelWidth = (CONTENT_WIDTH - 6) / 2;
  doc.setFillColor(...PANEL);
  doc.roundedRect(MARGIN, cursorY, panelWidth, 34, 3, 3, "F");
  doc.roundedRect(MARGIN + panelWidth + 6, cursorY, panelWidth, 34, 3, 3, "F");

  const panelLabel = (text: string, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(text, x, y);
  };

  panelLabel("DITAGIHKAN KEPADA", MARGIN + 5, cursorY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(data.customerName || "Pelanggan", panelWidth - 10).slice(0, 2), MARGIN + 5, cursorY + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Kode pelanggan: ${data.customerCode || "-"}`, MARGIN + 5, cursorY + 24);
  if (data.customerPhone) doc.text(`Telepon: ${data.customerPhone}`, MARGIN + 5, cursorY + 28.5);

  const shipX = MARGIN + panelWidth + 11;
  panelLabel("ALAMAT PENGIRIMAN", shipX, cursorY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(data.shipToAddress || "-", panelWidth - 10).slice(0, 5), shipX, cursorY + 14);

  // Items table
  let tableY = cursorY + 42;
  const columns = { no: MARGIN + 2, name: MARGIN + 10, qty: 128, price: 158, amount: PAGE_WIDTH - MARGIN - 2 };

  const drawTableHeader = () => {
    doc.setFillColor(...INK);
    doc.roundedRect(MARGIN, tableY, CONTENT_WIDTH, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("NO", columns.no + 2, tableY + 5.8);
    doc.text("BARANG", columns.name, tableY + 5.8);
    doc.text("QTY", columns.qty, tableY + 5.8, { align: "right" });
    doc.text("HARGA/UNIT", columns.price, tableY + 5.8, { align: "right" });
    doc.text("JUMLAH", columns.amount, tableY + 5.8, { align: "right" });
    tableY += 9;
  };

  drawTableHeader();

  data.lines.forEach((line, index) => {
    const nameLines = doc.splitTextToSize(line.productName || "-", 76).slice(0, 2);
    const metaLine = [line.productCode, line.unit].filter(Boolean).join(" - ");
    const rowHeight = Math.max(11, 6 + nameLines.length * 4.2);

    if (tableY + rowHeight > PAGE_HEIGHT - 34) {
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(`Invoice ${data.invoiceNumber || "-"} - lanjutan`, MARGIN, MARGIN + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(`${data.customerName} | ${longDate(data.invoiceDate)}`, PAGE_WIDTH - MARGIN, MARGIN + 2, { align: "right" });
      tableY = MARGIN + 8;
      drawTableHeader();
    }

    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 248);
      doc.rect(MARGIN, tableY, CONTENT_WIDTH, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(String(index + 1), columns.no + 2, tableY + 5.4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...INK);
    doc.text(nameLines, columns.name, tableY + 5.4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(metaLine, columns.name, tableY + 5.4 + nameLines.length * 4.2);

    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(`${qty(line.quantity)} ${line.unit}`.trim(), columns.qty, tableY + 5.4, { align: "right" });
    doc.text(rupiah(line.unitPrice), columns.price, tableY + 5.4, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(rupiah(line.lineTotal), columns.amount, tableY + 5.4, { align: "right" });

    tableY += rowHeight;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, tableY, PAGE_WIDTH - MARGIN, tableY);
  });

  // Totals
  let totalsY = tableY + 8;
  const totalsX = PAGE_WIDTH - MARGIN - 78;
  const totalsWidth = 78;
  const totalRow = (label: string, value: string, y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label, totalsX + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, totalsX + totalsWidth - 4, y, { align: "right" });
  };

  if (totalsY > PAGE_HEIGHT - 80) {
    doc.addPage();
    totalsY = MARGIN + 8;
  }

  doc.setFillColor(...PANEL);
  doc.roundedRect(totalsX, totalsY, totalsWidth, isIssued ? 30 : 22, 3, 3, "F");
  totalRow("Subtotal setelah diskon", rupiah(data.subtotal), totalsY + 7);
  if (isIssued) {
    totalRow("PPN sesuai keputusan", rupiah(data.taxAmount), totalsY + 13.5);
  }
  doc.setFillColor(...INK);
  doc.roundedRect(totalsX, totalsY + (isIssued ? 18 : 12), totalsWidth, 12, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(isIssued ? "TOTAL INVOICE" : "TOTAL SEMENTARA", totalsX + 4, totalsY + (isIssued ? 25.5 : 19.5));
  doc.setFontSize(10);
  doc.text(rupiah(data.total), totalsX + totalsWidth - 4, totalsY + (isIssued ? 25.5 : 19.5), { align: "right" });

  // Notes and terms, aligned with the totals block
  const leftWidth = totalsX - MARGIN - 8;
  let noteY = totalsY + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("CATATAN", MARGIN, noteY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const noteLines = data.notes ? doc.splitTextToSize(data.notes, leftWidth).slice(0, 5) : ["Tidak ada catatan tambahan pada dokumen ini."];
  doc.text(noteLines, MARGIN, noteY + 5.5);
  noteY += 5.5 + noteLines.length * 4.2;

  if (data.paymentTermsDays) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Termin pembayaran ${data.paymentTermsDays} hari sejak tanggal invoice.`, MARGIN, noteY + 6);
    noteY += 10;
  }

  // Signature block
  const signatureY = Math.min(Math.max(noteY + 18, totalsY + 46), PAGE_HEIGHT - 46);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, signatureY, MARGIN + 52, signatureY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Jena Medical Center", MARGIN, signatureY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Bagian penagihan", MARGIN, signatureY + 9.5);

  // Footer
  const footerY = PAGE_HEIGHT - 24;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...MUTED);
  const footer = isIssued
    ? "Invoice komersial ini telah diterbitkan dan dibukukan ke piutang. Nilai PPN mengikuti keputusan pajak yang disetujui. Dokumen ini bukan Faktur Pajak atau e-Faktur."
    : "Pratinjau draft internal. Dokumen belum diterbitkan dan belum dibukukan ke piutang, sehingga bukan tagihan final maupun Faktur Pajak.";
  doc.text(doc.splitTextToSize(footer, CONTENT_WIDTH), MARGIN, footerY + 5);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...MUTED);
    doc.text(`Halaman ${page} dari ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
    doc.text("Dokumen dibuat oleh sistem Jena Medical Center", MARGIN, PAGE_HEIGHT - 8);
  }

  return doc.output("blob");
}

export async function shareInvoicePdf(data: InvoicePdfData, customerPhone?: string | null) {
  const blob = buildInvoicePdf(data);
  const fileName = invoicePdfFileName(data);
  const file = new File([blob], fileName, { type: "application/pdf" });

  const sharePayload = {
    files: [file],
    title: `Invoice ${data.invoiceNumber}`,
    text: `Invoice ${data.invoiceNumber} - ${data.customerName}. Total ${rupiah(data.total)}.`,
  };

  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(sharePayload);
      return { shared: true as const, fileName };
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return { shared: false as const, fileName, cancelled: true };
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);

  const digits = (customerPhone ?? "").replace(/\D/g, "");
  const waNumber = digits.startsWith("62") ? digits : digits.startsWith("0") ? `62${digits.slice(1)}` : "";
  if (waNumber) window.open(`https://wa.me/${waNumber}`, "_blank", "noopener");
  return { shared: false as const, fileName, cancelled: false };
}

export function downloadInvoicePdf(data: InvoicePdfData) {
  const blob = buildInvoicePdf(data);
  const fileName = invoicePdfFileName(data);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return fileName;
}
