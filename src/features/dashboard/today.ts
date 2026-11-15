import type { CivilDate } from "@/lib/dates";
import { appliesOn, type SlotTiming, sortSlots, toMinutes } from "../timetable/logic";

/** The classes that actually happen on this date (weekday and date range), in time order. */
export function selectTodaysClasses<T extends SlotTiming>(slots: readonly T[], date: CivilDate): T[] {
  return sortSlots(slots.filter((s) => appliesOn(s, date)));
}

export type ClassMoment = { current: string[]; next: string | null };

/**
 * Which of today's classes are on now, and which one is next.
 * - "current": started and not yet ended (overlapping classes can both be current)
 * - "next": the first class that hasn't started yet
 * A class ending at 10:00 is over at 10:00, so a 10:00 class is current then, not next.
 */
export function classMoment(todays: readonly SlotTiming[], nowMinute: number): ClassMoment {
  const sorted = sortSlots(todays);
  const current = sorted
    .filter((s) => toMinutes(s.startTime) <= nowMinute && nowMinute < toMinutes(s.endTime))
    .map((s) => s.id);
  const next = sorted.find((s) => toMinutes(s.startTime) > nowMinute)?.id ?? null;
  return { current, next };
}

/** "Good morning" (05:00–11:59), "Good afternoon" (12:00–17:59), "Good evening" (otherwise). */
export function greeting(nowMinute: number): string {
  const hour = Math.floor(nowMinute / 60);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}
