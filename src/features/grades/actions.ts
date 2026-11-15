"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../auth/queries";
import { getSettings } from "../settings/queries";
import { dueAtFrom } from "../tasks/due";
import { assessmentInputSchema } from "./schema";

const idSchema = z.uuid();
const GONE = "That assessment no longer exists.";

function parse(formData: FormData) {
  return assessmentInputSchema.safeParse({
    courseId: formData.get("courseId"),
    name: formData.get("name") ?? "",
    weight: formData.get("weight") ?? "",
    maxScore: formData.get("maxScore") ?? "",
    score: formData.get("score") ?? "",
    dueDate: formData.get("dueDate") ?? "",
  });
}

async function toRow(input: z.infer<typeof assessmentInputSchema>) {
  const { preferences } = await getSettings();
  return {
    course_id: input.courseId,
    name: input.name,
    weight: input.weight,
    max_score: input.maxScore,
    score: input.score,
    // A due date is "by the end of that day" in the user's zone, like task deadlines.
    due_at: input.dueDate ? dueAtFrom(input.dueDate, null, preferences.timeZone) : null,
  };
}

function refresh() {
  // Grades show on /grades, the course page and the dashboard widget.
  revalidatePath("/", "layout");
}

export async function createAssessment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("assessments").insert(await toRow(parsed.data));
  if (error) {
    console.error("[grades] create", error.code, error.message);
    const message = error.code === "23503" ? "That course no longer exists." : "Couldn't save the assessment.";
    return { ok: false, error: message, values };
  }
  refresh();
  redirect(`/grades/${parsed.data.courseId}`);
}

export async function updateAssessment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: GONE, values };
  const parsed = parse(formData);
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
    .from("assessments")
    .update(await toRow(parsed.data))
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("[grades] update", error.code, error.message);
    const message = error.code === "23503" ? "That course no longer exists." : "Couldn't save the assessment.";
    return { ok: false, error: message, values };
  }
  if (data.length === 0) return { ok: false, error: GONE, values };
  refresh();
  redirect(`/grades/${parsed.data.courseId}`);
}

export async function deleteAssessment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { error } = await supabase.from("assessments").delete().eq("id", id.data);
  if (error) {
    console.error("[grades] delete", error.code, error.message);
    return { ok: false, error: "Couldn't delete the assessment." };
  }
  refresh();
  return { ok: true };
}
