import { readableTextOn } from "@/lib/color";
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
  }
  return {
    "data-mode": theme.mode,
    "data-preset": theme.preset,
    "data-font": theme.font,
    "data-density": theme.density,
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
