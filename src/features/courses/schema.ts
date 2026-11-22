import { z } from "zod";
import { EMAIL_PATTERN, normalizePhone } from "@/lib/safe-links";
import { slotInputSchema } from "../timetable/schema";

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
export function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);
}

export const COURSE_KINDS = ["campus", "external"] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

/** Blank → null; otherwise a whole number in range. */
function optionalCount(label: string, max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v) : v),
    z
      .number(`${label} must be a number.`)
      .int(`${label} must be a whole number.`)
      .min(1, `${label} must be at least 1.`)
      .max(max, `${label} can be at most ${max}.`)
      .nullable(),
  );
}

export const courseInputSchema = z.object({
  /** campus: credits, semester and a class type. external: a bootcamp or course outside campus. */
  kind: z.enum(COURSE_KINDS, { error: "Choose campus or outside campus." }).default("campus"),
  /** An id from preferences.classTypes; blank = none. Checked against the user's types in the action. */
  classType: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null)
    .refine((v) => v === null || /^[a-z0-9-]{1,40}$/.test(v), "Choose a class type from the list."),
  /** How many meetings; blank = the class type's, or open-ended. */
  totalMeetings: optionalCount("Meetings", 200),
  /** "I'm at meeting N": the next meeting to log. Blank = leave as it is. */
  currentMeeting: optionalCount("Current meeting", 200),
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
  /** A plain address only, so the mailto: link can't carry extra headers. */
  lecturerEmail: optionalText(254, "Email").refine(
    (v) => v === null || EMAIL_PATTERN.test(v),
    "Enter an email like name@campus.ac.id.",
  ),
  /**
   * For a WhatsApp link. Typed with spaces, dashes or brackets; stored as digits
   * with an optional leading + (a leading 0 is kept; the link turns it into 62).
   */
  lecturerPhone: optionalText(24, "Phone")
    .refine((v) => v === null || normalizePhone(v) !== null, "Enter a phone number like +62 812 3456 7890.")
    .transform((v) => (v === null ? null : normalizePhone(v))),
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

/**
 * The parsed form, made consistent: an external course has no credits, semester
 * or class type; a campus course with a type and no count takes the type's
 * count; the current meeting can't be past the last one.
 */
export function normalizeCourse(
  input: CourseInput,
  classTypes: readonly { id: string; meetings: number }[],
): { ok: true; value: CourseInput } | { ok: false; field: string; message: string } {
  if (input.kind === "external") {
    input = { ...input, credits: 0, semester: null, classType: null };
  }
  const type = input.classType ? classTypes.find((t) => t.id === input.classType) : undefined;
  if (input.classType && !type) return { ok: false, field: "classType", message: "Choose a class type from the list." };
  const totalMeetings = input.totalMeetings ?? type?.meetings ?? null;
  if (totalMeetings !== null && input.currentMeeting !== null && input.currentMeeting > totalMeetings) {
    return {
      ok: false,
      field: "currentMeeting",
      message: `The current meeting can be at most ${totalMeetings}.`,
    };
  }
  return { ok: true, value: { ...input, totalMeetings } };
}

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
  kind: CourseKind;
  classType: string | null;
  /** Null = open-ended (no end). */
  totalMeetings: number | null;
  /** When "next meeting is N" was last set (ISO); classes that ended before it aren't asked about. */
  meetingsCountedFrom: string | null;
};

/** The database row for a validated course form. */
export function courseRow(input: CourseInput) {
  const { lecturerEmail, lecturerPhone, classType, totalMeetings, currentMeeting: _, ...rest } = input;
  return {
    ...rest,
    lecturer_email: lecturerEmail,
    lecturer_phone: lecturerPhone,
    class_type: classType,
    total_meetings: totalMeetings,
  };
}

/** Re-exported for the course screens; the rules live in `lib/safe-links.ts`. */
export { mailtoLink, whatsappLink } from "@/lib/safe-links";

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

/** A weekly class time typed in the course form (the course's room is used). */
export type ClassTimeInput = { weekday: number; startTime: string; endTime: string };

/**
 * The class-time rows of the course form (parallel lists of weekday, start and
 * end). Rows left blank are skipped; the first invalid row stops with a message.
 */
export function parseClassTimes(
  weekdays: readonly unknown[],
  starts: readonly unknown[],
  ends: readonly unknown[],
): { ok: true; rows: ClassTimeInput[] } | { ok: false; message: string } {
  const rows: ClassTimeInput[] = [];
  for (let i = 0; i < Math.max(weekdays.length, starts.length, ends.length); i++) {
    const start = String(starts[i] ?? "").trim();
    const end = String(ends[i] ?? "").trim();
    if (!start && !end) continue;
    const parsed = slotInputSchema.safeParse({
      // Checked again with the real course id when saved.
      courseId: "00000000-0000-4000-8000-000000000000",
      weekday: weekdays[i] ?? "",
      startTime: start,
      endTime: end,
      online: false,
    });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the class times." };
    rows.push({ weekday: parsed.data.weekday, startTime: parsed.data.startTime, endTime: parsed.data.endTime });
    if (rows.length > 14) return { ok: false, message: "Add at most 14 class times here." };
  }
  return { ok: true, rows };
}
