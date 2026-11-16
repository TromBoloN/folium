import { BRAND } from "@/lib/pwa/brand";
import type { ThemeManifest } from "../../manifest";

/** Folium's own look: warm paper or tinted night, soft rounded tiles, a slow ambient glow. The reference pack. */
export const defaultTheme = {
  id: "default",
  label: "Folium",
  description: "Warm paper by day, tinted night after dark, soft rounded cards.",
  scheme: "both",
  palette: "preset",
  chrome: { light: BRAND.paper, dark: BRAND.night },
  preview: { background: BRAND.paper, surface: "#fbfaf4", primary: BRAND.leaf, highlight: "#c9e8d2" },
  status: "ready",
} as const satisfies ThemeManifest;
