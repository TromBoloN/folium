import { z } from "zod";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/dates";
import { DEFAULT_GRADE_SCALE, gradeScaleSchema } from "../grades/scale";

/**
 * Settings are stored as JSON in user_settings, one column per group, holding
 * only the values that differ from the defaults. Reading merges what's stored
 * over the defaults field by field, so:
 *  - adding a setting needs no migration (old rows just get the default),
 *  - one invalid stored value falls back to its default without losing the rest.
 * Bump SETTINGS_VERSION and add a step to `upgrade` only when an existing
 * setting changes meaning or shape.
 */
export const SETTINGS_VERSION = 1;

export const MODES = ["system", "light", "dark"] as const;
export const PRESETS = ["green", "blue", "violet", "orange", "rose"] as const;
export const FONTS = ["geist", "inter", "system"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
/** "off" (or the OS reduced-motion setting) turns every animation off; "subtle" keeps fades, drops movement and loops. */
export const MOTIONS = ["full", "subtle", "off"] as const;
export const WEEK_STARTS = ["monday", "sunday", "saturday"] as const;
export const TIME_FORMATS = ["24h", "12h"] as const;
export const LANGUAGES = ["en", "id"] as const;

const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Use a colour like #2f9e44.");

export const themeSchema = z.object({
  mode: z.enum(MODES),
  preset: z.enum(PRESETS),
  /** Custom accent colour; overrides the preset's primary colour. */
  accent: hexColor.nullable(),
  font: z.enum(FONTS),
  density: z.enum(DENSITIES),
  motion: z.enum(MOTIONS),
});

export const preferencesSchema = z.object({
  weekStart: z.enum(WEEK_STARTS),
  timeFormat: z.enum(TIME_FORMATS),
  language: z.enum(LANGUAGES),
  /** IANA zone. Decides "today", week boundaries and when date-only deadlines end. */
  timeZone: z.string().refine(isValidTimeZone, "Choose a time zone from the list."),
  /** Percentage → letter → grade points. Default: Indonesian 4.0 scale. */
  gradeScale: gradeScaleSchema,
});

export type Theme = z.infer<typeof themeSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Settings = { theme: Theme; preferences: Preferences };

export const DEFAULT_THEME: Theme = {
  mode: "system",
  preset: "green",
  accent: null,
  font: "geist",
  density: "comfortable",
  motion: "full",
};

export const DEFAULT_PREFERENCES: Preferences = {
  weekStart: "monday",
  timeFormat: "24h",
  language: "en",
  timeZone: DEFAULT_TIME_ZONE,
  gradeScale: DEFAULT_GRADE_SCALE,
};

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME,
  preferences: DEFAULT_PREFERENCES,
};

type Shape = Record<string, z.ZodType>;

/** Merge a stored JSON value over defaults, keeping each valid field and dropping the rest. */
export function mergeOverDefaults<S extends Shape>(
  schema: z.ZodObject<S>,
  defaults: z.infer<z.ZodObject<S>>,
  stored: unknown,
): z.infer<z.ZodObject<S>> {
  const result: Record<string, unknown> = { ...defaults };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const [key, fieldSchema] of Object.entries(schema.shape)) {
      if (!(key in stored)) continue;
      const parsed = fieldSchema.safeParse((stored as Record<string, unknown>)[key]);
      if (parsed.success) result[key] = parsed.data;
    }
  }
  return result as z.infer<z.ZodObject<S>>;
}

/** Only the fields that differ from the defaults: what actually gets stored. */
export function diffFromDefaults<T extends Record<string, unknown>>(value: T, defaults: T): Partial<T> {
  const diff: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    // Compare by value: arrays/objects (e.g. the grade scale) are never === their default.
    if (JSON.stringify(value[key]) !== JSON.stringify(defaults[key])) diff[key] = value[key];
  }
  return diff;
}

/** Bring a stored row up to the current shape. Version 1 is the first shape, so nothing to do yet. */
export function upgrade(_version: number, raw: { theme: unknown; preferences: unknown }) {
  return raw;
}

export function resolveSettings(row: { version: number; theme: unknown; preferences: unknown } | null): Settings {
  if (!row) return DEFAULT_SETTINGS;
  const { theme, preferences } = upgrade(row.version, row);
  return {
    theme: mergeOverDefaults(themeSchema, DEFAULT_THEME, theme),
    preferences: mergeOverDefaults(preferencesSchema, DEFAULT_PREFERENCES, preferences),
  };
}

/** The settings form: every field required, accent may be blank. */
export const settingsFormSchema = z.object({
  theme: themeSchema.extend({
    accent: z.preprocess((v) => (v === "" || v == null ? null : v), hexColor.nullable()),
  }),
  preferences: preferencesSchema,
});
