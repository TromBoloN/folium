import { TZDate } from "@date-fns/tz";
import { addDays, type CivilDate, formatDate, todayIn } from "@/lib/dates";
import { EN, type I18n } from "@/lib/i18n/core";
import { formatTime, type WeekStart, weekDates } from "../timetable/logic";

/**
 * Deadlines are a date with an optional time, interpreted in the user's time zone.
 * A date-only deadline is stored as the last millisecond of that day there, so a
 * single instant (due_at) drives sorting and overdue checks for both kinds.
 */

export type Due = { dueAt: string | null; dueHasTime: boolean };

/** How many days after today still count as "due soon". */
export const SOON_DAYS = 2;

function parts(date: CivilDate) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** Local date + optional "HH:MM" in `timeZone` -> UTC ISO instant. No time = end of that day. */
export function dueAtFrom(date: CivilDate, time: string | null, timeZone: string): string {
  const { y, m, d } = parts(date);
  const local = time
    ? new TZDate(y, m, d, Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0, timeZone)
    : new TZDate(y, m, d, 23, 59, 59, 999, timeZone);
  return new Date(local.getTime()).toISOString();
}

/** UTC instant -> the local date (and "HH:MM" if the deadline has a time), for forms and labels. */
export function dueParts(dueAt: string, hasTime: boolean, timeZone: string): { date: CivilDate; time: string | null } {
  const local = new TZDate(new Date(dueAt).getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
  return { date, time: hasTime ? `${pad(local.getHours())}:${pad(local.getMinutes())}` : null };
}

/** Start (00:00:00.000) and end (23:59:59.999) of a local date, as UTC instants. */
export function dayBounds(date: CivilDate, timeZone: string): { start: string; end: string } {
  const { y, m, d } = parts(date);
  return {
    start: new Date(new TZDate(y, m, d, 0, 0, 0, 0, timeZone).getTime()).toISOString(),
    end: new Date(new TZDate(y, m, d, 23, 59, 59, 999, timeZone).getTime()).toISOString(),
  };
}

export type DueState = "none" | "overdue" | "today" | "soon" | "later";

/**
 * Where a deadline stands right now. Done tasks are never overdue.
 * A timed deadline earlier today that has passed is overdue, not "today".
 */
export function dueState(task: Due & { status: string }, now: Date, timeZone: string): DueState {
  if (!task.dueAt || task.status === "done") return "none";
  if (new Date(task.dueAt).getTime() < now.getTime()) return "overdue";
  const today = todayIn(timeZone, now);
  const { date } = dueParts(task.dueAt, task.dueHasTime, timeZone);
  if (date === today) return "today";
  if (date <= addDays(today, SOON_DAYS)) return "soon";
  return "later";
}

export const DUE_WINDOWS = ["overdue", "today", "week"] as const;
export type DueWindow = (typeof DUE_WINDOWS)[number];

/**
 * The due_at range for a list filter. `before` is exclusive, the rest inclusive.
 * - overdue: due before now (the caller also excludes done tasks)
 * - today:   due at any time today
 * - week:    due from today through the last day of this week (user's week start)
 */
export function dueWindowRange(
  window: DueWindow,
  now: Date,
  timeZone: string,
  weekStart: WeekStart,
): { from?: string; to?: string; before?: string } {
  const today = todayIn(timeZone, now);
  switch (window) {
    case "overdue":
      return { before: now.toISOString() };
    case "today": {
      const { start, end } = dayBounds(today, timeZone);
      return { from: start, to: end };
    }
    case "week": {
      const lastDay = weekDates(today, weekStart)[6];
      return { from: dayBounds(today, timeZone).start, to: dayBounds(lastDay, timeZone).end };
    }
  }
}

/** "Today", "Tomorrow 14:00", "Yesterday", "Mon 23 Nov", "3 Jan 2027 09:00". */
export function formatDue(
  due: Due,
  now: Date,
  timeZone: string,
  timeFormat: "24h" | "12h",
  { t, intl }: I18n = EN,
): string | null {
  if (!due.dueAt) return null;
  const { date, time } = dueParts(due.dueAt, due.dueHasTime, timeZone);
  const today = todayIn(timeZone, now);
  let day: string;
  if (date === today) day = t("Today");
  else if (date === addDays(today, 1)) day = t("Tomorrow");
  else if (date === addDays(today, -1)) day = t("Yesterday");
  else if (date.slice(0, 4) === today.slice(0, 4))
    day = formatDate(date, { weekday: "short", day: "numeric", month: "short" }, intl);
  else day = formatDate(date, { day: "numeric", month: "short", year: "numeric" }, intl);
  return time ? `${day} ${formatTime(time, timeFormat)}` : day;
}

export const PRIORITY_RANK = { low: 0, medium: 1, high: 2, urgent: 3 } as const;

/** Earliest deadline first (no deadline last), then higher priority, then oldest. */
export function compareTasks(
  a: Due & { priority: keyof typeof PRIORITY_RANK; createdAt: string },
  b: Due & { priority: keyof typeof PRIORITY_RANK; createdAt: string },
): number {
  if (a.dueAt !== b.dueAt) {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    const diff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (diff !== 0) return diff;
  }
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.createdAt.localeCompare(b.createdAt);
}

/**
 * Counts for the tasks summary strip, over open tasks: overdue now, due today
 * (still ahead), and due from now through the end of this week (today included).
 */
export function dueSummary(
  tasks: readonly (Due & { status: string })[],
  now: Date,
  timeZone: string,
  weekStart: WeekStart,
): { overdue: number; today: number; week: number } {
  const lastDay = weekDates(todayIn(timeZone, now), weekStart)[6];
  let overdue = 0;
  let today = 0;
  let week = 0;
  for (const t of tasks) {
    const state = dueState(t, now, timeZone);
    if (state === "overdue") overdue++;
    if (state === "today") today++;
    if ((state === "today" || state === "soon" || state === "later") && t.dueAt) {
      if (dueParts(t.dueAt, t.dueHasTime, timeZone).date <= lastDay) week++;
    }
  }
  return { overdue, today, week };
}

export const RESCHEDULE_CHOICES = ["today", "tomorrow", "next-week"] as const;
export type RescheduleChoice = (typeof RESCHEDULE_CHOICES)[number];

/** The local date a quick reschedule moves a task to. "next-week" is the first day of next week. */
export function rescheduleDate(choice: RescheduleChoice, today: CivilDate, weekStart: WeekStart): CivilDate {
  if (choice === "today") return today;
  if (choice === "tomorrow") return addDays(today, 1);
  return addDays(weekDates(today, weekStart)[0], 7);
}

/**
 * Moving a deadline to another day keeps its time of day, unless that time has
 * already passed on the new day (moving an overdue 07:00 task to "today" in the
 * afternoon would leave it overdue): then it becomes "by the end of the day".
 */
export function movedDue(
  due: Due,
  date: CivilDate,
  now: Date,
  timeZone: string,
): { dueAt: string; dueHasTime: boolean } {
  const time = due.dueAt && due.dueHasTime ? dueParts(due.dueAt, true, timeZone).time : null;
  if (time) {
    const at = dueAtFrom(date, time, timeZone);
    if (new Date(at).getTime() > now.getTime()) return { dueAt: at, dueHasTime: true };
  }
  return { dueAt: dueAtFrom(date, null, timeZone), dueHasTime: false };
}
