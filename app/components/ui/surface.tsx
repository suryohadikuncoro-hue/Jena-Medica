import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLDivElement> & { tone?: "default" | "dark" };

/** Kartu utama (latar `--card`). `tone="dark"` dipakai untuk kartu total/saldo. */
export function Card({ tone = "default", className, ...props }: CardProps) {
  return <div className={cn("ui-card", tone === "dark" && "ui-card-dark", className)} {...props} />;
}

/** Panel putih di dalam kartu. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-panel", className)} {...props} />;
}

/** Kartu total gelap: label kecil, angka besar, keterangan opsional. */
export function TotalCard({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return <Card tone="dark"><div className="ui-total-label">{label}</div><div className="ui-total-value">{value}</div>{note ? <div className="ui-total-note">{note}</div> : null}</Card>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <Card className="ui-empty">{icon ? <span className="ui-empty-icon">{icon}</span> : null}<div className="ui-empty-title">{title}</div>{description ? <p className="ui-empty-text">{description}</p> : null}{action}</Card>;
}

/** Baris kerangka untuk keadaan memuat. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return <div className="ui-list" aria-busy="true" aria-label="Memuat data">{Array.from({ length: count }, (_, i) => <div key={i} className="ui-row"><span className="ui-skeleton ui-skeleton-circle" /><span className="ui-skeleton-lines"><span className="ui-skeleton ui-skeleton-line" style={{ width: "70%" }} /><span className="ui-skeleton ui-skeleton-line" style={{ width: "45%" }} /></span></div>)}</div>;
}
