import { z } from "zod";

/** One band of a grade scale: a percentage of at least `min` earns `letter` worth `points`. */
export type GradeBand = { letter: string; min: number; points: number };

/**
 * Default: the common Indonesian university 4.0 scale. Campuses differ, so the
 * scale is a user preference (Settings → Grade scale).
 */
export const DEFAULT_GRADE_SCALE: GradeBand[] = [
  { letter: "A", min: 85, points: 4 },
  { letter: "A-", min: 80, points: 3.75 },
  { letter: "B+", min: 75, points: 3.5 },
  { letter: "B", min: 70, points: 3 },
  { letter: "B-", min: 65, points: 2.75 },
  { letter: "C+", min: 60, points: 2.5 },
  { letter: "C", min: 55, points: 2 },
  { letter: "D", min: 40, points: 1 },
  { letter: "E", min: 0, points: 0 },
];

const band = z.object({
  letter: z.string().trim().min(1, "Every band needs a letter.").max(3, "Letters can be at most 3 characters."),
  min: z
    .number("Minimum must be a number.")
    .min(0, "Minimum can't be below 0%.")
    .max(100, "Minimum can't be above 100%."),
  points: z.number("Points must be a number.").min(0, "Points can't be negative.").max(5, "Points can be at most 5."),
});

/**
 * A valid scale: 2–15 bands, one starting at 0%, distinct minimums and letters,
 * and never fewer points for a higher band. Stored and returned highest band first.
 */
export const gradeScaleSchema = z
  .array(band)
  .min(2, "A scale needs at least two bands.")
  .max(15, "A scale can have at most 15 bands.")
  .transform((bands) => [...bands].sort((a, b) => b.min - a.min))
  .refine((bands) => bands.at(-1)?.min === 0, "The lowest band must start at 0%.")
  .refine((bands) => new Set(bands.map((b) => b.min)).size === bands.length, "Two bands have the same minimum.")
  .refine(
    (bands) => new Set(bands.map((b) => b.letter.toUpperCase())).size === bands.length,
    "Two bands have the same letter.",
  )
  .refine(
    (bands) => bands.every((b, i) => i === 0 || b.points <= bands[i - 1].points),
    "A higher band can't be worth fewer points than a lower one.",
  );

/** The band a percentage falls in (highest band whose minimum it reaches). */
export function bandFor(percent: number, scale: readonly GradeBand[]): GradeBand {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  // Tiny tolerance so 84.99999999 from float maths still counts as 85.
  return sorted.find((b) => percent + 1e-9 >= b.min) ?? sorted[sorted.length - 1];
}

/**
 * Parses the settings form's "gradeScale" field (JSON rows of strings) into
 * bands. Blank or non-numeric cells become NaN so gradeScaleSchema rejects them
 * with a message instead of silently using 0.
 */
export function parseGradeScaleField(value: unknown): unknown {
  if (typeof value !== "string") return undefined;
  try {
    const rows = JSON.parse(value) as { letter?: unknown; min?: unknown; points?: unknown }[];
    if (!Array.isArray(rows)) return undefined;
    const num = (v: unknown) => (v === "" || v == null ? Number.NaN : Number(v));
    return rows.map((r) => ({ letter: String(r.letter ?? ""), min: num(r.min), points: num(r.points) }));
  } catch {
    return undefined;
  }
}
