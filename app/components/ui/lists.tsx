import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { StatusBadge, type Tone } from "./status";

function Chevron() {
  return <svg className="ui-icon ui-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>;
}

type RowProps = {
  icon: ReactNode;
  tone?: Tone | "shell";
  title: string;
  subtitle?: string;
  /** Nilai di kanan (mis. nominal). */
  value?: string;
  badge?: { label: string; tone?: Tone };
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/** Baris daftar: ikon bulat, "nomor · nama", keterangan langkah berikutnya, nilai dan pil status. */
export function ListRow({ icon, tone = "gray", title, subtitle, value, badge, chevron, href, onClick, className }: RowProps) {
  const content = <>
    <span className={cn("ui-row-icon", tone === "shell" ? "ui-bg-shell" : `ui-tone-${tone}`)}>{icon}</span>
    <span className="ui-row-text"><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</span>
    {value || badge ? <span className="ui-row-end">{value ? <strong>{value}</strong> : null}{badge ? <StatusBadge tone={badge.tone ?? "gray"}>{badge.label}</StatusBadge> : null}</span> : null}
    {chevron ? <Chevron /> : null}
  </>;
  const cls = cn("ui-row", (href || onClick) && "ui-row-action", className);
  if (href) return <Link href={href} className={cls}>{content}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{content}</button>;
  return <div className={cls}>{content}</div>;
}

export function ListStack({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-list", className)} {...props}>{children}</div>;
}

/** Baris riwayat transaksi: masuk (+, hijau) atau keluar (-, merah). */
export function TransactionRow({ title, detail, amount, direction }: { title: string; detail: string; amount: string; direction: "in" | "out" }) {
  const incoming = direction === "in";
  return <div className="ui-txn">
    <span className={cn("ui-row-icon", incoming ? "ui-tone-mint" : "ui-tone-pink")}><svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{incoming ? <path d="M12 5v14M6 13l6 6 6-6" /> : <path d="M12 19V5M6 11l6-6 6 6" />}</svg></span>
    <span className="ui-row-text"><strong>{title}</strong><small>{detail}</small></span>
    <strong className={incoming ? "ui-amount-in" : "ui-amount-out"}>{incoming ? "+" : "−"}{amount}</strong>
  </div>;
}

/** Kartu ringkas: label kecil, angka besar, satuan teal gelap. */
export function StatCard({ label, value, unit, note, href }: { label: string; value: string; unit?: string; note?: string; href?: string }) {
  const body = <><div className="ui-stat-label">{label}</div><div className="ui-stat-value">{value}{unit ? <span className="ui-stat-unit"> {unit}</span> : null}</div>{note ? <div className="ui-stat-note">{note}</div> : null}</>;
  return href ? <Link href={href} className="ui-card ui-stat">{body}</Link> : <div className="ui-card ui-stat">{body}</div>;
}
