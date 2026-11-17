import { describe, expect, it } from "vitest";
import { readableTextOn, relativeLuminance, toOklch } from "@/lib/color";
import type { ThemeManifest } from "../themes/manifest";
import { defaultTheme } from "../themes/packs/default/manifest";
import { DEFAULT_THEME } from "./schema";
import { accentTokens, chromeColors, themeAttributes } from "./theme";

describe("themeAttributes", () => {
  it("maps the theme to data attributes with no inline overrides by default", () => {
    expect(themeAttributes(DEFAULT_THEME)).toEqual({
      "data-theme": "default",
      "data-mode": "system",
      "data-preset": "green",
      "data-font": "geist",
      "data-density": "comfortable",
      "data-motion": "full",
      "data-effects": "balanced",
      style: {},
    });
  });

  it("overrides primary, ring and foreground for a custom accent, per mode", () => {
    const { style } = themeAttributes({ ...DEFAULT_THEME, accent: "#ffd43b" });
    expect(style).toMatchObject({
      "--primary-foreground": "light-dark(oklch(0.985 0 0), oklch(0.2 0 0))",
      "--hue": "92",
    });
    expect(style["--ring" as keyof typeof style]).toBe(style["--primary" as keyof typeof style]);
  });

  it("keeps a dark accent visible in dark mode and a light one readable in light mode", () => {
    const lightness = (accent: string) => {
      const value = accentTokens(accent)["--primary"];
      const [light, dark] = [...value.matchAll(/oklch\(([\d.]+)/g)].map((m) => Number(m[1]));
      return { light, dark };
    };
    // A navy accent: as-is it vanishes on dark surfaces.
    expect(lightness("#1d3a4a").dark).toBeGreaterThanOrEqual(0.72);
    expect(lightness("#1d3a4a").light).toBeGreaterThanOrEqual(0.42);
    // A yellow accent: as-is white text on it is unreadable in light mode.
    expect(lightness("#ffd43b").light).toBeLessThanOrEqual(0.56);
    expect(lightness("#ffd43b").dark).toBeLessThanOrEqual(0.86);
  });

  it("keeps the preset hue for a near-grey accent", () => {
    const { style } = themeAttributes({ ...DEFAULT_THEME, accent: "#808080" });
    expect(style).not.toHaveProperty("--hue");
  });

  it("lets a dark-only, custom-palette pack lock the mode and ignore the accent", () => {
    const pack: ThemeManifest = { ...defaultTheme, id: "night", scheme: "dark", palette: "custom" };
    const attrs = themeAttributes({ ...DEFAULT_THEME, mode: "light", accent: "#ffd43b" }, pack);
    expect(attrs["data-theme"]).toBe("night");
    expect(attrs["data-mode"]).toBe("dark");
    expect(attrs.style).toEqual({});
  });

  it("falls back to the default pack for an unknown one", () => {
    expect(themeAttributes({ ...DEFAULT_THEME, pack: "gone" as never })["data-theme"]).toBe("default");
  });

  it("passes the motion preference through", () => {
    expect(themeAttributes({ ...DEFAULT_THEME, motion: "off" })["data-motion"]).toBe("off");
  });
});

describe("chromeColors", () => {
  it("follows the OS for system mode and picks one colour for a fixed mode", () => {
    expect(chromeColors(DEFAULT_THEME)).toHaveLength(2);
    expect(chromeColors({ ...DEFAULT_THEME, mode: "dark" })).toEqual([{ color: "#0f1a14" }]);
  });
});

describe("toOklch", () => {
  it("matches reference OKLCH values", () => {
    const red = toOklch("#ff0000");
    expect(red.l).toBeCloseTo(0.628, 2);
    expect(red.c).toBeCloseTo(0.258, 2);
    expect(red.h).toBeCloseTo(29.2, 0);
    expect(toOklch("#0000ff").h).toBeCloseTo(264.1, 0);
    expect(toOklch("#ffffff").c).toBeLessThan(0.001);
  });
});

describe("readableTextOn", () => {
  it("uses dark text on light colours and light text on dark ones", () => {
    expect(readableTextOn("#ffffff")).toBe("oklch(0.2 0 0)");
    expect(readableTextOn("#ffd43b")).toBe("oklch(0.2 0 0)");
    expect(readableTextOn("#000000")).toBe("oklch(0.985 0 0)");
    expect(readableTextOn("#1b5e20")).toBe("oklch(0.985 0 0)");
    // Mid green: black (4.8:1) narrowly beats white (4.4:1).
    expect(readableTextOn("#2b8a3e")).toBe("oklch(0.2 0 0)");
  });

  it("computes WCAG luminance at the extremes", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1);
  });
});
