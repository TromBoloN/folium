import { addDays, type CivilDate, formatDate } from "@/lib/dates";
import { EN, type I18n } from "@/lib/i18n/core";
import { type Chip, durationLabel, occurrenceChips, placementLabel, timeRange } from "../schedule/format";
import {
  buildSchedule,
  type DateRange,
  isListed,
  isLive,
  type Occurrence,
  type OccurrenceStatus,
  type ScheduleInput,
} from "../schedule/occurrences";
import type { AttendanceStatus } from "../schedule/schema";
import { findConflicts, layoutDay, toMinutes, type WeekStart, weekDates } from "./logic";

export type WeekItem = {
  /** The occurrence key: opens the class sheet. */
  id: string;
  courseId: string;
  title: string;
  courseName: string;
  color: string;
  timeLabel: string;
  location: string | null;
  startMinute: number;
  endMinute: number;
  lane: number;
  lanes: number;
  overlapsWith: string[];
  status: OccurrenceStatus;
  chips: Chip[];
  note: string | null;
  meetingUrl: string | null;
  /** Finished by the time the page was rendered. */
  past: boolean;
  code: string | null;
  lecturer: string | null;
  durationLabel: string;
  /** Took place and is over: can be marked attended or missed. */
  canMark: boolean;
  attendance: AttendanceStatus | null;
};

export type Ghost = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  movedToLabel: string;
  color: string;
};

export type WeekDay = {
  date: CivilDate;
  shortLabel: string;
  dayNumber: string;
  fullLabel: string;
  isToday: boolean;
  /** Listed classes: live ones and cancelled ones (dimmed). */
  items: WeekItem[];
  /** Where moved classes used to be (week grid only). */
  ghosts: Ghost[];
  /** Live classes (what "3 classes" counts). */
  classCount: number;
  /** Set when a break covers this day. */
  breakLabel: string | null;
  breakId: string | null;
  /** Cancelled classes (listed, not counted). */
  cancelledCount: number;
};

export type Week = {
  days: WeekDay[];
  label: string;
  previous: CivilDate;
  next: CivilDate;
  containsToday: boolean;
  /** Visible hours in the grid: at least 08:00–17:00, widened to fit every class. */
  firstHour: number;
  lastHour: number;
};

export type WeekOptions = {
  anchor: CivilDate;
  today: CivilDate;
  weekStart: WeekStart;
  timeFormat: "24h" | "12h";
  /** Minutes since midnight now (for dimming past classes); defaults to the start of the day. */
  nowMinute?: number;
  /** Attendance marks by occurrence key, for the quick attended/missed control. */
  marks?: ReadonlyMap<string, AttendanceStatus>;
  i18n?: I18n;
};

/** The dates the week containing `anchor` covers: what to load before `buildWeek`. */
export function weekRange(anchor: CivilDate, weekStart: WeekStart): DateRange {
  const dates = weekDates(anchor, weekStart);
  return { from: dates[0], to: dates[6] };
}

function courseTitle(o: Pick<Occurrence, "course">) {
  return o.course.code ?? o.course.name;
}

function weekLabel(first: CivilDate, last: CivilDate, intl: string): string {
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const sameMonth = sameYear && first.slice(5, 7) === last.slice(5, 7);
  if (sameMonth)
    return `${formatDate(first, { day: "numeric" }, intl)}–${formatDate(last, { day: "numeric", month: "short", year: "numeric" }, intl)}`;
  const start = formatDate(
    first,
    sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" },
    intl,
  );
  return `${start} – ${formatDate(last, { day: "numeric", month: "short", year: "numeric" }, intl)}`;
}

/** One week of the schedule, laid out for the week grid and the by-day list. */
export function buildWeek(input: ScheduleInput, options: WeekOptions): Week {
  const i18n = options.i18n ?? EN;
  const dates = weekDates(options.anchor, options.weekStart);
  const occurrences = buildSchedule(input, { from: dates[0], to: dates[6] });
  const nowMinute = options.nowMinute ?? 0;
  let firstHour = 8;
  let lastHour = 17;

  const days = dates.map((date): WeekDay => {
    const todays = occurrences.filter((o) => o.date === date);
    const listed = todays.filter(isListed);
    const live = todays.filter(isLive);
    // Overlaps only between classes that really happen.
    const conflicts = findConflicts(live);
    for (const o of todays) {
      firstHour = Math.min(firstHour, Math.floor(toMinutes(o.startTime) / 60));
      lastHour = Math.max(lastHour, Math.ceil(toMinutes(o.endTime) / 60));
    }
    const items = layoutDay(listed).map(({ slot: o, lane, lanes }): WeekItem => {
      const others = conflicts.get(o.key) ?? [];
      const past = date < options.today || (date === options.today && toMinutes(o.endTime) <= nowMinute);
      const canMark = past && isLive(o);
      return {
        code: o.course.code,
        lecturer: o.course.lecturer ?? null,
        durationLabel: durationLabel(o, i18n),
        canMark,
        attendance: canMark ? (options.marks?.get(o.key) ?? null) : null,
        id: o.key,
        courseId: o.courseId,
        title: courseTitle(o),
        courseName: o.course.name,
        color: o.course.color,
        timeLabel: timeRange(o, options.timeFormat),
        location: o.location,
        startMinute: toMinutes(o.startTime),
        endMinute: toMinutes(o.endTime),
        lane,
        lanes,
        overlapsWith: [...new Set(others.map(courseTitle))],
        status: o.status,
        chips: occurrenceChips(o, options.timeFormat, i18n),
        note: o.note,
        meetingUrl: o.meetingUrl,
        past,
      };
    });
    const ghosts = todays
      .filter((o) => o.status === "ghost" && o.movedTo)
      .map(
        (o): Ghost => ({
          id: o.key,
          title: courseTitle(o),
          startMinute: toMinutes(o.startTime),
          endMinute: toMinutes(o.endTime),
          movedToLabel: o.movedTo ? placementLabel(o.movedTo, options.timeFormat, date, i18n) : "",
          color: o.course.color,
        }),
      );
    const brk = input.breaks.find((b) => date >= b.startsOn && date <= b.endsOn);
    return {
      date,
      shortLabel: formatDate(date, { weekday: "short" }, i18n.intl),
      dayNumber: formatDate(date, { day: "numeric" }, i18n.intl),
      fullLabel: formatDate(date, { weekday: "long", day: "numeric", month: "long" }, i18n.intl),
      isToday: date === options.today,
      items,
      ghosts,
      classCount: live.length,
      breakLabel: brk?.label ?? null,
      breakId: brk?.id ?? null,
      cancelledCount: todays.filter((o) => o.status === "cancelled").length,
    };
  });

  return {
    days,
    label: weekLabel(dates[0], dates[6], i18n.intl),
    previous: addDays(dates[0], -7),
    next: addDays(dates[0], 7),
    containsToday: dates.includes(options.today),
    firstHour,
    lastHour,
  };
}
