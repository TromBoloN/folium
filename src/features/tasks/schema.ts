import { z } from "zod";
import { isCivilDate } from "@/lib/dates";
import type { MessageKey } from "@/lib/i18n/core";

/** v1 defaults. Stored as text with CHECK constraints so user-defined ones can replace them later. */
export const STATUSES = ["todo", "in_progress", "done"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskStatus = (typeof STATUSES)[number];
export type TaskPriority = (typeof PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, MessageKey> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
export const PRIORITY_LABELS: Record<TaskPriority, MessageKey> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const title = z.string().trim().min(1, "Give the task a title.").max(200, "Title can be at most 200 characters.");
const blankToNull = (v: unknown) => (v === "" || v == null ? null : v);

export const taskInputSchema = z
  .object({
    title,
    notes: z.preprocess(blankToNull, z.string().max(10000, "Notes can be at most 10,000 characters.").nullable()),
    courseId: z.preprocess(blankToNull, z.uuid("Choose a course from the list.").nullable()),
    dueDate: z.preprocess(
      blankToNull,
      z
        .string()
        .refine((v) => isCivilDate(v), "Enter a valid date.")
        .nullable(),
    ),
    dueTime: z.preprocess(
      blankToNull,
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 14:30.")
        .nullable(),
    ),
    priority: z.enum(PRIORITIES, "Choose a priority."),
    status: z.enum(STATUSES, "Choose a status."),
  })
  .refine((t) => t.dueDate || !t.dueTime, { path: ["dueDate"], message: "Add a date for this time." });

export type TaskInput = z.infer<typeof taskInputSchema>;

export const quickAddSchema = z.object({
  title,
  courseId: z.preprocess(blankToNull, z.uuid().nullable()),
});

export const subtaskInputSchema = z.object({
  taskId: z.uuid(),
  title: z.string().trim().min(1, "Type a step first.").max(200, "Keep it under 200 characters."),
});

/** List filters, parsed from the URL. Anything unknown falls back to the default. */
export const taskFiltersSchema = z.object({
  status: z.enum(["open", "done", "all"]).catch("open"),
  due: z.enum(["any", "overdue", "today", "week"]).catch("any"),
  course: z.uuid().optional().catch(undefined),
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;
