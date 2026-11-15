import type { CivilDate } from "@/lib/dates";
import { dueParts } from "../tasks/due";
import { appliesOn, type SlotTiming, sortSlots, toMinutes } from "../timetable/logic";

/**
 * Pure calculations behind the Today page's live widgets (hero, day timeline,
 * week strip). Minutes are minutes since local midnight in the user's zone.
 */

// --- Next up (hero) -------------------------------------------------------

export type NextUp<T extends SlotTiming> =
  | { kind: "now"; slot: T; minutesLeft: number; progress: number; after: T | null }
  | { kind: "next"; slot: T; minutesUntil: number; after: T | null }
  | { kind: "tomorrow"; slot: T }
  | { kind: "none" };

/**
 * What the hero shows: the class on now (the earliest-ending one if several
 * overlap), else the next class today, else tomorrow's first class, else nothing.
 * `after` is the class after it today, if any.
 */
export function nextUp<T extends SlotTiming>(
  today: readonly T[],
  tomorrow: readonly T[],
  nowMinute: number,
): NextUp<T> {
  const sorted = sortSlots(today);
  const current = sorted
    .filter((s) => toMinutes(s.startTime) <= nowMinute && nowMinute < toMinutes(s.endTime))
    .sort((a, b) => toMinutes(a.endTime) - toMinutes(b.endTime))[0];
  if (current) {
    const start = toMinutes(current.startTime);
    const end = toMinutes(current.endTime);
    return {
      kind: "now",
      slot: current,
      minutesLeft: end - nowMinute,
      progress: (nowMinute - start) / (end - start),
      after: sorted.find((s) => toMinutes(s.startTime) >= end) ?? null,
    };
  }
  const nextIndex = sorted.findIndex((s) => toMinutes(s.startTime) > nowMinute);
  if (nextIndex !== -1) {
    const slot = sorted[nextIndex];
    return {
      kind: "next",
      slot,
      minutesUntil: toMinutes(slot.startTime) - nowMinute,
      after: sorted[nextIndex + 1] ?? null,
    };
  }
  const first = sortSlots(tomorrow)[0];
  return first ? { kind: "tomorrow", slot: first } : { kind: "none" };
}

/** 25 -> "25 min", 60 -> "1 h", 85 -> "1 h 25 min". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** "in 25 min" before a class, "Now, ends in 40 min" during one. */
export function countdownText(moment: { kind: "now"; minutesLeft: number } | { kind: "next"; minutesUntil: number }) {
  if (moment.kind === "now") return `Now, ends in ${formatDuration(moment.minutesLeft)}`;
  return moment.minutesUntil <= 0 ? "Starting now" : `in ${formatDuration(moment.minutesUntil)}`;
}

// --- Day timeline ---------------------------------------------------------

export type TimelineRange = { start: number; end: number };

/** Whole hours around today's classes, at least three hours tall. Null with no classes. */
export function timelineRange(slots: readonly SlotTiming[]): TimelineRange | null {
  if (slots.length === 0) return null;
  const start = Math.floor(Math.min(...slots.map((s) => toMinutes(s.startTime))) / 60) * 60;
  let end = Math.ceil(Math.max(...slots.map((s) => toMinutes(s.endTime))) / 60) * 60;
  if (end - start < 180) end = Math.min(24 * 60, start + 180);
  return { start, end };
}

/** A class's top and height as percentages of the timeline. */
export function timelinePosition(slot: SlotTiming, range: TimelineRange): { top: number; height: number } {
  const span = range.end - range.start;
  const start = Math.max(range.start, toMinutes(slot.startTime));
  const end = Math.min(range.end, toMinutes(slot.endTime));
  return { top: ((start - range.start) / span) * 100, height: (Math.max(0, end - start) / span) * 100 };
}

/** Where the "now" line sits, as a percentage of the timeline; null outside the range. */
export function nowOffset(nowMinute: number, range: TimelineRange): number | null {
  if (nowMinute < range.start || nowMinute > range.end) return null;
  return ((nowMinute - range.start) / (range.end - range.start)) * 100;
}

// --- Week strip -----------------------------------------------------------

export type LoadSlot = SlotTiming & { courseId: string; course: { color: string; name: string } };
export type LoadTask = { dueAt: string | null; dueHasTime: boolean; status: string };

export type DayLoad = {
  date: CivilDate;
  isToday: boolean;
  classes: { id: string; color: string; name: string }[];
  classMinutes: number;
  deadlines: number;
  /** 0 (free) to 4 (heavy): drives the shading. */
  intensity: 0 | 1 | 2 | 3 | 4;
};

/** Load score in "hours": class time plus 1.5 h per open deadline. */
export function loadIntensity(classMinutes: number, deadlines: number): DayLoad["intensity"] {
  const score = classMinutes / 60 + deadlines * 1.5;
  if (score === 0) return 0;
  if (score <= 2) return 1;
  if (score <= 4) return 2;
  if (score <= 6.5) return 3;
  return 4;
}

/**
 * Classes and open deadlines per day for the given dates. A deadline counts on
 * its local date in `timeZone` (not its UTC date), and done tasks don't count.
 */
export function weekLoad(
  dates: readonly CivilDate[],
  slots: readonly LoadSlot[],
  tasks: readonly LoadTask[],
  timeZone: string,
  today: CivilDate,
): DayLoad[] {
  const deadlinesByDate = new Map<CivilDate, number>();
  for (const t of tasks) {
    if (!t.dueAt || t.status === "done") continue;
    const { date } = dueParts(t.dueAt, t.dueHasTime, timeZone);
    deadlinesByDate.set(date, (deadlinesByDate.get(date) ?? 0) + 1);
  }
  return dates.map((date) => {
    const classes = sortSlots(slots.filter((s) => appliesOn(s, date)));
    const classMinutes = classes.reduce((sum, s) => sum + toMinutes(s.endTime) - toMinutes(s.startTime), 0);
    const deadlines = deadlinesByDate.get(date) ?? 0;
    return {
      date,
      isToday: date === today,
      classes: classes.map((s) => ({ id: s.id, color: s.course.color, name: s.course.name })),
      classMinutes,
      deadlines,
      intensity: loadIntensity(classMinutes, deadlines),
    };
  });
}
