import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "mint" | "yellow" | "pink" | "gray";

/** Pemetaan status dokumen ke warna pil (UI_UX_GUIDELINES.md bagian 5). */
const statusTones: Record<string, Tone> = {
  "terkonfirmasi": "mint",
  "dibalas": "mint",
  "dicatat": "mint",
  "lunas": "mint",
  "selesai": "mint",
  "terbit": "yellow",
  "menunggu balasan": "yellow",
  "dibayar sebagian": "pink",
  "draf · ada selisih": "pink",
  "draf": "gray",
  "dibatalkan": "gray",
};

export function statusTone(status: string): Tone {
  return statusTones[status.trim().toLowerCase()] ?? "gray";
}

export function StatusBadge({ children, tone, status, className }: { children?: ReactNode; tone?: Tone; status?: string; className?: string }) {
  const resolved = tone ?? (status ? statusTone(status) : "gray");
  return <span className={cn("ui-badge", `ui-tone-${resolved}`, className)}>{children ?? status}</span>;
}
