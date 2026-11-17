"use client";

import { type ComponentType, useEffect, useState } from "react";
import type { ThemeEffectProps } from "./manifest";
import { getManifest } from "./registry";

type Env = { pack: string; motion: string; effects: string; reduced: boolean; saveData: boolean; mobile: boolean };

function readEnv(): Env {
  const root = document.documentElement;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    pack: root.dataset.theme ?? "default",
    motion: root.dataset.motion ?? "full",
    effects: root.dataset.effects ?? "balanced",
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: Boolean(connection?.saveData) || window.matchMedia("(prefers-reduced-data: reduce)").matches,
    mobile: window.matchMedia("(max-width: 47.99rem)").matches,
  };
}

/**
 * The optional animated layer of the current theme pack, inside `.ambient`.
 * Follows <html data-theme / data-motion> live (Settings and the theme preview
 * change them without a reload) and loads a pack's effects code only when that
 * pack is in use. Renders nothing when motion is off, the device asks for
 * reduced motion or saves data, or the pack has no effects. Pausing while the
 * tab is hidden is CSS (`.loop`), so effects should animate with keyframes.
 */
export function ThemeEffects() {
  const [env, setEnv] = useState<Env | null>(null);
  const [Effect, setEffect] = useState<{ pack: string; component: ComponentType<ThemeEffectProps> } | null>(null);

  useEffect(() => {
    const update = () => setEnv(readEnv());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-motion", "data-effects"],
    });
    const queries = ["(prefers-reduced-motion: reduce)", "(prefers-reduced-data: reduce)", "(max-width: 47.99rem)"].map(
      (q) => window.matchMedia(q),
    );
    for (const q of queries) q.addEventListener("change", update);
    return () => {
      observer.disconnect();
      for (const q of queries) q.removeEventListener("change", update);
    };
  }, []);

  const enabled = env !== null && env.motion !== "off" && env.effects !== "minimal" && !env.reduced && !env.saveData;
  const load = enabled ? getManifest(env.pack).effects : undefined;
  const pack = env?.pack;

  useEffect(() => {
    if (!load || !pack) return;
    let cancelled = false;
    load()
      .then((mod) => {
        if (!cancelled) setEffect({ pack, component: mod.default });
      })
      .catch((error) => console.error("[themes] effects failed to load", pack, error));
    return () => {
      cancelled = true;
    };
  }, [load, pack]);

  if (!enabled || !Effect || Effect.pack !== pack) return null;
  const Component = Effect.component;
  return (
    <div data-slot="theme-effects" className="absolute inset-0">
      <Component
        mobile={env.mobile}
        subtle={env.motion === "subtle"}
        intensity={env.effects === "immersive" ? "immersive" : "balanced"}
      />
    </div>
  );
}
