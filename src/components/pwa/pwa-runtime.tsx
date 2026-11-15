"use client";

import { useEffect } from "react";

/** The browser's install prompt, kept so Settings can offer "Install Folium" later. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

export function getInstallPrompt() {
  return deferred;
}
export function onInstallPromptChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function clearInstallPrompt() {
  deferred = null;
  for (const l of listeners) l();
}

/** Registers the service worker (production only) and catches the install prompt. Renders nothing. */
export function PwaRuntime() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallPrompt;
      for (const l of listeners) l();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);
  return null;
}
