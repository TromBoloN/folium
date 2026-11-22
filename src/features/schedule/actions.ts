"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, type FormState, fieldErrorsFrom, formValues, fromSheet } from "@/lib/action-result";
import { addDays, type CivilDate, formatDate, isCivilDate, isoWeekday, minutesNowIn, todayIn } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/types/database";
import { requireUser } from "../auth/queries";
import { listCourseOptions } from "../courses/queries";
import { getSettings } from "../settings/queries";
import { timesOverlap, trimSeconds } from "../timetable/logic";
import { parseScheduleCommand, resolveCommand } from "./command";
import { placementLabel } from "./format";
import { isCounted } from "./meetings";
import { isLive, isPast, parseOccurrenceKey } from "./occurrences";
import { getMeetingLog, getOccurrence, getSchedule, listAttendanceMarks } from "./queries";
import {
  ATTENDANCE,
  type AttendanceStatus,
  breakSchema,
  cancelSchema,
  extraSessionSchema,
  type OccurrenceUpdate,
  occurrenceKeySchema,
  occurrenceUpdateSchema,
} from "./schema";

export type ChangeRow = Tables<"class_changes">;
export type BreakRow = Tables<"class_breaks">;

const FAILED = "Couldn't save the change. Please try again.";
const GONE = "That class no longer exists.";

/** The earlier / later of two "YYYY-MM-DD" dates (string order is date order). */
const earlier = (a: CivilDate, b: CivilDate) => [a, b].sort()[0];

function refresh() {
  revalidatePath("/courses", "layout");
  revalidatePath("/");
}

type SlotRow = {
  id: string;
  course_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_online: boolean;
  meeting_url: string | null;
  courses: { room: string | null } | null;
};

async function loadSlot(slotId: string): Promise<SlotRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("timetable_slots")
    .select(
      "id, course_id, weekday, start_time, end_time, location, starts_on, ends_on, is_online, meeting_url, courses(room)",
    )
    .eq("id", slotId)
    .maybeSingle();
  return (data as SlotRow | null) ?? null;
}

async function loadChangeFor(slotId: string, date: CivilDate) {
  const supabase = await createClient();
  return supabase.from("class_changes").select("*").eq("slot_id", slotId).eq("original_date", date).maybeSingle();
}

/** Replace whatever change an occurrence has with `next` (null = back to the weekly timetable). */
async function replaceChange(
  slot: SlotRow,
  date: CivilDate,
  next: Partial<ChangeRow> | null,
): Promise<ActionResult<{ previous: ChangeRow | null }>> {
  const supabase = await createClient();
  const { data: previous, error: readError } = await loadChangeFor(slot.id, date);
  if (readError) {
    console.error("[schedule] replace/read", readError.code, readError.message);
    return { ok: false, error: FAILED };
  }
  if (previous && next) {
    const { error } = await supabase
      .from("class_changes")
      .update({
        kind: next.kind ?? "moved",
        new_date: next.new_date ?? null,
        start_time: next.start_time ?? null,
        end_time: next.end_time ?? null,
        location: next.location ?? null,
        label: next.label ?? null,
        note: next.note ?? null,
      })
      .eq("id", previous.id);
    if (error) {
      console.error("[schedule] replace/update", error.code, error.message);
      return { ok: false, error: error.code === "23503" ? GONE : FAILED };
    }
  } else if (previous) {
    const { error } = await supabase.from("class_changes").delete().eq("id", previous.id);
    if (error) {
      console.error("[schedule] replace/delete", error.code, error.message);
      return { ok: false, error: FAILED };
    }
  } else if (next) {
    const { error } = await supabase.from("class_changes").insert({
      course_id: slot.course_id,
      slot_id: slot.id,
      original_date: date,
      kind: "moved",
      ...next,
    });
    if (error) {
      console.error("[schedule] replace/insert", error.code, error.message);
      return { ok: false, error: error.code === "23503" ? GONE : FAILED };
    }
  }
  if (next?.kind === "cancelled" || next?.kind === "postponed") {
    const { error: attError } = await supabase.from("attendance").delete().eq("slot_id", slot.id).eq("occurs_on", date);
    if (attError) {
      console.error("[schedule] replace/attendance", attError.code, attError.message);
      refresh();
      return { ok: false, error: FAILED };
    }
  }
  refresh();
  return { ok: true, data: { previous } };
}

// --- Cancel / restore ---------------------------------------------------------

/**
 * Cancel one class. A weekly class gets a "cancelled" change (replacing a move);
 * an extra session is deleted. Returns what was there, for Undo.
 */
export async function cancelOccurrence(input: {
  key: string;
  note?: string;
}): Promise<ActionResult<{ previous: ChangeRow | null }>> {
  await requireUser();
  const parsed = cancelSchema.safeParse({ key: input.key, note: input.note ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GONE };
  const ref = parseOccurrenceKey(parsed.data.key);
  if (!ref) return { ok: false, error: GONE };

  if (ref.kind === "extra") {
    const supabase = await createClient();
    const { data, error } = await supabase.from("class_changes").delete().eq("id", ref.changeId).select("*");
    if (error) return { ok: false, error: FAILED };
    if (data.length === 0) return { ok: false, error: GONE };
    refresh();
    return { ok: true, data: { previous: data[0] } };
  }

  const slot = await loadSlot(ref.slotId);
  if (!slot) return { ok: false, error: GONE };
  return replaceChange(slot, ref.date, { kind: "cancelled", note: parsed.data.note });
}

/**
 * "Rescheduled, but no new date yet": the class won't happen on its date and
 * isn't counted for attendance until the new date is set (updateOccurrence →
 * moved) or it's dropped (cancelOccurrence → cancelled). Weekly classes only;
 * an extra session is simply moved or cancelled. Returns what was there, for Undo.
 */
export async function postponeOccurrence(key: string): Promise<ActionResult<{ previous: ChangeRow | null }>> {
  await requireUser();
  const ref = parseOccurrenceKey(occurrenceKeySchema.safeParse(key).success ? key : "");
  if (ref?.kind !== "slot") return { ok: false, error: "Only a weekly class can wait for a new date." };
  const slot = await loadSlot(ref.slotId);
  if (!slot) return { ok: false, error: GONE };
  return replaceChange(slot, ref.date, { kind: "postponed" });
}

/** Back to the weekly timetable for this date (removes its change). */
export async function restoreOccurrence(key: string): Promise<ActionResult<{ previous: ChangeRow | null }>> {
  await requireUser();
  const ref = parseOccurrenceKey(occurrenceKeySchema.safeParse(key).success ? key : "");
  if (ref?.kind !== "slot") return { ok: false, error: GONE };
  const slot = await loadSlot(ref.slotId);
  if (!slot) return { ok: false, error: GONE };
  return replaceChange(slot, ref.date, null);
}

const changeRowSchema = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  slot_id: z.uuid().nullable(),
  kind: z.enum(["cancelled", "moved", "extra", "postponed"]),
  original_date: z.string().nullable(),
  new_date: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  location: z.string().nullable(),
  label: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
});

/**
 * Undo: put an occurrence back to how it was. `previous` is what an earlier
 * action returned (null = it had no change). The database re-checks everything.
 */
export async function undoChange(input: { key: string; previous: ChangeRow | null }): Promise<ActionResult> {
  await requireUser();
  const ref = parseOccurrenceKey(occurrenceKeySchema.safeParse(input.key).success ? input.key : "");
  if (!ref) return { ok: false, error: GONE };
  const prev = input.previous ? changeRowSchema.safeParse(input.previous) : null;
  if (prev && !prev.success) return { ok: false, error: "Couldn't undo. Please try again." };
  const supabase = await createClient();

  if (ref.kind === "slot") {
    if (!prev) {
      const { error } = await supabase
        .from("class_changes")
        .delete()
        .eq("slot_id", ref.slotId)
        .eq("original_date", ref.date);
      if (error) return { ok: false, error: "Couldn't undo. Please try again." };
    } else {
      const { data: updated, error } = await supabase
        .from("class_changes")
        .update({
          kind: prev.data.kind,
          new_date: prev.data.new_date,
          start_time: prev.data.start_time,
          end_time: prev.data.end_time,
          location: prev.data.location,
          label: prev.data.label,
          note: prev.data.note,
        })
        .eq("slot_id", ref.slotId)
        .eq("original_date", ref.date)
        .select("id");
      if (error) {
        console.error("[schedule] undo", error.code, error.message);
        return { ok: false, error: "Couldn't undo. Please try again." };
      }
      if (updated.length === 0) {
        const { error: insertError } = await supabase.from("class_changes").insert(prev.data);
        if (insertError) {
          console.error("[schedule] undo", insertError.code, insertError.message);
          return { ok: false, error: "Couldn't undo. Please try again." };
        }
      }
    }
  } else if (prev) {
    const { error } = await supabase.from("class_changes").upsert(prev.data);
    if (error) {
      console.error("[schedule] undo", error.code, error.message);
      return { ok: false, error: "Couldn't undo. Please try again." };
    }
  }
  refresh();
  return { ok: true };
}

// --- Move / room ----------------------------------------------------------------

/**
 * Move a class and/or change its room.
 *  once     this date only: a "moved" change holding only what differs from the
 *           weekly slot (nothing differs = the change is removed).
 *  forward  the weekly slot changes from this date: the old slot ends the day
 *           before and a new one starts (or the slot is edited in place if it
 *           has no earlier classes). Later one-off changes of the old slot are dropped.
 */
export async function updateOccurrence(
  input: Record<keyof OccurrenceUpdate, unknown>,
): Promise<ActionResult<{ previous: ChangeRow | null; scope: "once" | "forward" }>> {
  await requireUser();
  const parsed = occurrenceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const v = parsed.data;
  const ref = parseOccurrenceKey(v.key);
  if (!ref) return { ok: false, error: GONE };
  const supabase = await createClient();

  if (ref.kind === "extra") {
    const { data: before } = await supabase.from("class_changes").select("*").eq("id", ref.changeId).maybeSingle();
    if (!before) return { ok: false, error: GONE };
    const { error } = await supabase
      .from("class_changes")
      .update({ new_date: v.date, start_time: v.startTime, end_time: v.endTime, location: v.location, note: v.note })
      .eq("id", ref.changeId);
    if (error) return { ok: false, error: FAILED };
    refresh();
    return { ok: true, data: { previous: before, scope: "once" } };
  }

  const slot = await loadSlot(ref.slotId);
  if (!slot) return { ok: false, error: GONE };
  const slotStart = trimSeconds(slot.start_time);
  const slotEnd = trimSeconds(slot.end_time);
  const usualRoom = slot.location ?? slot.courses?.room ?? null;

  if (v.scope === "forward") {
    const { data: previous, error: readError } = await loadChangeFor(slot.id, ref.date);
    if (readError) {
      console.error("[schedule] forward/read", readError.code, readError.message);
      return { ok: false, error: FAILED };
    }
    // The new pattern starts on the earlier of the two dates, so this week's class isn't lost.
    const from = earlier(v.date, ref.date);
    const { error } = await supabase.rpc("split_timetable_slot", {
      p_slot_id: slot.id,
      p_from: from,
      p_weekday: isoWeekday(v.date),
      p_start_time: v.startTime,
      p_end_time: v.endTime,
      p_location: (v.location === usualRoom ? slot.location : v.location) ?? undefined,
    });
    if (error) {
      console.error("[schedule] forward/split", error.code, error.message);
      return { ok: false, error: error.code === "P0002" ? GONE : FAILED };
    }
    refresh();
    return { ok: true, data: { previous, scope: "forward" } };
  }

  const sameTime = v.startTime === slotStart && v.endTime === slotEnd;
  const next = {
    kind: "moved" as const,
    new_date: v.date === ref.date ? null : v.date,
    start_time: sameTime ? null : v.startTime,
    end_time: sameTime ? null : v.endTime,
    location: v.location && v.location !== usualRoom ? v.location : null,
    note: v.note,
  };
  const changesNothing = !next.new_date && !next.start_time && !next.location;
  const result = await replaceChange(slot, ref.date, changesNothing ? null : next);
  return result.ok ? { ok: true, data: { previous: result.data.previous, scope: "once" } } : result;
}

/** Names of live classes that overlap a time on a date (for the warning in the move sheet). */
export async function scheduleConflicts(input: {
  date: string;
  startTime: string;
  endTime: string;
  excludeKey?: string;
}): Promise<ActionResult<string[]>> {
  await requireUser();
  const parsed = z
    .object({
      date: z.string(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      excludeKey: z.string().max(100).optional(),
    })
    .safeParse(input);
  if (!parsed.success || !isCivilDate(parsed.data.date)) return { ok: true, data: [] };
  const { date, startTime, endTime, excludeKey } = parsed.data;
  if (endTime <= startTime) return { ok: true, data: [] };
  const day = await getSchedule({ from: date, to: date });
  const probe = { id: "probe", weekday: 0, startTime, endTime, startsOn: null, endsOn: null };
  const names = day
    .filter((o) => isLive(o) && o.key !== excludeKey && timesOverlap(o, probe))
    .map((o) => o.course.code ?? o.course.name);
  return { ok: true, data: [...new Set(names)] };
}

// --- Extra sessions -----------------------------------------------------------

function parseExtra(formData: FormData) {
  return extraSessionSchema.safeParse({
    courseId: formData.get("courseId"),
    date: formData.get("date") ?? "",
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    location: formData.get("location") ?? "",
    label: formData.get("label") ?? "",
    note: formData.get("note") ?? "",
  });
}

export async function createExtraSession(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = parseExtra(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const e = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_changes")
    .insert({
      kind: "extra",
      course_id: e.courseId,
      new_date: e.date,
      start_time: e.startTime,
      end_time: e.endTime,
      location: e.location,
      label: e.label,
      note: e.note,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[schedule] extra", error.code, error.message);
    return { ok: false, error: error.code === "23503" ? "That course no longer exists." : FAILED, values };
  }
  refresh();
  if (fromSheet(formData)) return { ok: true, result: { key: `x.${data.id}` } };
  redirect(`/courses?view=day&week=${e.date}`);
}

// --- Breaks -------------------------------------------------------------------

export async function createBreak(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = breakSchema.safeParse({
    label: formData.get("label") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const result = await insertBreak(parsed.data);
  if (!result.ok) return { ...result, values };
  if (fromSheet(formData)) return { ok: true, result: { id: result.data.id } };
  redirect(`/courses?view=day&week=${parsed.data.startsOn}`);
}

async function insertBreak(b: { label: string; startsOn: string; endsOn: string }): Promise<ActionResult<BreakRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_breaks")
    .insert({ label: b.label, starts_on: b.startsOn, ends_on: b.endsOn })
    .select("*")
    .single();
  if (error) {
    console.error("[schedule] break", error.code, error.message);
    return { ok: false, error: "Couldn't save the break. Please try again." };
  }
  refresh();
  return { ok: true, data };
}

/** For typed commands ("no classes 23–27 nov"): same rules as the form. */
async function addBreak(input: { label: string; startsOn: string; endsOn: string }): Promise<ActionResult<BreakRow>> {
  const parsed = breakSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the dates." };
  return insertBreak(parsed.data);
}

export async function removeBreak(id: string): Promise<ActionResult<{ previous: BreakRow }>> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "That break no longer exists." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("class_breaks").delete().eq("id", id).select("*");
  if (error) return { ok: false, error: "Couldn't remove the break. Please try again." };
  if (data.length === 0) return { ok: false, error: "That break no longer exists." };
  refresh();
  return { ok: true, data: { previous: data[0] } };
}

export async function restoreBreak(row: BreakRow): Promise<ActionResult> {
  await requireUser();
  const parsed = z
    .object({ id: z.uuid(), label: z.string(), starts_on: z.string(), ends_on: z.string(), created_at: z.string() })
    .safeParse(row);
  if (!parsed.success) return { ok: false, error: "Couldn't undo. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.from("class_breaks").upsert(parsed.data);
  if (error) return { ok: false, error: "Couldn't undo. Please try again." };
  refresh();
  return { ok: true };
}

// --- Attendance ---------------------------------------------------------------

/**
 * Mark a class attended or missed (null clears the mark). Only classes that
 * really happened can be marked; cancelled ones never count.
 */
export async function setAttendance(input: {
  key: string;
  status: AttendanceStatus | null;
  /** The meeting number the button showed; used when still free, else the next free one. */
  meeting?: number | null;
}): Promise<ActionResult<{ previous: AttendanceStatus | null; number: number | null }>> {
  await requireUser();
  const parsed = z
    .object({
      key: occurrenceKeySchema,
      status: z.enum(ATTENDANCE).nullable(),
      meeting: z.number().int().min(1).max(200).nullable().default(null),
    })
    .safeParse({ ...input, meeting: input.meeting ?? null });
  if (!parsed.success) return { ok: false, error: GONE };
  const ref = parseOccurrenceKey(parsed.data.key);
  if (!ref) return { ok: false, error: GONE };
  const supabase = await createClient();

  // Clearing a mark always works (even if the class was later cancelled, moved, or ended).
  if (parsed.data.status === null) {
    let query = supabase.from("attendance").select("id, status, meeting_number");
    query =
      ref.kind === "slot"
        ? query.eq("slot_id", ref.slotId).eq("occurs_on", ref.date)
        : query.eq("change_id", ref.changeId);
    const { data: existing, error: readError } = await query.maybeSingle();
    if (readError) {
      console.error("[schedule] attendance read", readError.code, readError.message);
      return { ok: false, error: "Couldn't save attendance. Please try again." };
    }
    const previous = (existing?.status as AttendanceStatus | undefined) ?? null;
    if (existing) {
      const { error } = await supabase.from("attendance").delete().eq("id", existing.id);
      if (error) {
        console.error("[schedule] attendance delete", error.code, error.message);
        return { ok: false, error: "Couldn't save attendance. Please try again." };
      }
    }
    refresh();
    return { ok: true, data: { previous, number: null } };
  }

  const occurrence = await getOccurrence(parsed.data.key);
  if (!occurrence || !isLive(occurrence)) return { ok: false, error: "Only classes that took place can be marked." };

  const target =
    occurrence.slotId && occurrence.originalDate
      ? { slot_id: occurrence.slotId, occurs_on: occurrence.originalDate, change_id: null }
      : { slot_id: null, occurs_on: null, change_id: occurrence.changeId };
  let query = supabase.from("attendance").select("id, status, meeting_number");
  query = target.slot_id
    ? query.eq("slot_id", target.slot_id).eq("occurs_on", target.occurs_on as string)
    : query.eq("change_id", target.change_id as string);
  const { data: existing, error: readError } = await query.maybeSingle();
  if (readError) {
    console.error("[schedule] attendance read", readError.code, readError.message);
    return { ok: false, error: "Couldn't save attendance. Please try again." };
  }
  const previous = (existing?.status as AttendanceStatus | undefined) ?? null;

  let error: { code: string; message: string } | null = null;
  let number: number | null = existing?.meeting_number ?? null;
  if (existing) {
    ({ error } = await supabase.from("attendance").update({ status: parsed.data.status }).eq("id", existing.id));
  } else {
    // The number the student saw, if nobody took it meanwhile; otherwise the database numbers it.
    const row: TablesInsert<"attendance"> = { course_id: occurrence.courseId, status: parsed.data.status, ...target };
    let inserted = await supabase
      .from("attendance")
      .insert({ ...row, meeting_number: parsed.data.meeting })
      .select("meeting_number")
      .single();
    if (inserted.error?.code === "23505" && parsed.data.meeting !== null) {
      inserted = await supabase.from("attendance").insert(row).select("meeting_number").single();
    }
    error = inserted.error;
    number = inserted.data?.meeting_number ?? null;
  }
  if (error) {
    console.error("[schedule] attendance", error.code, error.message);
    return {
      ok: false,
      error: error.code === "23505" ? "This class is already marked." : "Couldn't save attendance. Please try again.",
    };
  }
  refresh();
  return { ok: true, data: { previous, number } };
}

// --- Typed commands (Ctrl/⌘K) -------------------------------------------------

export type CommandUndo = { kind: "change"; key: string; previous: ChangeRow | null } | { kind: "break"; id: string };

/**
 * Run a typed schedule command ("cancel physics tomorrow"). Parsed and resolved
 * here on the server against the real schedule, then applied through the same
 * actions the sheets use. Returns a sentence for the toast and what Undo needs.
 */
export async function runScheduleCommand(text: string): Promise<ActionResult<{ message: string; undo: CommandUndo }>> {
  await requireUser();
  if (typeof text !== "string" || text.length > 300) return { ok: false, error: "That command is too long." };
  const [{ preferences }, courses, i18n] = await Promise.all([getSettings(), listCourseOptions(), getI18n()]);
  const { t, intl } = i18n;
  const active = courses.filter((c) => !c.archived);
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const nowMinute = minutesNowIn(preferences.timeZone, now);
  const command = parseScheduleCommand(text, { today, nowMinute, weekStart: preferences.weekStart }, active);
  if (!command) return { ok: false, error: "That isn't a schedule change." };

  const from = command.kind === "move" && command.from && command.from < today ? command.from : today;
  const occurrences = await getSchedule({ from, to: addDays(today, 42) });
  const resolved = resolveCommand(command, occurrences, active, { date: today, minute: nowMinute });
  if (!resolved.ok) return resolved;
  const plan = resolved.plan;
  const fmt = preferences.timeFormat;

  if (plan.action === "break") {
    const result = await addBreak({ label: plan.label, startsOn: plan.startsOn, endsOn: plan.endsOn });
    if (!result.ok) return result;
    const range =
      plan.startsOn === plan.endsOn
        ? formatDate(plan.startsOn, { weekday: "short", day: "numeric", month: "short" }, intl)
        : `${formatDate(plan.startsOn, { day: "numeric", month: "short" }, intl)} – ${formatDate(plan.endsOn, { day: "numeric", month: "short" }, intl)}`;
    return {
      ok: true,
      data: { message: t("No classes {range}", { range }), undo: { kind: "break", id: result.data.id } },
    };
  }

  const o = plan.occurrence;
  const name = o.course.code ?? o.course.name;
  const when = placementLabel(o, fmt, undefined, i18n);
  if (plan.action === "cancel") {
    const result = await cancelOccurrence({ key: o.key });
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        message: t("Cancelled {name}", { name: `${name}, ${when}` }),
        undo: { kind: "change", key: o.key, previous: result.data.previous },
      },
    };
  }
  const result = await updateOccurrence({
    key: o.key,
    date: plan.action === "move" ? plan.date : o.date,
    startTime: plan.action === "move" ? plan.startTime : o.startTime,
    endTime: plan.action === "move" ? plan.endTime : o.endTime,
    location: plan.action === "room" ? plan.room : (o.location ?? ""),
    note: o.note ?? "",
    scope: "once",
  });
  if (!result.ok) return result;
  const message =
    plan.action === "move"
      ? t("Moved {name} to {when}", {
          name,
          when: placementLabel({ date: plan.date, startTime: plan.startTime }, fmt, undefined, i18n),
        })
      : t("{name}, {when}: room → {room}", { name, when, room: plan.room });
  return { ok: true, data: { message, undo: { kind: "change", key: o.key, previous: result.data.previous } } };
}

/**
 * "Mark the rest as attended": every past class of a course that took place and
 * has no mark yet. Returns the keys it marked, so Undo can clear exactly those.
 */
export async function markUnmarkedAttended(courseId: string): Promise<ActionResult<{ keys: string[] }>> {
  await requireUser();
  if (!z.uuid().safeParse(courseId).success) return { ok: false, error: "That course no longer exists." };
  const { preferences } = await getSettings();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const nowMinute = minutesNowIn(preferences.timeZone, now);
  const [marks, schedule, log] = await Promise.all([
    listAttendanceMarks(courseId),
    getSchedule({ from: addDays(today, -180), to: today }),
    getMeetingLog(),
  ]);
  // Classes over before counting started are the backfilled meetings: not marked again.
  const countFrom = log.progress.get(courseId)?.countFrom ?? null;
  const todo = schedule.filter(
    (o) =>
      o.courseId === courseId &&
      isLive(o) &&
      isPast(o, { date: today, minute: nowMinute }) &&
      isCounted(o, countFrom) &&
      !marks.has(o.key),
  );
  if (todo.length === 0) return { ok: true, data: { keys: [] } };
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .insert(
      todo.map((o) =>
        o.slotId && o.originalDate
          ? { course_id: courseId, slot_id: o.slotId, occurs_on: o.originalDate, status: "attended" }
          : { course_id: courseId, change_id: o.changeId, status: "attended" },
      ),
    );
  if (error) {
    console.error("[schedule] mark all", error.code, error.message);
    return { ok: false, error: "Couldn't save attendance. Please try again." };
  }
  revalidatePath("/courses", "layout");
  return { ok: true, data: { keys: todo.map((o) => o.key) } };
}

/**
 * Mark a meeting known only by its number (from before counting started):
 * attended, skipped, or back to unknown. It never gets a date.
 */
export async function setMeetingStatus(input: {
  courseId: string;
  number: number;
  status: AttendanceStatus | null;
}): Promise<ActionResult> {
  await requireUser();
  const parsed = z
    .object({ courseId: z.uuid(), number: z.number().int().min(1).max(200), status: z.enum(ATTENDANCE).nullable() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: GONE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .update({ status: parsed.data.status ?? "unknown" })
    .eq("course_id", parsed.data.courseId)
    .eq("meeting_number", parsed.data.number)
    .is("slot_id", null)
    .is("change_id", null)
    .select("id");
  if (error) {
    console.error("[schedule] meeting status", error.code, error.message);
    return { ok: false, error: "Couldn't save attendance. Please try again." };
  }
  if (data.length === 0) return { ok: false, error: "That meeting no longer exists." };
  revalidatePath("/courses", "layout");
  revalidatePath("/");
  return { ok: true };
}

/** Undo for markUnmarkedAttended: clear these marks. */
export async function clearAttendance(keys: string[]): Promise<ActionResult> {
  await requireUser();
  const parsed = z.array(occurrenceKeySchema).max(500).safeParse(keys);
  if (!parsed.success) return { ok: false, error: "Couldn't undo." };
  const supabase = await createClient();
  for (const key of parsed.data) {
    const ref = parseOccurrenceKey(key);
    if (!ref) continue;
    const { error } =
      ref.kind === "slot"
        ? await supabase.from("attendance").delete().eq("slot_id", ref.slotId).eq("occurs_on", ref.date)
        : await supabase.from("attendance").delete().eq("change_id", ref.changeId);
    if (error) return { ok: false, error: "Couldn't undo." };
  }
  revalidatePath("/courses", "layout");
  return { ok: true };
}
