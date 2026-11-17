import { Rajdhani, Share_Tech_Mono } from "next/font/google";

/**
 * Fonts that theme packs use for headlines (and, rarely, body text).
 *
 * next/font needs every font declared at module level, so they all live here.
 * Each one is `preload: false` with a CSS variable: the browser only downloads
 * a face when a pack's CSS actually uses it (e.g.
 * `[data-theme="cyberpunk"] { --font-display-stack: var(--font-rajdhani), ui-sans-serif, sans-serif; }`),
 * so users of other packs pay nothing.
 *
 * Adding one:
 *   import { Orbitron } from "next/font/google";
 *   const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], display: "swap", preload: false });
 *   export const THEME_FONT_VARIABLES = [orbitron.variable];
 */

/** Night City (cyberpunk): narrow technical headlines. */
const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
/** Night City (cyberpunk): readouts, labels and codes. */
const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const THEME_FONT_VARIABLES: string[] = [rajdhani.variable, shareTechMono.variable];
