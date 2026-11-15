import { type CivilDate, formatDate } from "@/lib/dates";
import { formatTime, weekdayLabel } from "./logic";
import type { TimetableSlot } from "./types";

const DAY_MONTH_YEAR = { day: "numeric", month: "short", year: "numeric" } as const;

export function formatTimeRange(slot: { startTime: string; endTime: string }, format: "24h" | "12h") {
  return `${formatTime(slot.startTime, format)}–${formatTime(slot.endTime, format)}`;
}

export function formatDateRange(startsOn: CivilDate | null, endsOn: CivilDate | null): string | null {
  if (startsOn && endsOn) return `${formatDate(startsOn, DAY_MONTH_YEAR)} – ${formatDate(endsOn, DAY_MONTH_YEAR)}`;
  if (startsOn) return `From ${formatDate(startsOn, DAY_MONTH_YEAR)}`;
  if (endsOn) return `Until ${formatDate(endsOn, DAY_MONTH_YEAR)}`;
  return null;
}

/** "Physics, Mon 09:00–10:40": how an overlapping class is named in warnings. */
export function describeSlot(slot: TimetableSlot, format: "24h" | "12h") {
  return `${slot.course.code ?? slot.course.name}, ${weekdayLabel(slot.weekday, "short")} ${formatTimeRange(slot, format)}`;
}
