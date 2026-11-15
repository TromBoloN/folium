import { z } from "zod";

/**
 * Suggested course colours. These are user data (stored per course), not UI
 * styling, so they live here rather than in the theme. Any #rrggbb is allowed.
 */
export const COURSE_COLORS = [
  "#2f9e44",
  "#1c7ed6",
  "#7048e8",
  "#e8590c",
  "#d6336c",
  "#0c8599",
  "#f08c00",
  "#5c940d",
] as const;

/** First suggested colour not already used, so new courses are easy to tell apart. */
export function nextCourseColor(used: readonly string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return COURSE_COLORS.find((c) => !taken.has(c)) ?? COURSE_COLORS[used.length % COURSE_COLORS.length];
}

/** Empty form inputs become null; anything else is trimmed and length-checked. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);
}

export const courseInputSchema = z.object({
  name: z.string().trim().min(1, "Give the course a name.").max(120, "Name can be at most 120 characters."),
  code: optionalText(40, "Code"),
  color: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, "Pick a colour."),
  lecturer: optionalText(120, "Lecturer"),
  room: optionalText(80, "Room"),
  semester: optionalText(60, "Semester"),
  /** Credit units (SKS); 0 = not counted in the GPA. Blank means 0. */
  credits: z.preprocess(
    (v) => (v === "" || v == null ? 0 : typeof v === "string" ? Number(v) : v),
    z
      .number("Credits must be a number.")
      .min(0, "Credits can't be negative.")
      .max(24, "Credits can be at most 24.")
      .refine((v) => Number.isInteger(v * 10), "Use at most one decimal place."),
  ),
});

export type CourseInput = z.infer<typeof courseInputSchema>;

export type Course = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  lecturer: string | null;
  room: string | null;
  semester: string | null;
  credits: number;
  archivedAt: string | null;
};
