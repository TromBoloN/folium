"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../auth/queries";
import { slotInputSchema } from "./schema";

const idSchema = z.uuid();

function parseSlot(formData: FormData) {
  return slotInputSchema.safeParse({
    courseId: formData.get("courseId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    location: formData.get("location") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
  });
}

function toRow(slot: z.infer<typeof slotInputSchema>) {
  return {
    course_id: slot.courseId,
    weekday: slot.weekday,
    start_time: slot.startTime,
    end_time: slot.endTime,
    location: slot.location,
    starts_on: slot.startsOn,
    ends_on: slot.endsOn,
  };
}

const SAVE_FAILED = "Couldn't save the class time. Please try again.";

/**
 * Overlapping class times are allowed on purpose (a student may sit in on two
 * classes, or a timetable may be provisional). The timetable shows a warning
 * icon on overlaps instead of blocking the save.
 */
export async function createSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = parseSlot(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("timetable_slots").insert(toRow(parsed.data));
  if (error) {
    console.error("[timetable] create", error.code, error.message);
    // 23503: the course isn't the user's or was deleted (composite foreign key).
    const message = error.code === "23503" ? "That course no longer exists." : SAVE_FAILED;
    return { ok: false, error: message, values };
  }

  revalidatePath("/courses", "layout");
  redirect(`/courses/${parsed.data.courseId}`);
}

export async function updateSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That class time no longer exists.", values };
  const parsed = parseSlot(formData);
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
    .from("timetable_slots")
    .update(toRow(parsed.data))
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("[timetable] update", error.code, error.message);
    return { ok: false, error: SAVE_FAILED, values };
  }
  if (data.length === 0) return { ok: false, error: "That class time no longer exists.", values };

  revalidatePath("/courses", "layout");
  redirect(`/courses/${parsed.data.courseId}`);
}

export async function deleteSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That class time no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("timetable_slots").delete().eq("id", id.data);
  if (error) {
    console.error("[timetable] delete", error.code, error.message);
    return { ok: false, error: "Couldn't delete the class time. Please try again." };
  }

  revalidatePath("/courses", "layout");
  return { ok: true };
}
