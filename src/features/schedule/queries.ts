import "server-only";
import { cache } from "react";
import { addDays, type CivilDate, isCivilDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { listActiveSlots } from "../courses/queries";
import { trimSeconds } from "../timetable/logic";
import {
  buildSchedule,
  type ChangeKind,
  type ClassBreak,
  type ClassChange,
  type DateRange,
  findOccurrence,
  type Occurrence,
  occurrenceKey,
  parseOccurrenceKey,
  type ScheduleInput,
} from "./occurrences";
import type { AttendanceStatus } from "./schema";

type ChangeRow = {
  id: string;
  kind: string;
  course_id: string;
  slot_id: string | null;
  original_date: string | null;
  new_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  label: string | null;
  note: string | null;
  courses: {
    id: string;
    name: string;
    code: string | null;
    color: string;
    room: string | null;
    archived_at: string | null;
  } | null;
};

const CHANGE_COLUMNS =
  "id, kind, course_id, slot_id, original_date, new_date, start_time, end_time, location, label, note, courses(id, name, code, color, room, archived_at)";

function toChange(row: ChangeRow): ClassChange {
  const c = row.courses;
  return {
    id: row.id,
    kind: row.kind as ChangeKind,
    courseId: row.course_id,
    slotId: row.slot_id,
    originalDate: row.original_date,
    newDate: row.new_date,
    startTime: row.start_time ? trimSeconds(row.start_time) : null,
    endTime: row.end_time ? trimSeconds(row.end_time) : null,
    location: row.location,
    label: row.label,
    note: row.note,
    // Archived courses are out of the timetable, extras included.
    course: c && !c.archived_at ? { id: c.id, name: c.name, code: c.code, color: c.color, room: c.room } : null,
  };
}

function assertRange(range: DateRange) {
  if (!isCivilDate(range.from) || !isCivilDate(range.to)) throw new Error("Invalid schedule range");
}

/**
 * Everything `buildSchedule` needs for a date range: active slots, the changes
 * that touch the range (by original OR new date), and breaks overlapping it.
 * Cached per request, so several widgets asking for the same range share one load.
 */
export const getScheduleInput = cache(async (from: CivilDate, to: CivilDate): Promise<ScheduleInput> => {
  assertRange({ from, to });
  const supabase = await createClient();
  const [slots, changes, breaks] = await Promise.all([
    listActiveSlots(),
    supabase
      .from("class_changes")
      .select(CHANGE_COLUMNS)
      // Dates are validated above, so they're safe inside the filter string.
      .or(`and(original_date.gte.${from},original_date.lte.${to}),and(new_date.gte.${from},new_date.lte.${to})`),
    supabase.from("class_breaks").select("id, label, starts_on, ends_on").lte("starts_on", to).gte("ends_on", from),
  ]);
  if (changes.error) throw new Error(`Couldn't load schedule changes: ${changes.error.message}`);
  if (breaks.error) throw new Error(`Couldn't load breaks: ${breaks.error.message}`);
  return {
    slots,
    changes: (changes.data as unknown as ChangeRow[]).map(toChange),
    breaks: breaks.data.map((b) => ({ id: b.id, label: b.label, startsOn: b.starts_on, endsOn: b.ends_on })),
  };
});

/** The real classes in a date range (inclusive): the one place screens get their schedule from. */
export async function getSchedule(range: DateRange): Promise<Occurrence[]> {
  return buildSchedule(await getScheduleInput(range.from, range.to), range);
}

/**
 * One occurrence by key ("s.<slot>.<date>" or "x.<change>"), with the schedule
 * built around it so a moved class is found at its new date. Null if the key
 * is malformed, not the user's, or doesn't happen on that date.
 */
export async function getOccurrence(key: string): Promise<Occurrence | null> {
  const parsed = parseOccurrenceKey(key);
  if (!parsed) return null;
  const supabase = await createClient();
  let span: DateRange;
  if (parsed.kind === "slot") {
    const { data } = await supabase
      .from("class_changes")
      .select("new_date")
      .eq("slot_id", parsed.slotId)
      .eq("original_date", parsed.date)
      .maybeSingle();
    const other = data?.new_date ?? parsed.date;
    span = other < parsed.date ? { from: other, to: parsed.date } : { from: parsed.date, to: other };
  } else {
    const { data } = await supabase.from("class_changes").select("new_date").eq("id", parsed.changeId).maybeSingle();
    if (!data?.new_date) return null;
    span = { from: data.new_date, to: data.new_date };
  }
  const occurrences = await getSchedule(span);
  return findOccurrence(occurrences, key);
}

/** Breaks that end today or later, soonest first. */
export async function listUpcomingBreaks(today: CivilDate): Promise<ClassBreak[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_breaks")
    .select("id, label, starts_on, ends_on")
    .gte("ends_on", today)
    .order("starts_on");
  if (error) throw new Error(`Couldn't load breaks: ${error.message}`);
  return data.map((b) => ({ id: b.id, label: b.label, startsOn: b.starts_on, endsOn: b.ends_on }));
}

/** Today and the next `days` days. */
export function rangeFrom(today: CivilDate, days: number): DateRange {
  return { from: today, to: addDays(today, days) };
}

/** Attendance marks, keyed by occurrence key ("s.<slot>.<date>" / "x.<change>"). Optionally for one course. */
export async function listAttendanceMarks(courseId?: string): Promise<Map<string, AttendanceStatus>> {
  const supabase = await createClient();
  let query = supabase.from("attendance").select("slot_id, occurs_on, change_id, status");
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) throw new Error(`Couldn't load attendance: ${error.message}`);
  const marks = new Map<string, AttendanceStatus>();
  for (const row of data) {
    const key = row.slot_id && row.occurs_on ? occurrenceKey(row.slot_id, row.occurs_on) : `x.${row.change_id}`;
    marks.set(key, row.status as AttendanceStatus);
  }
  return marks;
}
