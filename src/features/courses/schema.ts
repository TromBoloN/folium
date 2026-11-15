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
  lecturerEmail: optionalText(254, "Email").refine(
    (v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    "Enter an email like name@campus.ac.id.",
  ),
  /** For a WhatsApp link. Spaces, dashes and brackets are fine; a leading 0 is kept as typed. */
  lecturerPhone: optionalText(24, "Phone").refine(
    (v) => v === null || /^\+?[0-9][0-9 ()-]{5,22}$/.test(v),
    "Enter a phone number like +62 812 3456 7890.",
  ),
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
  lecturerEmail: string | null;
  lecturerPhone: string | null;
};

/** The database row for a validated course form. */
export function courseRow(input: CourseInput) {
  const { lecturerEmail, lecturerPhone, ...rest } = input;
  return { ...rest, lecturer_email: lecturerEmail, lecturer_phone: lecturerPhone };
}

/**
 * wa.me wants digits only, with the country code. Indonesian numbers are often
 * written 0812…; that leading 0 becomes 62. Other numbers need their own "+".
 */
export function whatsappLink(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (!phone.trim().startsWith("+") && digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

/** Suggest the next semester's name: "2026 Ganjil" -> "2026 Genap" -> "2027 Ganjil". Unknown formats: "". */
export function nextSemesterName(label: string): string {
  const m = /^(\d{4})\s+(Ganjil|Genap)$/i.exec(label.trim());
  if (!m) return "";
  return m[2].toLowerCase() === "ganjil" ? `${m[1]} Genap` : `${Number(m[1]) + 1} Ganjil`;
}

/**
 * Use the existing spelling when a typed semester matches one already used,
 * ignoring case and extra spaces: "2026  ganjil" -> "2026 Ganjil". Otherwise the
 * typed label, tidied. Stops one semester from splitting into two.
 */
export function canonicalSemester(input: string | null, existing: readonly (string | null)[]): string | null {
  if (input === null) return null;
  const tidy = input.trim().replace(/\s+/g, " ");
  if (!tidy) return null;
  const key = tidy.toLowerCase();
  return existing.find((e) => e !== null && e.trim().replace(/\s+/g, " ").toLowerCase() === key) ?? tidy;
}

/** Distinct semester labels, most courses first (usually the current one). */
export function semesterLabels(courses: readonly { semester: string | null }[]): string[] {
  const counts = new Map<string, number>();
  for (const c of courses) if (c.semester) counts.set(c.semester, (counts.get(c.semester) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).map(([label]) => label);
}
