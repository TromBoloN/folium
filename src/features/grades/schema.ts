import { z } from "zod";
import { isCivilDate } from "@/lib/dates";

const blankToNull = (v: unknown) => (v === "" || v == null ? null : v);
const toNumber = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);
const twoDecimals = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

export const assessmentInputSchema = z
  .object({
    courseId: z.uuid("Choose a course."),
    name: z.string().trim().min(1, "Give the assessment a name.").max(120, "Name can be at most 120 characters."),
    weight: z.preprocess(
      toNumber,
      z
        .number("Weight must be a number.")
        .gt(0, "Weight must be more than 0%.")
        .max(100, "Weight can be at most 100%.")
        .refine(twoDecimals, "Use at most two decimal places."),
    ),
    maxScore: z.preprocess(
      (v) => (v === "" || v == null ? 100 : toNumber(v)),
      z
        .number("Maximum score must be a number.")
        .gt(0, "Maximum score must be more than 0.")
        .max(100000, "Maximum score is too large.")
        .refine(twoDecimals, "Use at most two decimal places."),
    ),
    score: z.preprocess(
      (v) => toNumber(blankToNull(v)),
      z
        .number("Score must be a number.")
        .min(0, "Score can't be negative.")
        .refine(twoDecimals, "Use at most two decimal places.")
        .nullable(),
    ),
    dueDate: z.preprocess(
      blankToNull,
      z
        .string()
        .refine((v) => isCivilDate(v), "Enter a valid date.")
        .nullable(),
    ),
  })
  .refine((a) => a.score === null || a.score <= a.maxScore, {
    path: ["score"],
    message: "Score can't be more than the maximum.",
  });

export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
