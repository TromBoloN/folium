import { type CivilDate, formatDate } from "@/lib/dates";
import { EN, type I18n } from "@/lib/i18n/core";
import { formatTime, weekdayLabel } from "./logic";
import type { TimetableSlot } from "./types";

const DAY_MONTH_YEAR = { day: "numeric", month: "short", year: "numeric" } as const;

export function formatTimeRange(slot: { startTime: string; endTime: string }, format: "24h" | "12h") {
  return `${formatTime(slot.startTime, format)}–${formatTime(slot.endTime, format)}`;
}

export function formatDateRange(
  startsOn: CivilDate | null,
  endsOn: CivilDate | null,
  { t, intl }: I18n = EN,
): string | null {
  const f = (d: CivilDate) => formatDate(d, DAY_MONTH_YEAR, intl);
  if (startsOn && endsOn) return `${f(startsOn)} – ${f(endsOn)}`;
  if (startsOn) return t("From {date}", { date: f(startsOn) });
  if (endsOn) return t("Until {date}", { date: f(endsOn) });
  return null;
}

/** "Physics, Mon 09:00–10:40": how an overlapping class is named in warnings. */
export function describeSlot(slot: TimetableSlot, format: "24h" | "12h", intl = "en-GB") {
  return `${slot.course.code ?? slot.course.name}, ${weekdayLabel(slot.weekday, "short", intl)} ${formatTimeRange(slot, format)}`;
}
