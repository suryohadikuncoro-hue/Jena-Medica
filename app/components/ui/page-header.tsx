import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge, type Tone } from "./status";

/** Kepala halaman. Halaman daftar: judul + keterangan + aksi di kanan. Halaman detail: tautan kembali + jejak + pil status. */
export function PageHeader({ title, subtitle, actions, back, crumb, badge }: { title: string; subtitle?: string; actions?: ReactNode; back?: { href: string; label: string }; crumb?: string; badge?: { label: string; tone?: Tone } }) {
  return <header className="ui-page-header">
    {back ? <Link href={back.href} aria-label={back.label} className="ui-back"><svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></Link> : null}
    <div className="ui-page-header-text">{crumb ? <div className="ui-crumb">{crumb}</div> : null}<h1 className="ui-page-title">{title}</h1>{badge ? <StatusBadge tone={badge.tone ?? "gray"}>{badge.label}</StatusBadge> : null}{subtitle ? <p className="ui-page-subtitle">{subtitle}</p> : null}</div>
    {actions ? <div className="ui-page-actions">{actions}</div> : null}
  </header>;
}
