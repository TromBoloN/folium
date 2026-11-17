import type { CivilDate } from "@/lib/dates";
import { toMinutes } from "../timetable/logic";

/**
 * The meeting log. Every class the student marks is logged with its meeting
 * number (attended or skipped, "missed" in the database). Meetings before the
 * student started counting are logged as "unknown". A cancelled class is a
 * schedule change, never a log row, so it never takes a number.
 *
 * "Currently at meeting X" is the next unlogged number. A course with a total
 * is finished once its last meeting is logged; its classes stop after that day.
 */

export type MeetingStatus = "attended" | "missed" | "unknown";

/** A moment in the user's zone. */
export type ClockPoint = { date: CivilDate; minute: number };

/**
 * Whether a class belongs to the counted part of a course: it ended after
 * counting started ("next meeting is 15" was set). Earlier classes are the
 * backfilled unknown meetings, so they're never asked about or numbered again.
 */
export function isCounted(o: { date: CivilDate; endTime: string }, from: ClockPoint | null): boolean {
  if (!from) return true;
  return o.date > from.date || (o.date === from.date && toMinutes(o.endTime) > from.minute);
}

export type MeetingRow = {
  courseId: string;
  number: number | null;
  status: MeetingStatus;
  /** The class it marks (occurrence key); null for unknown meetings. */
  key: string | null;
  /** When the class was; null for unknown meetings. */
  date: CivilDate | null;
};

export type MeetingProgress = {
  /** The next meeting to log (1-based). */
  next: number;
  /** Null = open-ended. */
  total: number | null;
  attended: number;
  missed: number;
  unknown: number;
  /** Every meeting is logged. */
  finished: boolean;
  /** Finished: the day of the last meeting (classes after it drop out). Null if unknown. */
  endedOn: CivilDate | null;
  /** When counting started; null = count every class. */
  countFrom: ClockPoint | null;
};

export function meetingProgress(
  rows: readonly MeetingRow[],
  total: number | null,
  countFrom: ClockPoint | null = null,
): MeetingProgress {
  let last: MeetingRow | null = null;
  let attended = 0;
  let missed = 0;
  let unknown = 0;
  for (const r of rows) {
    if (r.status === "attended") attended++;
    else if (r.status === "missed") missed++;
    else unknown++;
    if (r.number !== null && (last === null || r.number > (last.number ?? 0))) last = r;
  }
  const next = (last?.number ?? 0) + 1;
  const finished = total !== null && next > total;
  return {
    next,
    total,
    attended,
    missed,
    unknown,
    finished,
    endedOn: finished ? (last?.date ?? null) : null,
    countFrom,
  };
}

/** Per course, from all of the user's log rows. Courses without rows start at meeting 1. */
export function progressByCourse(
  rows: readonly MeetingRow[],
  courses: readonly { id: string; totalMeetings: number | null; countFrom?: ClockPoint | null }[],
): Map<string, MeetingProgress> {
  const byCourse = new Map<string, MeetingRow[]>();
  for (const r of rows) byCourse.set(r.courseId, [...(byCourse.get(r.courseId) ?? []), r]);
  return new Map(
    courses.map((c) => [c.id, meetingProgress(byCourse.get(c.id) ?? [], c.totalMeetings, c.countFrom ?? null)]),
  );
}

/**
 * How many more classes can be skipped and still meet the attendance target
 * (a share of ALL meetings, as campuses define it). Null until the course has a
 * total and at least one real mark. Unknown meetings aren't counted as skips.
 */
export function skipsLeft(progress: MeetingProgress, targetPercent: number): number | null {
  if (progress.total === null || progress.attended + progress.missed === 0) return null;
  const allowed = Math.floor(progress.total * (1 - targetPercent / 100) + 1e-9);
  return allowed - progress.missed;
}

/**
 * The meeting number each unmarked class will log, in date order per course:
 * two unmarked classes of one course are meeting 7 and 8, not both 7.
 * `classes` must be sorted by date and time (the schedule's order).
 */
export function upcomingNumbers(
  classes: readonly { key: string; courseId: string; date: CivilDate; endTime: string }[],
  progress: ReadonlyMap<string, MeetingProgress>,
  marked: ReadonlySet<string>,
): Map<string, number> {
  const offset = new Map<string, number>();
  const out = new Map<string, number>();
  for (const c of classes) {
    if (marked.has(c.key)) continue;
    const p = progress.get(c.courseId);
    if (!p || !isCounted(c, p.countFrom)) continue;
    const n = p.next + (offset.get(c.courseId) ?? 0);
    if (p.total !== null && n > p.total) continue;
    out.set(c.key, n);
    offset.set(c.courseId, (offset.get(c.courseId) ?? 0) + 1);
  }
  return out;
}

/** Serialisable meeting info for a class: its number and the course total. */
export type MeetingInfo = { number: number; total: number | null };

/**
 * The day of a course's last meeting, projected: every class still to log
 * (live, counted, unmarked; past or future) takes the next number, so the last
 * meeting is the one that reaches the total. Null when it isn't in `classes`
 * (open-ended, or further out). `classes` sorted by date, the course's only.
 */
export function projectedEnd(
  classes: readonly { key: string; date: CivilDate; endTime: string }[],
  progress: MeetingProgress,
  marked: ReadonlySet<string>,
): CivilDate | null {
  if (progress.total === null) return null;
  if (progress.finished) return progress.endedOn;
  let n = progress.next;
  for (const c of classes) {
    if (marked.has(c.key) || !isCounted(c, progress.countFrom)) continue;
    if (n === progress.total) return c.date;
    n++;
  }
  return null;
}

/** One row of a course's meeting list: a logged meeting, or a class waiting to be logged. */
export type MeetingListItem = {
  number: number | null;
  status: MeetingStatus | null;
  /** The class, when the meeting has one; null for meetings known only by number. */
  key: string | null;
  date: CivilDate | null;
};

/**
 * Every meeting so far, newest first: logged ones by number (with their date
 * when they have one) and counted classes that are over but not logged yet.
 * Meetings from before counting started have no date: none is guessed.
 */
export function meetingList(
  rows: readonly MeetingRow[],
  waiting: readonly { key: string; date: CivilDate }[],
): MeetingListItem[] {
  const logged = rows
    .filter((r) => r.number !== null)
    .map((r) => ({ number: r.number, status: r.status, key: r.key, date: r.date }));
  const loggedKeys = new Set(rows.map((r) => r.key).filter(Boolean));
  const open = waiting
    .filter((w) => !loggedKeys.has(w.key))
    .map((w) => ({ number: null, status: null, key: w.key, date: w.date }));
  return [...[...open].reverse(), ...logged.sort((a, b) => (b.number ?? 0) - (a.number ?? 0))];
}
