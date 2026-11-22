import { z } from "zod";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/dates";
import { DEFAULT_GRADE_SCALE, gradeScaleSchema } from "../grades/scale";
import { DEFAULT_PACK, THEME_PACK_IDS } from "../themes/registry";

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
/**
 * How much ambient decoration a theme pack draws (its background scene and effects
 * layer). Separate from motion: motion decides whether anything animates at all,
 * feedback included; this only scales the atmosphere. Packs without effects ignore it.
 */
export const EFFECTS = ["immersive", "balanced", "minimal"] as const;
export const WEEK_STARTS = ["monday", "sunday", "saturday"] as const;
export const TIME_FORMATS = ["24h", "12h"] as const;
export const LANGUAGES = ["en", "id"] as const;
/** How /courses opens: course cards, a time-first list by day, or the week grid. */
export const COURSES_VIEWS = ["cards", "day", "week"] as const;
export type CoursesView = (typeof COURSES_VIEWS)[number];

/**
 * Kinds of campus class ("Regular class", "Practicum") and how many meetings
 * each usually has. A course picks one; its meeting count starts from the
 * type's and can be changed per course.
 */
export const classTypeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/, "That class type isn't valid."),
  name: z
    .string()
    .trim()
    .min(1, "Give each class type a name.")
    .max(40, "Class type names can be at most 40 characters."),
  meetings: z
    .number("Meetings must be a number.")
    .int("Meetings must be a whole number.")
    .min(1, "A class type has at least 1 meeting.")
    .max(200, "Meetings can be at most 200."),
});
export type ClassType = z.infer<typeof classTypeSchema>;

export const classTypesSchema = z
  .array(classTypeSchema)
  .max(12, "Up to 12 class types.")
  .refine((types) => new Set(types.map((t) => t.id)).size === types.length, "Class types must be different.");

/** Defaults; names are shown translated until the user renames them ("Regular class" → "Kelas Biasa"). */
export const DEFAULT_CLASS_TYPES: ClassType[] = [
  { id: "regular", name: "Regular class", meetings: 16 },
  { id: "practicum", name: "Practicum", meetings: 8 },
];

/** The class types editor submits its rows as one JSON field. */
export function parseClassTypesField(value: unknown): unknown {
  if (typeof value !== "string") return undefined;
  try {
    const rows = JSON.parse(value) as { id?: unknown; name?: unknown; meetings?: unknown }[];
    if (!Array.isArray(rows)) return undefined;
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      meetings: r.meetings === "" || r.meetings == null ? Number.NaN : Number(r.meetings),
    }));
  } catch {
    return undefined;
  }
}

const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Use a colour like #2f9e44.");

export const themeSchema = z.object({
  /** The theme pack (src/features/themes): the whole look. Colour, mode and the rest below apply on top of it. */
  pack: z.enum(THEME_PACK_IDS),
  mode: z.enum(MODES),
  preset: z.enum(PRESETS),
  /** Custom accent colour; overrides the preset's primary colour. */
  accent: hexColor.nullable(),
  font: z.enum(FONTS),
  density: z.enum(DENSITIES),
  motion: z.enum(MOTIONS),
  effects: z.enum(EFFECTS),
});

export const preferencesSchema = z.object({
  weekStart: z.enum(WEEK_STARTS),
  timeFormat: z.enum(TIME_FORMATS),
  language: z.enum(LANGUAGES),
  /** IANA zone. Decides "today", week boundaries and when date-only deadlines end. */
  timeZone: z.string().refine(isValidTimeZone, "Choose a time zone from the list."),
  /** Percentage → letter → grade points. Default: Indonesian 4.0 scale. */
  gradeScale: gradeScaleSchema,
  /** Remembered from the view switch on /courses (not part of the settings form). */
  coursesView: z.enum(COURSES_VIEWS),
  /** Minimum attendance (percent of all classes) the campus requires; warnings use it. */
  attendanceTarget: z.number().int().min(0, "Use 0–100.").max(100, "Use 0–100."),
  /** Kinds of campus class and their usual meeting counts (see classTypeSchema). */
  classTypes: classTypesSchema,
  /** Email a reminder before a recurring bill is due (its own "remind me" days). Quiet by default. */
  billReminderEmails: z.boolean(),
  /** A Monday email: spent, left to spend, what's due. Quiet by default. */
  weeklySummaryEmail: z.boolean(),
  /** Catch-up state kept across devices without a schema migration (not in the settings form). */
  catchUp: z.object({
    balancesCheckedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  }),
});

export type Theme = z.infer<typeof themeSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Settings = { theme: Theme; preferences: Preferences };

export const DEFAULT_THEME: Theme = {
  pack: DEFAULT_PACK,
  mode: "system",
  preset: "green",
  accent: null,
  font: "geist",
  density: "comfortable",
  motion: "full",
  effects: "balanced",
};

export const DEFAULT_PREFERENCES: Preferences = {
  weekStart: "monday",
  timeFormat: "24h",
  language: "en",
  timeZone: DEFAULT_TIME_ZONE,
  gradeScale: DEFAULT_GRADE_SCALE,
  coursesView: "cards",
  attendanceTarget: 75,
  classTypes: DEFAULT_CLASS_TYPES,
  billReminderEmails: false,
  weeklySummaryEmail: false,
  catchUp: { balancesCheckedOn: null },
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

/** The settings form: every field required, accent may be blank. The pack is chosen on /themes, so the form keeps what's stored. */
export const settingsFormSchema = z.object({
  theme: themeSchema.omit({ pack: true }).extend({
    accent: z.preprocess((v) => (v === "" || v == null ? null : v), hexColor.nullable()),
  }),
  // The view switch and catch-up actions save coursesView and catchUp on their own; the form keeps whatever is stored.
  preferences: preferencesSchema.omit({ coursesView: true, catchUp: true }),
});

/** Choosing a theme pack on /themes. */
export const themePackFormSchema = z.object({
  pack: z.enum(THEME_PACK_IDS, { error: "That theme doesn't exist." }),
});

/** Your name as Folium shows it (sidebar, greeting). Blank clears it (the email shows instead). */
export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "Your name can be at most 80 characters.")
    .refine(
      (v) => ![...v].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127),
      "Use letters, numbers and spaces.",
    )
    .transform((v) => v.replace(/\s+/g, " ") || null),
});
