import type { ThemeManifest } from "../../manifest";

/**
 * Night City: a Cyberpunk 2077-inspired HUD. Signature yellow for what matters now,
 * cyan for secondary readouts, red for danger, over a rain-soaked skyline.
 * Personal-use homage; see docs/themes.md for the rules it follows.
 */
export const cyberpunkTheme = {
  id: "cyberpunk",
  label: "Night City",
  description:
    "A Cyberpunk 2077 HUD: signature yellow, cyan readouts, sharp cut corners and a neon skyline in the rain.",
  scheme: "dark",
  palette: "custom",
  chrome: { light: "#040811", dark: "#040811" },
  preview: { background: "#040811", surface: "#09111c", primary: "#fbee00", highlight: "#00ddef" },
  effects: () => import("./effects"),
  status: "draft",
} as const satisfies ThemeManifest;
