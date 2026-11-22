"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, type FormState, fieldErrorsFrom, formValues, fromSheet } from "@/lib/action-result";
import { isCivilDate, minutesNowIn, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../auth/queries";
import { listCourseOptions } from "../courses/queries";
import { getSettings } from "../settings/queries";
import { dueAtFrom, movedDue, RESCHEDULE_CHOICES, rescheduleDate } from "./due";
import { matchCourse, parseQuickAdd } from "./parse";
import {
  PRIORITIES,
  quickAddSchema,
  STATUSES,
  subtaskInputSchema,
  type TaskPriority,
  type TaskStatus,
  taskInputSchema,
} from "./schema";

const idSchema = z.uuid();
const GONE = "That task no longer exists.";

function parseTask(formData: FormData) {
  return taskInputSchema.safeParse({
    title: formData.get("title") ?? "",
    notes: formData.get("notes"),
    courseId: formData.get("courseId"),
    dueDate: formData.get("dueDate"),
    dueTime: formData.get("dueTime"),
    priority: formData.get("priority"),
    status: formData.get("status"),
  });
}

/** Form fields -> row. The due date is interpreted in the user's time zone. */
async function toRow(task: z.infer<typeof taskInputSchema>) {
  const { preferences } = await getSettings();
  return {
    title: task.title,
    notes: task.notes,
    course_id: task.courseId,
    due_at: task.dueDate ? dueAtFrom(task.dueDate, task.dueTime, preferences.timeZone) : null,
    due_has_time: Boolean(task.dueDate && task.dueTime),
    priority: task.priority,
    status: task.status,
  };
}

/** Postgres error codes that mean "the thing you pointed at isn't yours or is gone". */
function friendly(code: string | undefined, fallback: string) {
  if (code === "23503") return "That course or task no longer exists.";
  return fallback;
}

/** Tasks show on /tasks and on the Today dashboard (/), so refresh from the root. */
function done() {
  revalidatePath("/", "layout");
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = parseTask(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert(await toRow(parsed.data))
    .select("id")
    .single();
  if (error) {
    console.error("[tasks] create", error.code, error.message);
    return { ok: false, error: friendly(error.code, "Couldn't save the task. Please try again."), values };
  }
  done();
  if (fromSheet(formData)) return { ok: true, result: { id: data.id } };
  redirect(`/tasks/${data.id}`);
}

/**
 * One line of text: "Essay outline tomorrow 5pm #ING101 !high". The title is
 * parsed in the user's time zone (see parse.ts); a #course that matches nothing
 * stays in the title, so nothing typed is lost. Without a #course, the course
 * filter the list is showing (hidden courseId field) applies.
 */
export async function quickAddTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const raw = quickAddSchema.safeParse({ title: formData.get("title") ?? "", courseId: formData.get("courseId") });
  if (!raw.success) return { ok: false, error: raw.error.issues[0].message, values };

  const [{ preferences }, courses] = await Promise.all([getSettings(), listCourseOptions()]);
  const now = new Date();
  const parsed = parseQuickAdd(raw.data.title, {
    today: todayIn(preferences.timeZone, now),
    nowMinute: minutesNowIn(preferences.timeZone, now),
    weekStart: preferences.weekStart,
  });
  const course = parsed.course
    ? matchCourse(
        parsed.course,
        courses.filter((c) => !c.archived),
      )
    : null;
  const title = parsed.course && !course ? `${parsed.title} #${parsed.course}` : parsed.title;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: title.slice(0, 200),
      course_id: course?.id ?? raw.data.courseId,
      due_at: parsed.dueDate ? dueAtFrom(parsed.dueDate, parsed.dueTime, preferences.timeZone) : null,
      due_has_time: Boolean(parsed.dueDate && parsed.dueTime),
      priority: parsed.priority ?? "medium",
    })
    .select("id")
    .single();
  if (error) {
    console.error("[tasks] quick add", error.code, error.message);
    return { ok: false, error: friendly(error.code, "Couldn't add the task. Please try again."), values };
  }
  done();
  return { ok: true, result: { id: data.id, title } };
}

// --- Inline actions (called from the client; each returns what undo needs) ---

/** Completes or reopens a task, returning the status it had, for undo. */
export async function changeTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<ActionResult<{ previous: TaskStatus }>> {
  await requireUser();
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = z.enum(STATUSES).safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { data: before, error: readError } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (readError) {
    console.error("[tasks] status read", readError.code, readError.message);
    return { ok: false, error: "Couldn't update the task. Please try again." };
  }
  if (!before) return { ok: false, error: GONE };
  const { error } = await supabase.from("tasks").update({ status: parsedStatus.data }).eq("id", parsedId.data);
  if (error) {
    console.error("[tasks] status", error.code, error.message);
    return { ok: false, error: "Couldn't update the task. Please try again." };
  }
  done();
  return { ok: true, data: { previous: before.status as TaskStatus } };
}

const patchSchema = z
  .object({
    id: z.uuid(),
    title: z
      .string()
      .trim()
      .min(1, "Give the task a title.")
      .max(200, "Title can be at most 200 characters.")
      .optional(),
    priority: z.enum(PRIORITIES).optional(),
    courseId: z.uuid().nullable().optional(),
    /** A quick move, computed on the server in the user's zone. */
    reschedule: z.enum(RESCHEDULE_CHOICES).optional(),
    /** A picked date (keeps the time of day when possible), or null to clear the deadline. */
    dueDate: z
      .string()
      .refine((v) => isCivilDate(v), "Enter a valid date.")
      .nullable()
      .optional(),
    /** An exact deadline, used by undo to put back what was there. */
    due: z.object({ dueAt: z.iso.datetime({ offset: true }).nullable(), dueHasTime: z.boolean() }).optional(),
  })
  .strict();

export type TaskPatch = z.input<typeof patchSchema>;
export type TaskFields = {
  title: string;
  priority: TaskPriority;
  courseId: string | null;
  due: { dueAt: string | null; dueHasTime: boolean };
};

/** Changes a few fields of one task. Returns the fields as they were, so the change can be undone. */
export async function patchTask(
  input: TaskPatch,
): Promise<ActionResult<{ previous: TaskFields; dueAt: string | null }>> {
  await requireUser();
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const p = parsed.data;

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("tasks")
    .select("title, priority, course_id, due_at, due_has_time")
    .eq("id", p.id)
    .is("parent_id", null)
    .maybeSingle();
  if (readError) {
    console.error("[tasks] patch read", readError.code, readError.message);
    return { ok: false, error: "Couldn't save the change. Please try again." };
  }
  if (!row) return { ok: false, error: GONE };

  const update: {
    title?: string;
    priority?: string;
    course_id?: string | null;
    due_at?: string | null;
    due_has_time?: boolean;
  } = {};
  if (p.title !== undefined) update.title = p.title;
  if (p.priority !== undefined) update.priority = p.priority;
  if (p.courseId !== undefined) update.course_id = p.courseId;

  if (p.due) {
    update.due_at = p.due.dueAt;
    update.due_has_time = p.due.dueAt ? p.due.dueHasTime : false;
  } else if (p.reschedule || p.dueDate !== undefined) {
    const { preferences } = await getSettings();
    const now = new Date();
    const date = p.reschedule
      ? rescheduleDate(p.reschedule, todayIn(preferences.timeZone, now), preferences.weekStart)
      : p.dueDate;
    if (date) {
      const moved = movedDue({ dueAt: row.due_at, dueHasTime: row.due_has_time }, date, now, preferences.timeZone);
      update.due_at = moved.dueAt;
      update.due_has_time = moved.dueHasTime;
    } else {
      update.due_at = null;
      update.due_has_time = false;
    }
  }

  const { error } = await supabase.from("tasks").update(update).eq("id", p.id);
  if (error) {
    console.error("[tasks] patch", error.code, error.message);
    return { ok: false, error: friendly(error.code, "Couldn't save the change. Please try again.") };
  }
  done();
  return {
    ok: true,
    data: {
      previous: {
        title: row.title,
        priority: row.priority as TaskPriority,
        courseId: row.course_id,
        due: { dueAt: row.due_at, dueHasTime: row.due_has_time },
      },
      dueAt: update.due_at === undefined ? row.due_at : update.due_at,
    },
  };
}

const snapshotSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  notes: z.string().max(10000).nullable(),
  courseId: z.uuid().nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  dueHasTime: z.boolean(),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
  createdAt: z.iso.datetime({ offset: true }),
  subtasks: z.array(z.object({ id: z.uuid(), title: z.string().min(1).max(200), done: z.boolean() })).max(200),
});
export type TaskSnapshot = z.infer<typeof snapshotSchema>;

/** Deletes a task (and its steps) and returns a snapshot, so "Undo" can put it back exactly. */
export async function removeTask(id: string): Promise<ActionResult<{ snapshot: TaskSnapshot }>> {
  await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("tasks")
    .select("id, title, notes, course_id, due_at, due_has_time, priority, status, created_at")
    .eq("id", parsedId.data)
    .is("parent_id", null)
    .maybeSingle();
  if (readError) {
    console.error("[tasks] remove read", readError.code, readError.message);
    return { ok: false, error: "Couldn't delete the task. Please try again." };
  }
  if (!row) return { ok: false, error: GONE };
  const { data: steps, error: stepsError } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("parent_id", parsedId.data)
    .order("position")
    .order("created_at");
  if (stepsError) {
    console.error("[tasks] remove steps", stepsError.code, stepsError.message);
    return { ok: false, error: "Couldn't delete the task. Please try again." };
  }

  const { error } = await supabase.from("tasks").delete().eq("id", parsedId.data);
  if (error) {
    console.error("[tasks] remove", error.code, error.message);
    return { ok: false, error: "Couldn't delete the task. Please try again." };
  }
  done();
  return {
    ok: true,
    data: {
      snapshot: {
        id: row.id,
        title: row.title,
        notes: row.notes,
        courseId: row.course_id,
        dueAt: row.due_at,
        dueHasTime: row.due_has_time,
        priority: row.priority as TaskSnapshot["priority"],
        status: row.status as TaskSnapshot["status"],
        createdAt: row.created_at,
        subtasks: (steps ?? []).map((s) => ({ id: s.id, title: s.title, done: s.status === "done" })),
      },
    },
  };
}

/** Puts a deleted task back from its snapshot (same id, so links to it work again). */
export async function restoreTask(snapshot: TaskSnapshot): Promise<ActionResult> {
  await requireUser();
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) return { ok: false, error: "Couldn't restore the task." };
  const t = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    id: t.id,
    title: t.title,
    notes: t.notes,
    course_id: t.courseId,
    due_at: t.dueAt,
    due_has_time: t.dueHasTime,
    priority: t.priority,
    status: t.status,
    created_at: t.createdAt,
  });
  if (error) {
    console.error("[tasks] restore", error.code, error.message);
    // 23503: its course was deleted meanwhile; restore it without one.
    if (error.code !== "23503") return { ok: false, error: "Couldn't restore the task." };
    const retry = await supabase.from("tasks").insert({
      id: t.id,
      title: t.title,
      notes: t.notes,
      due_at: t.dueAt,
      due_has_time: t.dueHasTime,
      priority: t.priority,
      status: t.status,
      created_at: t.createdAt,
    });
    if (retry.error) return { ok: false, error: "Couldn't restore the task." };
  }
  if (t.subtasks.length > 0) {
    const { error: stepsError } = await supabase.from("tasks").insert(
      t.subtasks.map((s, i) => ({
        id: s.id,
        parent_id: t.id,
        title: s.title,
        status: s.done ? "done" : "todo",
        position: i + 1,
      })),
    );
    if (stepsError) {
      console.error("[tasks] restore steps", stepsError.code, stepsError.message);
      done();
      return { ok: false, error: "Couldn't restore the task." };
    }
  }
  done();
  return { ok: true };
}

export async function updateTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: GONE, values };
  const parsed = parseTask(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(await toRow(parsed.data))
    .eq("id", id.data)
    .is("parent_id", null)
    .select("id");
  if (error) {
    console.error("[tasks] update", error.code, error.message);
    return { ok: false, error: friendly(error.code, "Couldn't save the task. Please try again."), values };
  }
  if (data.length === 0) return { ok: false, error: GONE, values };
  done();
  if (fromSheet(formData)) return { ok: true, result: { id: id.data } };
  redirect(`/tasks/${id.data}`);
}

/** Used by the list checkbox and the detail page. completed_at is kept in sync by a trigger. */
export async function setTaskStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  const status = z.enum(STATUSES).safeParse(formData.get("status"));
  if (!id.success || !status.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update({ status: status.data }).eq("id", id.data).select("id");
  if (error) {
    console.error("[tasks] status", error.code, error.message);
    return { ok: false, error: "Couldn't update the task. Please try again." };
  }
  if (data.length === 0) return { ok: false, error: GONE };
  done();
  return { ok: true };
}

/** Deletes the task and its subtasks (ON DELETE CASCADE). */
export async function deleteTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id.data);
  if (error) {
    console.error("[tasks] delete", error.code, error.message);
    return { ok: false, error: "Couldn't delete the task. Please try again." };
  }
  done();
  redirect("/tasks");
}

export async function addSubtask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = subtaskInputSchema.safeParse({ taskId: formData.get("taskId"), title: formData.get("title") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.at(-1)?.message ?? GONE, values };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({ parent_id: parsed.data.taskId, title: parsed.data.title });
  if (error) {
    console.error("[tasks] add subtask", error.code, error.message);
    // 23514: the one-level trigger (a step can't have steps); 23503: parent isn't the user's.
    const message =
      error.code === "23514" ? "Steps can't have their own steps." : friendly(error.code, "Couldn't add the step.");
    return { ok: false, error: message, values };
  }
  done();
  return { ok: true };
}

export async function toggleSubtask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: formData.get("done") === "true" ? "done" : "todo" })
    .eq("id", id.data)
    .not("parent_id", "is", null)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("[tasks] toggle subtask", error.code, error.message);
    return { ok: false, error: error ? "Couldn't update the step." : GONE };
  }
  done();
  return { ok: true };
}

export async function deleteSubtask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id.data).not("parent_id", "is", null);
  if (error) {
    console.error("[tasks] delete subtask", error.code, error.message);
    return { ok: false, error: "Couldn't delete the step." };
  }
  done();
  return { ok: true };
}
