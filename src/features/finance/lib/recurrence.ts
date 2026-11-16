import { plural, type T, tEn } from "@/lib/i18n/core";
import { addDays, type IsoDate } from "./local-date";

/**
 * Due dates of a recurring rule (kos, UKT instalments, subscriptions,
 * allowance). Pure calendar arithmetic on "YYYY-MM-DD": no clock, no zone.
 *
 * - weekly: starts_on, then every 7 × interval days.
 * - monthly: due_day of starts_on's month (or the next interval month if that
 *   is before starts_on), then every `interval` months.
 * - yearly: due_day of starts_on's month, every `interval` years.
 * - A due day past the month's end clamps to its last day (31 → 30 Nov,
 *   29/30/31 → 28 or 29 Feb).
 * - Ends after ends_on, or after instalments_total occurrences.
 * - Paused: dates up to paused_until are skipped (they still count as
 *   instalments, so an instalment plan doesn't stretch).
 */

export type Cadence = "weekly" | "monthly" | "yearly";

export type Schedule = {
  cadence: Cadence;
  intervalCount: number;
  dueDay: number | null;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  instalmentsTotal: number | null;
  pausedUntil?: IsoDate | null;
};

const MAX_STEPS = 5000;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The due day in a given month, clamped to its last day. */
export function clampedDate(year: number, month: number, day: number): IsoDate {
  return iso(year, month, Math.min(day, daysInMonth(year, month)));
}

function monthAt(year: number, month: number, add: number): [number, number] {
  const index = year * 12 + (month - 1) + add;
  return [Math.floor(index / 12), (index % 12) + 1];
}

/** Every due date in order (the nth value is the nth instalment), up to `until` inclusive. */
export function dueDatesUntil(s: Schedule, until: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const interval = Math.max(1, Math.floor(s.intervalCount || 1));
  const limit = s.instalmentsTotal ?? Number.POSITIVE_INFINITY;
  const end = s.endsOn && s.endsOn < until ? s.endsOn : until;
  const [sy, sm, sd] = s.startsOn.split("-").map(Number);

  for (let k = 0; k < MAX_STEPS && out.length < limit; k++) {
    let date: IsoDate;
    if (s.cadence === "weekly") {
      date = addDays(s.startsOn, k * 7 * interval);
    } else {
      const day = s.dueDay ?? sd;
      const step = s.cadence === "monthly" ? interval : 12 * interval;
      // If the due day in the start month is before the start, the first one is a step later.
      const offset = clampedDate(sy, sm, day) < s.startsOn ? step : 0;
      const [y, m] = monthAt(sy, sm, offset + k * step);
      date = clampedDate(y, m, day);
    }
    if (date > end) break;
    out.push(date);
  }
  return out;
}

/** Due dates within [from, to], skipping paused ones. */
export function occurrencesBetween(s: Schedule, from: IsoDate, to: IsoDate): IsoDate[] {
  if (to < from) return [];
  return dueDatesUntil(s, to).filter((d) => d >= from && !(s.pausedUntil && d <= s.pausedUntil));
}

/** What a rule costs per month on average (for "fixed costs per month"), whole rupiah. */
export function monthlyEquivalent(amount: bigint, cadence: Cadence, intervalCount: number): bigint {
  const n = BigInt(Math.max(1, Math.floor(intervalCount || 1)));
  if (cadence === "weekly") return (amount * 52n + 6n * n) / (12n * n);
  if (cadence === "monthly") return amount / n;
  return amount / (12n * n);
}

/** "Every month on the 5th", "Every 2 weeks", "Every year on 14 Aug"-style label parts. */
export function cadenceLabel(s: Pick<Schedule, "cadence" | "intervalCount" | "dueDay">, t: T = tEn): string {
  const n = Math.max(1, s.intervalCount);
  const every =
    s.cadence === "weekly"
      ? t(plural(n, "Every week", "Every {n} weeks"), { n })
      : s.cadence === "monthly"
        ? t(plural(n, "Every month", "Every {n} months"), { n })
        : t(plural(n, "Every year", "Every {n} years"), { n });
  return s.cadence !== "weekly" && s.dueDay ? t("{every} on day {day}", { every, day: s.dueDay }) : every;
}
