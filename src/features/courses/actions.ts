"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues, fromSheet } from "@/lib/action-result";
import { isCivilDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../auth/queries";
import { type CourseInput, canonicalSemester, courseInputSchema, courseRow } from "./schema";

const idSchema = z.uuid();

function parseCourse(formData: FormData) {
  return courseInputSchema.safeParse({
    name: formData.get("name") ?? "",
    code: formData.get("code") ?? "",
    color: formData.get("color") ?? "",
    lecturer: formData.get("lecturer") ?? "",
    room: formData.get("room") ?? "",
    semester: formData.get("semester") ?? "",
    credits: formData.get("credits") ?? "",
    lecturerEmail: formData.get("lecturerEmail") ?? "",
    lecturerPhone: formData.get("lecturerPhone") ?? "",
  });
}

const SAVE_FAILED = "Couldn't save the course. Please try again.";

/** The row to save, with the semester spelled like an existing one if it matches. */
async function rowFor(input: CourseInput) {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("semester");
  return courseRow({
    ...input,
    semester: canonicalSemester(
      input.semester,
      (data ?? []).map((c) => c.semester),
    ),
  });
}

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
  const { data, error } = await supabase
    .from("courses")
    .insert(await rowFor(parsed.data))
    .select("id")
    .single();
  if (error) {
    console.error("[courses] create", error.code, error.message);
    return { ok: false, error: SAVE_FAILED, values };
  }

  revalidatePath("/courses", "layout");
  if (fromSheet(formData)) return { ok: true, result: { id: data.id } };
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
  const { data, error } = await supabase
    .from("courses")
    .update(await rowFor(parsed.data))
    .eq("id", id.data)
    .select("id");
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

const rolloverSchema = z
  .object({
    from: z.string().trim().max(60),
    to: z.string().trim().min(1, "Name the new semester.").max(60, "At most 60 characters."),
    copySlots: z.boolean(),
    startsOn: z.string().refine((v) => v === "" || isCivilDate(v), "Enter a valid date."),
    endsOn: z.string().refine((v) => v === "" || isCivilDate(v), "Enter a valid date."),
    archiveOld: z.boolean(),
  })
  .refine((v) => v.to !== v.from, { path: ["to"], message: "Pick a different name from the old semester." })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
    path: ["endsOn"],
    message: "The last day can't be before the first.",
  });

/**
 * Semester rollover: copy every course labelled `from` into a new semester
 * (name, code, colour, lecturer, room, credits), optionally with its weekly
 * class times dated to the new term, and archive the old ones. Grades,
 * tasks and attendance stay with the old courses.
 */
export async function startNewSemester(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = rolloverSchema.safeParse({
    from: formData.get("from") ?? "",
    to: formData.get("to") ?? "",
    copySlots: formData.get("copySlots") === "on",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
    archiveOld: formData.get("archiveOld") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const supabase = await createClient();
  const { data: labels } = await supabase.from("courses").select("semester");
  // "2026 genap" joins an existing "2026 Genap" instead of starting a second semester.
  const r = {
    ...parsed.data,
    to:
      canonicalSemester(
        parsed.data.to,
        (labels ?? []).map((c) => c.semester),
      ) ?? parsed.data.to,
  };
  let query = supabase
    .from("courses")
    .select(
      "id, name, code, color, lecturer, lecturer_email, lecturer_phone, room, credits, timetable_slots(weekday, start_time, end_time, location, is_online, meeting_url)",
    );
  query = r.from ? query.eq("semester", r.from) : query.is("semester", null);
  const { data: old, error } = await query;
  if (error) return { ok: false, error: "Couldn't load last semester's courses.", values };
  if (old.length === 0) return { ok: false, error: "No courses in that semester.", values };

  for (const c of old) {
    const { data: created, error: insertError } = await supabase
      .from("courses")
      .insert({
        name: c.name,
        code: c.code,
        color: c.color,
        lecturer: c.lecturer,
        lecturer_email: c.lecturer_email,
        lecturer_phone: c.lecturer_phone,
        room: c.room,
        credits: c.credits,
        semester: r.to,
      })
      .select("id")
      .single();
    if (insertError) {
      console.error("[courses] rollover", insertError.code, insertError.message);
      return { ok: false, error: "Couldn't copy every course. Check your courses and try again.", values };
    }
    if (r.copySlots && c.timetable_slots.length > 0) {
      const { error: slotError } = await supabase.from("timetable_slots").insert(
        c.timetable_slots.map((s) => ({
          course_id: created.id,
          weekday: s.weekday,
          start_time: s.start_time,
          end_time: s.end_time,
          location: s.location,
          is_online: s.is_online,
          meeting_url: s.meeting_url,
          starts_on: r.startsOn || null,
          ends_on: r.endsOn || null,
        })),
      );
      if (slotError) console.error("[courses] rollover slots", slotError.code, slotError.message);
    }
  }
  if (r.archiveOld) {
    await supabase
      .from("courses")
      .update({ archived_at: new Date().toISOString() })
      .in(
        "id",
        old.map((c) => c.id),
      )
      .is("archived_at", null);
  }

  revalidatePath("/courses", "layout");
  revalidatePath("/");
  if (fromSheet(formData)) return { ok: true, result: { count: String(old.length) } };
  redirect("/courses?view=cards");
}
