import "server-only";
import { io } from "next/cache";
import { cache } from "react";
import { addDays, type CivilDate, isCivilDate, minutesNowIn, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { listActiveSlots, listCourses } from "../courses/queries";
import { getSettings } from "../settings/queries";
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
  projectCourseEnd,
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
/** Slots, changes and breaks for a range, as stored (no course ends applied). */
const loadInput = cache(async (from: CivilDate, to: CivilDate): Promise<ScheduleInput> => {
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

/**
 * The last day of each course that has a meeting count: the day its last
 * meeting was logged, or, projected, the day of the class that will be its
 * last meeting (cancelled and moved classes and breaks taken into account).
 * Missing for open-ended courses and ends more than ~2 years out.
 */
const getCourseEnds = cache(async (): Promise<Map<string, CivilDate>> => {
  const [log, courses, { preferences }] = await Promise.all([getMeetingLog(), listCourses(), getSettings()]);
  const ends = new Map<string, CivilDate>();
  const counted = courses.filter((c) => !c.archivedAt && c.totalMeetings !== null);
  const open = counted.filter((c) => {
    const p = log.progress.get(c.id);
    if (p?.finished && p.endedOn) ends.set(c.id, p.endedOn);
    return p && !p.finished;
  });
  if (open.length === 0) return ends;
  await io();
  const today = todayIn(preferences.timeZone, new Date());
  // From the earliest moment counting started (classes before it take no number), at most ~6 months back.
  const floor = addDays(today, -180);
  const earliest = open.map((c) => log.progress.get(c.id)?.countFrom?.date ?? floor).sort()[0];
  // "YYYY-MM-DD" strings sort as dates: the later of the two.
  const start = [earliest, floor].sort()[1];
  const endLimit = addDays(start, 790);
  const openIds = open.map((c) => c.id);
  const supabase = await createClient();
  const [slots, changesRes, breaksRes] = await Promise.all([
    listActiveSlots(),
    supabase
      .from("class_changes")
      .select(CHANGE_COLUMNS)
      .in("course_id", openIds)
      .or(
        `and(original_date.gte.${start},original_date.lte.${endLimit}),and(new_date.gte.${start},new_date.lte.${endLimit})`,
      ),
    supabase
      .from("class_breaks")
      .select("id, label, starts_on, ends_on")
      .lte("starts_on", endLimit)
      .gte("ends_on", start),
  ]);
  if (changesRes.error) throw new Error(`Couldn't load schedule changes: ${changesRes.error.message}`);
  if (breaksRes.error) throw new Error(`Couldn't load breaks: ${breaksRes.error.message}`);
  const allChanges = (changesRes.data as unknown as ChangeRow[]).map(toChange);
  const breaks: ClassBreak[] = breaksRes.data.map((b) => ({
    id: b.id,
    label: b.label,
    startsOn: b.starts_on,
    endsOn: b.ends_on,
  }));
  const marked = new Set(log.marks.keys());
  for (const c of open) {
    const progress = log.progress.get(c.id);
    if (!progress) continue;
    const courseStart = [progress.countFrom?.date ?? floor, floor].sort()[1];
    const end = projectCourseEnd(
      slots.filter((s) => s.courseId === c.id),
      allChanges.filter((ch) => ch.courseId === c.id),
      breaks,
      progress,
      marked,
      courseStart,
    );
    if (end) ends.set(c.id, end);
  }
  return ends;
});

/**
 * Everything `buildSchedule` needs for a date range: active slots, the changes
 * that touch the range (by original OR new date), breaks overlapping it, and
 * where each counted course ends (rule 6 in occurrences.ts). Cached per
 * request, so several widgets asking for the same range share one load.
 */
export const getScheduleInput = cache(async (from: CivilDate, to: CivilDate): Promise<ScheduleInput> => {
  const [input, ends] = await Promise.all([loadInput(from, to), getCourseEnds()]);
  const ended = (course: ScheduleCourse): ScheduleCourse => {
    const endsAfter = ends.get(course.id);
    return endsAfter ? { ...course, endsAfter } : course;
  };
  return {
    ...input,
    slots: input.slots.map((s) => ({ ...s, course: ended(s.course) })),
    changes: input.changes.map((c) => (c.course ? { ...c, course: ended(c.course) } : c)),
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
  const [{ data, error }, { data: moves, error: movesError }, courses, { preferences }] = await Promise.all([
    supabase
      .from("attendance")
      .select("course_id, slot_id, occurs_on, change_id, status, meeting_number, class_changes(new_date)"),
    supabase
      .from("class_changes")
      .select("slot_id, original_date, new_date")
      .eq("kind", "moved")
      .not("slot_id", "is", null)
      .not("original_date", "is", null)
      .not("new_date", "is", null),
    listCourses(),
    getSettings(),
  ]);
  if (error) throw new Error(`Couldn't load attendance: ${error.message}`);
  if (movesError) throw new Error(`Couldn't load moved classes: ${movesError.message}`);
  const movedDate = new Map<string, CivilDate>();
  for (const m of moves ?? []) {
    if (m.slot_id && m.original_date && m.new_date) {
      movedDate.set(occurrenceKey(m.slot_id, m.original_date), m.new_date);
    }
  }
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
      date: (key ? movedDate.get(key) : undefined) ?? row.occurs_on ?? row.class_changes?.new_date ?? null,
    });
    if (key && status !== "unknown") marks.set(key, { status, number: row.meeting_number });
  }
  // When counting started, as a moment in the user's zone.
  const zone = preferences.timeZone;
  const withStart = courses.map((c) => {
    const at = c.meetingsCountedFrom ? new Date(c.meetingsCountedFrom) : null;
    return { ...c, countFrom: at ? { date: todayIn(zone, at), minute: minutesNowIn(zone, at) } : null };
  });
  return { rows, marks, progress: progressByCourse(rows, withStart) };
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
