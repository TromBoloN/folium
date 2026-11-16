import { z } from "zod";
import { isCivilDate } from "@/lib/dates";
import { safeHttpsUrl } from "@/lib/safe-links";
import { toMinutes } from "./logic";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Enter a time like 08:00.");

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null)
  .refine((v) => v === null || isCivilDate(v), "Enter a valid date.");

export const slotInputSchema = z
  .object({
    courseId: z.uuid("Choose a course."),
    weekday: z.coerce.number().int().min(1, "Choose a day.").max(7, "Choose a day."),
    startTime: time.transform((v) => v.slice(0, 5)),
    endTime: time.transform((v) => v.slice(0, 5)),
    location: z
      .string()
      .trim()
      .max(80, "Location can be at most 80 characters.")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null),
    startsOn: optionalDate,
    endsOn: optionalDate,
    online: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    meetingUrl: z
      .string()
      .trim()
      .max(500, "The link can be at most 500 characters.")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null)
      // https only: no http, javascript:, data: or line breaks. Stored normalised.
      .refine((v) => v === null || safeHttpsUrl(v) !== null, "Paste a full link starting with https://")
      .transform((v) => (v === null ? null : safeHttpsUrl(v))),
  })
  // The database enforces these too; checking here gives a clear message on the right field.
  .refine((s) => toMinutes(s.endTime) > toMinutes(s.startTime), {
    path: ["endTime"],
    message: "End time must be after the start time.",
  })
  .refine((s) => !s.startsOn || !s.endsOn || s.endsOn >= s.startsOn, {
    path: ["endsOn"],
    message: "The last date can't be before the first date.",
  });

export type SlotInput = z.infer<typeof slotInputSchema>;
