import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, themeSchema } from "../settings/schema";
import { lintPackCss, lintPalette, resolveLiteral } from "./lint";
import type { ThemeManifest } from "./manifest";
import { getManifest, THEME_PACK_IDS, THEMES } from "./registry";

const PACKS_DIR = join(process.cwd(), "src/features/themes/packs");
/** Pack folders on disk; folders starting with "_" (the template) aren't packs. */
const folders = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);
const css = (id: string) => readFileSync(join(PACKS_DIR, id, "theme.css"), "utf8");
/** Cap on a pack's always-loaded stylesheet, gzipped, as users download it (docs/themes.md, section 11). */
const MAX_THEME_CSS_GZIP_BYTES = 6 * 1024;

describe("theme registry", () => {
  it("has unique ids, a default pack, and one folder per registered pack", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("default");
    expect([...folders].sort()).toEqual([...ids].sort());
  });

  it("keeps the setting's allowed values in step with the registry", () => {
    expect(themeSchema.shape.pack.options).toEqual(THEME_PACK_IDS);
    expect(DEFAULT_THEME.pack).toBe("default");
  });

  it("imports every pack's stylesheet once, in registry order", () => {
    const index = readFileSync(join(PACKS_DIR, "index.css"), "utf8");
    const imported = [...index.matchAll(/@import\s+"\.\/([\w-]+)\/theme\.css"/g)].map((m) => m[1]);
    expect(imported).toEqual(THEMES.map((t) => t.id));
  });

  it("gives an unknown id the default pack", () => {
    expect(getManifest("removed-pack").id).toBe("default");
  });
});

describe.each(THEMES.map((t) => [t.id, t as ThemeManifest] as const))("pack %s", (id, manifest) => {
  it("has a lowercase id, a stylesheet, and chrome and preview colours", () => {
    expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(existsSync(join(PACKS_DIR, id, "theme.css"))).toBe(true);
    for (const color of [...Object.values(manifest.chrome), ...Object.values(manifest.preview)]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("follows the CSS rules (scoped selectors, prefixed keyframes, transform/opacity only, colours in tokens)", () => {
    expect(lintPackCss(id, css(id))).toEqual([]);
  });

  it("follows the same rules in its lazy effects stylesheet, if it has one", () => {
    const file = join(PACKS_DIR, id, "effects.css");
    if (existsSync(file)) expect(lintPackCss(id, readFileSync(file, "utf8"))).toEqual([]);
  });

  it("keeps theme.css small, since it ships to every user (heavy CSS goes in effects.css)", () => {
    expect(gzipSync(css(id)).byteLength).toBeLessThanOrEqual(MAX_THEME_CSS_GZIP_BYTES);
  });

  it("has a readable palette", () => {
    expect(lintPalette(manifest, css(id))).toEqual([]);
  });

  it("declares effects exactly when it ships an effects file", () => {
    expect(Boolean(manifest.effects)).toBe(existsSync(join(PACKS_DIR, id, "effects.tsx")));
  });
});

describe("the pack linter", () => {
  it("catches unscoped selectors, colour literals, bad keyframes", () => {
    const issues = lintPackCss(
      "neon",
      `
      .tile { border-color: #ff00aa; }
      [data-theme="neon"] .tile { color: white; box-shadow: 0 0 8px var(--glow); }
      @media (min-width: 48rem) { body { opacity: 1; } }
      @keyframes flicker { from { opacity: 0; } }
      @keyframes neon-pulse { from { box-shadow: 0 0 4px var(--glow); } }
    `,
    ).map((i) => i.rule);
    expect(issues).toEqual(["scope", "colour", "colour", "scope", "keyframes-name", "keyframes-property"]);
  });

  it("accepts a well-formed pack", () => {
    const sample = `
      [data-theme="neon"] { --surface-1: oklch(0.2 0.03 300); --glow: oklch(0.8 0.2 330 / 0.6); }
      [data-theme="neon"] .tile::before { background: var(--glow); mask: url("data:image/svg+xml,%23fff"); }
      [data-theme="neon"] .tile { &:hover { opacity: 0.9; } }
      @media (hover: hover) { [data-theme="neon"] .tile:hover { transform: translateY(-1px); } }
      @keyframes neon-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; transform: scale(1.02); } }
    `;
    expect(lintPackCss("neon", sample)).toEqual([]);
  });

  it("keeps layout out of packs: real elements can't be resized or moved, pseudo-elements can", () => {
    const rules = (sample: string) => lintPackCss("neon", sample).map((i) => i.rule);
    expect(rules(`[data-theme="neon"] .tile { padding: 2rem; }`)).toEqual(["layout"]);
    expect(rules(`[data-theme="neon"] [data-slot="page-header"] h1 { font-size: 3rem; display: none; }`)).toEqual([
      "layout",
      "layout",
    ]);
    // One real element in a selector list is enough to count.
    expect(rules(`[data-theme="neon"] .tile::before, [data-theme="neon"] .panel { inset: 0; }`)).toEqual(["layout"]);
    expect(rules(`[data-theme="neon"] .tile { &:hover { width: 10px; } }`)).toEqual(["layout"]);
    // Another pack's prefix isn't this pack's own element.
    expect(rules(`[data-theme="neon"] .other-spark { left: 0; }`)).toEqual(["layout"]);
    // Decoration layers are the pack's own.
    expect(
      rules(`
        [data-theme="neon"] .tile::before { position: absolute; inset: 0; width: 2rem; font-size: 10px; }
        [data-theme="neon"] .tile { &::after { top: 0; } }
        [data-theme="neon"]::view-transition-new(*.page-in) { height: 100%; }
        [data-theme="neon"] .neon-spark { position: absolute; left: 10%; width: 2px; }
      `),
    ).toEqual([]);
    // A reviewed exception.
    expect(rules(`[data-theme="neon"] .tile { order: 1 /* layout-ok: test */; }`)).toEqual([]);
  });

  it("resolves literal oklch and light-dark values, and nothing else", () => {
    expect(resolveLiteral("oklch(1 0 0)")).toEqual({ light: "#ffffff", dark: "#ffffff" });
    expect(resolveLiteral("light-dark(oklch(100% 0 0), oklch(0 0 0))")).toEqual({ light: "#ffffff", dark: "#000000" });
    expect(resolveLiteral("var(--x)")).toBeNull();
  });

  it("checks contrast for custom palettes in the schemes the pack supports", () => {
    const manifest = { ...THEMES[0], id: "neon", palette: "custom", scheme: "dark" } as ThemeManifest;
    const tokens = (muted: string) => `[data-theme="neon"] {
      --surface-0: oklch(0.15 0.02 300); --surface-1: oklch(0.2 0.03 300); --surface-2: oklch(0.25 0.03 300);
      --foreground: oklch(0.95 0.02 300); --muted-foreground: ${muted};
      --primary: oklch(0.8 0.2 330); --primary-foreground: oklch(0.15 0.02 300);
      --border: oklch(0.35 0.05 300); --ring: oklch(0.8 0.2 330);
    }`;
    expect(lintPalette(manifest, tokens("oklch(0.75 0.03 300)"))).toEqual([]);
    expect(lintPalette(manifest, tokens("oklch(0.35 0.03 300)")).map((i) => i.rule)).toEqual(["contrast"]);
    expect(lintPalette(manifest, tokens("var(--x)")).map((i) => i.rule)).toEqual(["palette"]);
  });
});
