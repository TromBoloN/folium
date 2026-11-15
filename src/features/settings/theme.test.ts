import { describe, expect, it } from "vitest";
import { readableTextOn, relativeLuminance } from "@/lib/color";
import { DEFAULT_THEME } from "./schema";
import { themeAttributes } from "./theme";

describe("themeAttributes", () => {
  it("maps the theme to data attributes with no inline overrides by default", () => {
    expect(themeAttributes(DEFAULT_THEME)).toEqual({
      "data-mode": "system",
      "data-preset": "green",
      "data-font": "geist",
      "data-density": "comfortable",
      style: {},
    });
  });

  it("overrides primary, ring and a readable foreground for a custom accent", () => {
    const { style } = themeAttributes({ ...DEFAULT_THEME, accent: "#ffd43b" });
    expect(style).toEqual({
      "--primary": "#ffd43b",
      "--ring": "#ffd43b",
      "--primary-foreground": "oklch(0.2 0 0)",
    });
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
