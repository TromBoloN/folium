import type { ThemeManifest } from "./manifest";
import { defaultTheme } from "./packs/default/manifest";

/**
 * Every theme pack Folium knows. Adding a pack: its manifest here, its
 * `theme.css` in packs/index.css, its name in src/lib/i18n/id/themes.ts.
 * The ids also define the `theme.pack` setting (src/features/settings/schema.ts).
 * Full guide: docs/themes.md.
 */
export const THEMES = [defaultTheme] as const satisfies readonly ThemeManifest[];

export type ThemePackId = (typeof THEMES)[number]["id"];

export const THEME_PACK_IDS = THEMES.map((t) => t.id) as [ThemePackId, ...ThemePackId[]];

export const DEFAULT_PACK: ThemePackId = "default";

/** The pack's manifest; an unknown id (a pack that was removed) gets the default. */
export function getManifest(id: string): ThemeManifest {
  return THEMES.find((t) => t.id === id) ?? defaultTheme;
}

/** Packs to show: drafts only in development. */
export function visibleThemes(dev = process.env.NODE_ENV !== "production"): readonly ThemeManifest[] {
  return THEMES.filter((t: ThemeManifest) => dev || t.status === "ready");
}
