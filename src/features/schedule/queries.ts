import "server-only";
import { cache } from "react";
import { addDays, type CivilDate, isCivilDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { listActiveSlots, listCourses } from "../courses/queries";
import { trimSeconds } from "../timetable/logic";
import { type MeetingProgress, type MeetingRow, type MeetingStatus, progressByCourse } from "./meetings";
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
  type ScheduleCourse,
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
    lecturer: string | null;
    archived_at: string | null;
  } | null;
};

const CHANGE_COLUMNS =
  "id, kind, course_id, slot_id, original_date, new_date, start_time, end_time, location, label, note, courses(id, name, code, color, room, lecturer, archived_at)";

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
    course:
      c && !c.archived_at
        ? { id: c.id, name: c.name, code: c.code, color: c.color, room: c.room, lecturer: c.lecturer }
        : null,
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
  const [rawSlots, changes, breaks, log] = await Promise.all([
    listActiveSlots(),
    supabase
      .from("class_changes")
      .select(CHANGE_COLUMNS)
      // Dates are validated above, so they're safe inside the filter string.
      .or(`and(original_date.gte.${from},original_date.lte.${to}),and(new_date.gte.${from},new_date.lte.${to})`),
    supabase.from("class_breaks").select("id, label, starts_on, ends_on").lte("starts_on", to).gte("ends_on", from),
    getMeetingLog(),
  ]);
  if (changes.error) throw new Error(`Couldn't load schedule changes: ${changes.error.message}`);
  if (breaks.error) throw new Error(`Couldn't load breaks: ${breaks.error.message}`);
  // A course whose meetings are all logged ends after its last one (rule 6 in occurrences.ts).
  const ended = (course: ScheduleCourse): ScheduleCourse => {
    const endsAfter = log.progress.get(course.id)?.endedOn ?? null;
    return endsAfter ? { ...course, endsAfter } : course;
  };
  const slots = rawSlots.map((s) => ({ ...s, course: ended(s.course) }));
  return {
    slots,
    changes: (changes.data as unknown as ChangeRow[])
      .map(toChange)
      .map((c) => (c.course ? { ...c, course: ended(c.course) } : c)),
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

/**
 * Classes rescheduled without a new date yet (oldest first): what the "Waiting
 * for a new date" list offers to set or cancel. Built through the schedule,
 * like every other screen, so a stale change (slot ended) drops out.
 */
export async function listPostponed(): Promise<Occurrence[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_changes")
    .select("original_date")
    .eq("kind", "postponed")
    .order("original_date")
    .limit(50);
  if (error) throw new Error(`Couldn't load rescheduled classes: ${error.message}`);
  const dates = data.map((d) => d.original_date).filter((d): d is string => Boolean(d));
  if (dates.length === 0) return [];
  const occurrences = await getSchedule({ from: dates[0], to: dates[dates.length - 1] });
  return occurrences.filter((o) => o.status === "postponed");
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

export type MeetingLog = {
  rows: MeetingRow[];
  /** Real marks (attended / missed) with their meeting number, keyed by occurrence key. */
  marks: Map<string, { status: AttendanceStatus; number: number | null }>;
  /** Per course (every course, archived too). */
  progress: Map<string, MeetingProgress>;
};

/** The whole meeting log (attendance rows) and each course's progress. Cached per request. */
export const getMeetingLog = cache(async (): Promise<MeetingLog> => {
  const supabase = await createClient();
  const [{ data, error }, courses] = await Promise.all([
    supabase
      .from("attendance")
      .select("course_id, slot_id, occurs_on, change_id, status, meeting_number, class_changes(new_date)"),
    listCourses(),
  ]);
  if (error) throw new Error(`Couldn't load attendance: ${error.message}`);
  const rows: MeetingRow[] = [];
  const marks: MeetingLog["marks"] = new Map();
  for (const row of data as unknown as {
    course_id: string;
    slot_id: string | null;
    occurs_on: string | null;
    change_id: string | null;
    status: string;
    meeting_number: number | null;
    class_changes: { new_date: string | null } | null;
  }[]) {
    const status = row.status as MeetingStatus;
    const key =
      row.slot_id && row.occurs_on
        ? occurrenceKey(row.slot_id, row.occurs_on)
        : row.change_id
          ? `x.${row.change_id}`
          : null;
    rows.push({
      courseId: row.course_id,
      number: row.meeting_number,
      status,
      key,
      date: row.occurs_on ?? row.class_changes?.new_date ?? null,
    });
    if (key && status !== "unknown") marks.set(key, { status, number: row.meeting_number });
  }
  return { rows, marks, progress: progressByCourse(rows, courses) };
});

/** Attendance marks (attended / missed), keyed by occurrence key. Optionally for one course. */
export async function listAttendanceMarks(courseId?: string): Promise<Map<string, AttendanceStatus>> {
  const log = await getMeetingLog();
  const marks = new Map<string, AttendanceStatus>();
  for (const row of log.rows) {
    if (!row.key || row.status === "unknown" || (courseId && row.courseId !== courseId)) continue;
    marks.set(row.key, row.status);
  }
  return marks;
}
