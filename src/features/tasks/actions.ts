"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../auth/queries";
import { getSettings } from "../settings/queries";
import { dueAtFrom } from "./due";
import { quickAddSchema, STATUSES, subtaskInputSchema, taskInputSchema } from "./schema";

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
  redirect(`/tasks/${data.id}`);
}

/** Title only (plus the course filter currently applied, if any). */
export async function quickAddTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = quickAddSchema.safeParse({ title: formData.get("title") ?? "", courseId: formData.get("courseId") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, values };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({ title: parsed.data.title, course_id: parsed.data.courseId });
  if (error) {
    console.error("[tasks] quick add", error.code, error.message);
    return { ok: false, error: friendly(error.code, "Couldn't add the task. Please try again."), values };
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
