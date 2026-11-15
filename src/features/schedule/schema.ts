import { z } from "zod";
import { isCivilDate } from "@/lib/dates";
import { toMinutes } from "../timetable/logic";
import { parseOccurrenceKey } from "./occurrences";

export const occurrenceKeySchema = z
  .string()
  .max(100)
  .refine((k) => parseOccurrenceKey(k) !== null, "That class no longer exists.");

const date = z.string().refine(isCivilDate, "Enter a valid date.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Enter a time like 10:00.")
  .transform((v) => v.slice(0, 5));

function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);
}

export const SCOPES = ["once", "forward"] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * Move a class and/or change its room. "once" touches this date only;
 * "forward" edits the weekly class time from this date on.
 */
export const occurrenceUpdateSchema = z
  .object({
    key: occurrenceKeySchema,
    date,
    startTime: time,
    endTime: time,
    location: optionalText(80, "Room"),
    note: optionalText(200, "Note"),
    scope: z.enum(SCOPES).default("once"),
  })
  .refine((v) => toMinutes(v.endTime) > toMinutes(v.startTime), {
    path: ["endTime"],
    message: "End time must be after the start time.",
  });
export type OccurrenceUpdate = z.infer<typeof occurrenceUpdateSchema>;

export const cancelSchema = z.object({ key: occurrenceKeySchema, note: optionalText(200, "Note") });

export const EXTRA_LABELS = ["Makeup", "Exam", "Review", "Lab"] as const;

export const extraSessionSchema = z
  .object({
    courseId: z.uuid("Choose a course."),
    date,
    startTime: time,
    endTime: time,
    location: optionalText(80, "Room"),
    label: optionalText(40, "Label"),
    note: optionalText(200, "Note"),
  })
  .refine((v) => toMinutes(v.endTime) > toMinutes(v.startTime), {
    path: ["endTime"],
    message: "End time must be after the start time.",
  });

export const MAX_BREAK_DAYS = 120;

export const breakSchema = z
  .object({
    label: z.string().trim().min(1, "Give the break a name.").max(60, "Name can be at most 60 characters."),
    startsOn: date,
    endsOn: date,
  })
  .refine((v) => v.endsOn >= v.startsOn, { path: ["endsOn"], message: "The last day can't be before the first." })
  .refine((v) => (Date.parse(v.endsOn) - Date.parse(v.startsOn)) / 86_400_000 <= MAX_BREAK_DAYS, {
    path: ["endsOn"],
    message: `A break can be at most ${MAX_BREAK_DAYS} days.`,
  });

export const ATTENDANCE = ["attended", "missed"] as const;
export type AttendanceStatus = (typeof ATTENDANCE)[number];
