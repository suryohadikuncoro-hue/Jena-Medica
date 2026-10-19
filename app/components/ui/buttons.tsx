import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "./cn";

type Variant = "solid" | "outline" | "danger" | "danger-solid";
type Size = "md" | "sm";

function classes(variant: Variant, size: Size, className?: string) {
  return cn("ui-btn", `ui-btn-${variant}`, size === "sm" && "ui-btn-sm", className);
}

/** Tombol. `solid` hanya untuk aksi utama; aksi sekunder `outline`; aksi destruktif `danger`. */
export function Button({ variant = "outline", size = "md", className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={classes(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "outline", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={classes(variant, size, className)} {...props} />;
}

/** Tombol bulat 48 px untuk aksi membuat dokumen baru ("+"). */
export function RoundAddLink({ href, label, ...props }: Omit<ComponentProps<typeof Link>, "children" | "aria-label"> & { label: string }) {
  return <Link href={href} aria-label={label} className="ui-round-add" {...props}><svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></Link>;
}
