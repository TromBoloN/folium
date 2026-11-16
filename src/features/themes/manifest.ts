import type { ComponentType } from "react";
import type { MessageKey } from "@/lib/i18n/core";

/**
 * What a theme pack declares about itself. The look lives in the pack's
 * `theme.css`; this is everything the app needs to know *around* the CSS:
 * names, whether it forces dark mode, browser chrome colours, effects.
 * Authoring guide: docs/themes.md.
 */
export type ThemeManifest = {
  /** Folder name and `data-theme` value. Lowercase, a–z and dashes. */
  id: string;
  /** English name; also the translation key (add it to src/lib/i18n/id/settings.ts). */
  label: MessageKey;
  description: MessageKey;
  /**
   * Which colour schemes the pack supports. "dark" or "light" locks the app to it
   * (`data-mode` is forced and the mode picker is ignored).
   */
  scheme: "both" | "dark" | "light";
  /**
   * "preset": colours come from the user's preset (hue) and custom accent, like today.
   * "custom": the pack sets its own full palette; preset and accent are ignored.
   */
  palette: "preset" | "custom";
  /** Browser UI colour (address bar on phones, PWA title bar). #rrggbb. */
  chrome: { light: string; dark: string };
  /** Small swatches for gallery cards: background, surface, primary, highlight. #rrggbb. */
  preview: { background: string; surface: string; primary: string; highlight: string };
  /** Optional animated layer rendered inside the ambient background, loaded only for this pack. */
  effects?: () => Promise<{ default: ComponentType<ThemeEffectProps> }>;
  /** "draft" packs are listed only in development. */
  status: "ready" | "draft";
};

/** What an effects component receives. It is already off when motion is off, reduced, hidden or saving data. */
export type ThemeEffectProps = {
  /** Phone-sized viewport: draw fewer particles, skip expensive layers. */
  mobile: boolean;
  /** Motion is "subtle": keep things still or near-still (fades only, no travel). */
  subtle: boolean;
};
