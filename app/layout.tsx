import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "./components/app-shell";

const appSans = Plus_Jakarta_Sans({ variable: "--font-app-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Jena Medical Center | Business Suite",
  description: "Pengelolaan transaksi distribusi medis drop-ship Jena Medical Center.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="id" className={`${appSans.variable} h-full antialiased`}><body className="min-h-full"><AppShell>{children}</AppShell></body></html>;
}
