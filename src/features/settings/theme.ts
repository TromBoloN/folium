import { toOklch } from "@/lib/color";
import type { Theme } from "./schema";

/**
 * The attributes the root layout puts on <html> so the server-rendered page
 * already has the user's theme. globals.css reads these.
 */
export function themeAttributes(theme: Theme) {
  const style: Record<string, string> = {};
  if (theme.accent) {
    Object.assign(style, accentTokens(theme.accent));
    // Tint the neutrals and the ambient glow towards the accent too. A near-grey
    // accent has no meaningful hue, so it keeps the preset's.
    const { c, h } = toOklch(theme.accent);
    if (c >= 0.03) style["--hue"] = String(Math.round(h));
  }
  return {
    "data-mode": theme.mode,
    "data-preset": theme.preset,
    "data-font": theme.font,
    "data-density": theme.density,
    "data-motion": theme.motion,
    style: style as React.CSSProperties,
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits = 3) => Number(v.toFixed(digits));

/**
 * A custom accent, made to work in both modes the way the presets do: the same
 * hue, but dark enough to carry white text on light paper (L 0.42–0.56) and
 * bright enough to stand out as the main action on dark surfaces (L 0.72–0.86),
 * where a navy or forest accent taken as-is disappears.
 */
export function accentTokens(accent: string) {
  const { l, c, h } = toOklch(accent);
  const chroma = round(Math.min(c, 0.19));
  const hue = round(h, 1);
  const light = `oklch(${round(clamp(l, 0.42, 0.56))} ${chroma} ${hue})`;
  const dark = `oklch(${round(clamp(l, 0.72, 0.86))} ${chroma} ${hue})`;
  const primary = `light-dark(${light}, ${dark})`;
  return {
    "--primary": primary,
    "--ring": primary,
    "--primary-foreground": "light-dark(oklch(0.985 0 0), oklch(0.2 0 0))",
  };
}

export const PRESET_LABELS: Record<Theme["preset"], string> = {
  green: "Green",
  blue: "Blue",
  violet: "Violet",
  orange: "Orange",
  rose: "Rose",
};
