import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SETTINGS,
  DEFAULT_THEME,
  diffFromDefaults,
  mergeOverDefaults,
  resolveSettings,
  settingsFormSchema,
  themeSchema,
} from "./schema";

describe("mergeOverDefaults", () => {
  it("returns defaults for empty or non-object input", () => {
    for (const stored of [{}, null, undefined, "x", 42, []]) {
      expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, stored)).toEqual(DEFAULT_THEME);
    }
  });

  it("applies valid stored fields over defaults", () => {
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { mode: "dark", preset: "blue" })).toEqual({
      ...DEFAULT_THEME,
      mode: "dark",
      preset: "blue",
    });
  });

  it("drops only the invalid fields and keeps the rest", () => {
    const merged = mergeOverDefaults(themeSchema, DEFAULT_THEME, {
      mode: "dark",
      preset: "neon",
      accent: "not-a-colour",
      density: "compact",
    });
    expect(merged).toEqual({ ...DEFAULT_THEME, mode: "dark", density: "compact" });
  });

  it("defaults motion to full for rows saved before the setting existed, and keeps a stored choice", () => {
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { mode: "dark" }).motion).toBe("full");
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { motion: "subtle" }).motion).toBe("subtle");
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { motion: "wild" }).motion).toBe("full");
  });

  it("defaults theme effects to balanced for older rows, and keeps a stored choice", () => {
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { pack: "cyberpunk" }).effects).toBe("balanced");
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { effects: "immersive" }).effects).toBe("immersive");
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { effects: "max" }).effects).toBe("balanced");
  });

  it("falls back to the default pack when a stored pack no longer exists, keeping the rest", () => {
    const merged = mergeOverDefaults(themeSchema, DEFAULT_THEME, { pack: "removed-pack", mode: "dark" });
    expect(merged).toEqual({ ...DEFAULT_THEME, mode: "dark" });
  });

  it("ignores unknown keys", () => {
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { removedSetting: true })).toEqual(DEFAULT_THEME);
  });

  it("normalises accent colours", () => {
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, { accent: "#AABBCC" }).accent).toBe("#aabbcc");
  });
});

describe("diffFromDefaults", () => {
  it("stores nothing when everything is default", () => {
    expect(diffFromDefaults(DEFAULT_THEME, DEFAULT_THEME)).toEqual({});
  });

  it("stores only changed fields", () => {
    expect(diffFromDefaults({ ...DEFAULT_PREFERENCES, timeFormat: "12h" }, DEFAULT_PREFERENCES)).toEqual({
      timeFormat: "12h",
    });
  });

  it("round-trips through mergeOverDefaults", () => {
    const theme = { ...DEFAULT_THEME, mode: "light", accent: "#123456" } as const;
    const stored = diffFromDefaults(theme, DEFAULT_THEME);
    expect(mergeOverDefaults(themeSchema, DEFAULT_THEME, stored)).toEqual(theme);
  });
});

describe("resolveSettings", () => {
  it("falls back to defaults when there is no row", () => {
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("merges both groups", () => {
    expect(resolveSettings({ version: 1, theme: { mode: "dark" }, preferences: { weekStart: "sunday" } })).toEqual({
      theme: { ...DEFAULT_THEME, mode: "dark" },
      preferences: { ...DEFAULT_PREFERENCES, weekStart: "sunday" },
    });
  });
});

describe("settingsFormSchema", () => {
  const valid = { theme: { ...DEFAULT_THEME }, preferences: { ...DEFAULT_PREFERENCES } };

  it("treats a blank accent as no accent", () => {
    const parsed = settingsFormSchema.parse({ ...valid, theme: { ...valid.theme, accent: "" } });
    expect(parsed.theme.accent).toBeNull();
  });

  it("rejects values outside the allowed lists", () => {
    expect(settingsFormSchema.safeParse({ ...valid, theme: { ...valid.theme, mode: "sepia" } }).success).toBe(false);
    expect(
      settingsFormSchema.safeParse({ ...valid, preferences: { ...valid.preferences, language: "fr" } }).success,
    ).toBe(false);
  });
});

describe("timeZone preference", () => {
  it("defaults to Asia/Makassar and keeps a valid saved zone", () => {
    expect(DEFAULT_PREFERENCES.timeZone).toBe("Asia/Makassar");
    expect(
      resolveSettings({ version: 1, theme: {}, preferences: { timeZone: "Asia/Jakarta" } }).preferences.timeZone,
    ).toBe("Asia/Jakarta");
  });

  it("falls back to the default for an unknown zone", () => {
    expect(
      resolveSettings({ version: 1, theme: {}, preferences: { timeZone: "Mars/Olympus" } }).preferences.timeZone,
    ).toBe("Asia/Makassar");
  });
});

describe("profileFormSchema", () => {
  it("trims and collapses spaces", async () => {
    const { profileFormSchema } = await import("./schema");
    expect(profileFormSchema.parse({ displayName: "  Arif   G  " })).toEqual({ displayName: "Arif G" });
  });
  it("turns blank into null (clears the name)", async () => {
    const { profileFormSchema } = await import("./schema");
    expect(profileFormSchema.parse({ displayName: "   " })).toEqual({ displayName: null });
  });
  it("rejects names over 80 characters and control characters", async () => {
    const { profileFormSchema } = await import("./schema");
    expect(profileFormSchema.safeParse({ displayName: "a".repeat(81) }).success).toBe(false);
    expect(profileFormSchema.safeParse({ displayName: "a\u0007b" }).success).toBe(false);
  });
});
