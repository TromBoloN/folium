import { readableTextOn, toOklch } from "@/lib/color";
import type { Theme } from "./schema";

/**
 * The attributes the root layout puts on <html> so the server-rendered page
 * already has the user's theme. globals.css reads these.
 */
export function themeAttributes(theme: Theme) {
  const style: Record<string, string> = {};
  if (theme.accent) {
    style["--primary"] = theme.accent;
    style["--ring"] = theme.accent;
    style["--primary-foreground"] = readableTextOn(theme.accent);
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

export const PRESET_LABELS: Record<Theme["preset"], string> = {
  green: "Green",
  blue: "Blue",
  violet: "Violet",
  orange: "Orange",
  rose: "Rose",
};
