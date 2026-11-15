import { addDays, type CivilDate, formatDate } from "@/lib/dates";
import { appliesOn, findConflicts, formatTime, layoutDay, toMinutes, type WeekStart, weekDates } from "./logic";
import type { TimetableSlot } from "./types";

export type WeekItem = {
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
};

export type WeekDay = {
  date: CivilDate;
  shortLabel: string;
  dayNumber: string;
  fullLabel: string;
  isToday: boolean;
  items: WeekItem[];
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

function courseTitle(slot: TimetableSlot) {
  return slot.course.code ?? slot.course.name;
}

function weekLabel(first: CivilDate, last: CivilDate): string {
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const sameMonth = sameYear && first.slice(5, 7) === last.slice(5, 7);
  if (sameMonth)
    return `${formatDate(first, { day: "numeric" })}–${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`;
  const start = formatDate(
    first,
    sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" },
  );
  return `${start} – ${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function buildWeek(
  slots: readonly TimetableSlot[],
  options: { anchor: CivilDate; today: CivilDate; weekStart: WeekStart; timeFormat: "24h" | "12h" },
): Week {
  const dates = weekDates(options.anchor, options.weekStart);
  let firstHour = 8;
  let lastHour = 17;

  const days = dates.map((date): WeekDay => {
    const todays = slots.filter((s) => appliesOn(s, date));
    const conflicts = findConflicts(todays);
    const items = layoutDay(todays).map(({ slot, lane, lanes }): WeekItem => {
      const startMinute = toMinutes(slot.startTime);
      const endMinute = toMinutes(slot.endTime);
      firstHour = Math.min(firstHour, Math.floor(startMinute / 60));
      lastHour = Math.max(lastHour, Math.ceil(endMinute / 60));
      const others = conflicts.get(slot.id) ?? [];
      return {
        id: slot.id,
        courseId: slot.courseId,
        title: courseTitle(slot),
        courseName: slot.course.name,
        color: slot.course.color,
        timeLabel: `${formatTime(slot.startTime, options.timeFormat)}–${formatTime(slot.endTime, options.timeFormat)}`,
        location: slot.location ?? slot.course.room,
        startMinute,
        endMinute,
        lane,
        lanes,
        overlapsWith: [...new Set(others.map(courseTitle))],
      };
    });
    return {
      date,
      shortLabel: formatDate(date, { weekday: "short" }),
      dayNumber: formatDate(date, { day: "numeric" }),
      fullLabel: formatDate(date, { weekday: "long", day: "numeric", month: "long" }),
      isToday: date === options.today,
      items,
    };
  });

  return {
    days,
    label: weekLabel(dates[0], dates[6]),
    previous: addDays(dates[0], -7),
    next: addDays(dates[0], 7),
    containsToday: dates.includes(options.today),
    firstHour,
    lastHour,
  };
}
