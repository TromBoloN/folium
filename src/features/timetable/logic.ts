import { addDays, type CivilDate, isoWeekday } from "@/lib/dates";

/** The parts of a timetable slot the scheduling logic needs. Times are "HH:MM", local to the app's time zone. */
export type SlotTiming = {
  id: string;
  weekday: number; // ISO: 1 = Monday … 7 = Sunday
  startTime: string;
  endTime: string;
  startsOn: CivilDate | null;
  endsOn: CivilDate | null;
};

export const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
] as const;

export function weekdayLabel(weekday: number, form: "label" | "short" = "label"): string {
  return WEEKDAYS[weekday - 1]?.[form] ?? "";
}

/** "08:30" or "08:30:00" -> minutes since midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Postgres returns "08:30:00"; forms and logic use "08:30". */
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

export function formatTime(time: string, format: "24h" | "12h"): string {
  const minutes = toMinutes(time);
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  if (format === "24h") return `${String(h).padStart(2, "0")}:${m}`;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${suffix}`;
}

/** By weekday, then start, then end, then id (so the order is always stable). */
export function compareSlots(a: SlotTiming, b: SlotTiming): number {
  return (
    a.weekday - b.weekday ||
    toMinutes(a.startTime) - toMinutes(b.startTime) ||
    toMinutes(a.endTime) - toMinutes(b.endTime) ||
    a.id.localeCompare(b.id)
  );
}

export function sortSlots<T extends SlotTiming>(slots: readonly T[]): T[] {
  return [...slots].sort(compareSlots);
}

/** Whether a weekly slot happens on this date: right weekday, and inside its optional date range (inclusive). */
export function appliesOn(slot: SlotTiming, date: CivilDate): boolean {
  if (isoWeekday(date) !== slot.weekday) return false;
  if (slot.startsOn && date < slot.startsOn) return false;
  if (slot.endsOn && date > slot.endsOn) return false;
  return true;
}

/** Back-to-back classes (one ends at 10:00, the next starts at 10:00) don't overlap. */
export function timesOverlap(a: SlotTiming, b: SlotTiming): boolean {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

/** Open-ended ranges (null) extend forever in that direction. */
export function dateRangesIntersect(a: SlotTiming, b: SlotTiming): boolean {
  const aStartsAfterBEnds = a.startsOn && b.endsOn && a.startsOn > b.endsOn;
  const bStartsAfterAEnds = b.startsOn && a.endsOn && b.startsOn > a.endsOn;
  return !aStartsAfterBEnds && !bStartsAfterAEnds;
}

/** Two slots clash if they can ever happen at the same time on the same date. */
export function slotsConflict(a: SlotTiming, b: SlotTiming): boolean {
  return a.id !== b.id && a.weekday === b.weekday && timesOverlap(a, b) && dateRangesIntersect(a, b);
}

/** For each slot that clashes with something, the ids of what it clashes with. */
export function findConflicts<T extends SlotTiming>(slots: readonly T[]): Map<string, T[]> {
  const conflicts = new Map<string, T[]>();
  const sorted = sortSlots(slots);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (b.weekday !== a.weekday) break;
      if (toMinutes(b.startTime) >= toMinutes(a.endTime)) continue;
      if (!slotsConflict(a, b)) continue;
      conflicts.set(a.id, [...(conflicts.get(a.id) ?? []), b]);
      conflicts.set(b.id, [...(conflicts.get(b.id) ?? []), a]);
    }
  }
  return conflicts;
}

export type WeekStart = "monday" | "sunday" | "saturday";
const WEEK_START_ISO: Record<WeekStart, number> = { monday: 1, saturday: 6, sunday: 7 };

/** The 7 dates of the week containing `date`, starting on the user's chosen first day. */
export function weekDates(date: CivilDate, weekStart: WeekStart): CivilDate[] {
  const offset = (isoWeekday(date) - WEEK_START_ISO[weekStart] + 7) % 7;
  const first = addDays(date, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export type PlacedSlot<T> = { slot: T; lane: number; lanes: number };

/**
 * Lay out one day's slots for the grid: overlapping slots share the width,
 * each in its own lane. Slots that don't overlap anything get the full width.
 */
export function layoutDay<T extends SlotTiming>(slots: readonly T[]): PlacedSlot<T>[] {
  const sorted = sortSlots(slots);
  const placed: PlacedSlot<T>[] = [];
  let cluster: PlacedSlot<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const slot of sorted) {
    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);
    if (start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    cluster.push({ slot, lane, lanes: 0 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  closeCluster();
  return placed;
}
