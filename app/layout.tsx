import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "./components/app-shell";
import { PwaInstallPrompt } from "./components/pwa-install-prompt";

const appSans = Plus_Jakarta_Sans({ variable: "--font-app-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Jena Medical Center | Business Suite",
  description: "Pengelolaan transaksi distribusi medis drop-ship Jena Medical Center.",
  applicationName: "Jena Medica",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Jena Medica" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1b1c21",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="id" className={`${appSans.variable} h-full antialiased`}><body className="min-h-full"><AppShell>{children}</AppShell><PwaInstallPrompt /></body></html>;
}
