import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppShell } from "./components/app-shell";

const geistSans = Geist({ variable: "--font-app-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jena Medical Center | Business Suite",
  description: "Pengelolaan transaksi distribusi medis drop-ship Jena Medical Center.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="id" className={`${geistSans.variable} h-full antialiased`}><body className="min-h-full"><AppShell>{children}</AppShell></body></html>;
}
