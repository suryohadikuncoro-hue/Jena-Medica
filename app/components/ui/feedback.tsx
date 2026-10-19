import type { ReactNode } from "react";
import { cn } from "./cn";
import type { Tone } from "./status";

/** Banner aksi: kuning = perlu tinjauan, pink = ada masalah, mint = aman. Kalimat pertama sebaiknya tebal (<b>). */
export function ActionBanner({ tone = "yellow", action, children, className }: { tone?: Exclude<Tone, "gray">; action?: ReactNode; children: ReactNode; className?: string }) {
  return <div className={cn("ui-banner", `ui-tone-${tone}`, className)} role="status"><div className="ui-banner-text">{children}</div>{action}</div>;
}
