"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export type SegmentItem<T extends string> = { value: T; label: string; badge?: ReactNode };

/** Tab segmen (pil gelap untuk yang aktif). Memakai `aria-pressed`; hubungkan ke URL di sisi pemanggil bila perlu. */
export function SegmentedTabs<T extends string>({ items, value, onChange, label, className }: { items: SegmentItem<T>[]; value: T; onChange: (value: T) => void; label: string; className?: string }) {
  return <div className={cn("ui-seg", className)} role="group" aria-label={label}>{items.map(item => <button key={item.value} type="button" aria-pressed={value === item.value} className="ui-seg-item" onClick={() => onChange(item.value)}>{item.label}{item.badge ? <span className="ui-seg-badge">{item.badge}</span> : null}</button>)}</div>;
}
