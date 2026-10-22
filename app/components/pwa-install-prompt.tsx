"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let registerOnLoad: (() => void) | null = null;
    if ("serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      if (document.readyState === "complete") void register();
      else {
        registerOnLoad = register;
        window.addEventListener("load", register, { once: true });
      }
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowIosHelp(false);
      setShowAndroidHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const initialStateFrame = window.requestAnimationFrame(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone) setInstalled(true);

      const userAgent = navigator.userAgent;
      const isIos = /iphone|ipad|ipod/i.test(userAgent);
      const isAndroidChrome = /android/i.test(userAgent) && /chrome/i.test(userAgent) && !/edg|opr|samsungbrowser/i.test(userAgent);
      if (isIos && !standalone) setShowIosHelp(true);
      if (isAndroidChrome && !standalone) setShowAndroidHelp(true);
    });

    return () => {
      window.cancelAnimationFrame(initialStateFrame);
      if (registerOnLoad) window.removeEventListener("load", registerOnLoad);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent || busy) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
    } finally { setBusy(false); }
  }

  if (installed) return null;
  if (!installEvent && !showIosHelp && !showAndroidHelp) return null;

  const instructions = installEvent
    ? "Pasang Jena Medica di perangkat ini untuk akses lebih praktis."
    : showIosHelp
      ? "Untuk memasang di iPhone/iPad: ketuk Bagikan, lalu Tambahkan ke Layar Utama."
      : "Belum muncul tombol Pasang? Buka menu Chrome ⋮ lalu pilih Tambahkan ke layar utama.";

  return <aside className="pwa-install-card" aria-label="Instal Jena Medica">
    <span className="pwa-install-mark" aria-hidden="true">J+</span>
    <span className="pwa-install-copy"><strong>Jena Medica</strong><small>{instructions}</small></span>
    {installEvent
      ? <button type="button" className="pwa-install-button" onClick={() => void install()} disabled={busy}>{busy ? "Memproses…" : "Pasang"}</button>
      : <button type="button" className="pwa-install-close" onClick={() => { setShowIosHelp(false); setShowAndroidHelp(false); }} aria-label="Tutup petunjuk">×</button>}
  </aside>;
}
