"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../auth/queries";
import { courseInputSchema } from "./schema";

const idSchema = z.uuid();

function parseCourse(formData: FormData) {
  return courseInputSchema.safeParse({
    name: formData.get("name") ?? "",
    code: formData.get("code") ?? "",
    color: formData.get("color") ?? "",
    lecturer: formData.get("lecturer") ?? "",
    room: formData.get("room") ?? "",
    semester: formData.get("semester") ?? "",
  });
}

const SAVE_FAILED = "Couldn't save the course. Please try again.";

export async function createCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = parseCourse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").insert(parsed.data).select("id").single();
  if (error) {
    console.error("[courses] create", error.code, error.message);
    return { ok: false, error: SAVE_FAILED, values };
  }

  revalidatePath("/courses", "layout");
  redirect(`/courses/${data.id}`);
}

export async function updateCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That course no longer exists.", values };
  const parsed = parseCourse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").update(parsed.data).eq("id", id.data).select("id");
  if (error) {
    console.error("[courses] update", error.code, error.message);
    return { ok: false, error: SAVE_FAILED, values };
  }
  if (data.length === 0) return { ok: false, error: "That course no longer exists.", values };

  revalidatePath("/courses", "layout");
  redirect(`/courses/${id.data}`);
}

export async function setCourseArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That course no longer exists." };
  const archive = formData.get("archive") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("[courses] archive", error.code, error.message);
    return { ok: false, error: "Couldn't update the course. Please try again." };
  }
  if (data.length === 0) return { ok: false, error: "That course no longer exists." };

  revalidatePath("/courses", "layout");
  return { ok: true };
}

/** Deletes the course and its class times. Its tasks stay, unlinked (see the migration). */
export async function deleteCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That course no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id.data);
  if (error) {
    console.error("[courses] delete", error.code, error.message);
    return { ok: false, error: "Couldn't delete the course. Please try again." };
  }

  revalidatePath("/courses", "layout");
  redirect("/courses");
}
