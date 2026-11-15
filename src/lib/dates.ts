/**
 * Calendar dates as "YYYY-MM-DD" strings ("civil dates"), with no time zone
 * attached. Arithmetic goes through UTC so it never shifts across DST or the
 * server's own zone. "Today" is always taken in the user's time zone
 * (preferences.timeZone), never the server's.
 */
export const DEFAULT_TIME_ZONE = "Asia/Makassar";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Every IANA zone the runtime knows, with `include` guaranteed present (e.g. a saved value). */
export function listTimeZones(include?: string): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return include && !zones.includes(include) ? [include, ...zones].sort() : zones;
}

export type CivilDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's date in the given time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): CivilDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtc(date: CivilDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: CivilDate): number {
  const day = toUtc(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Format a civil date for display, e.g. { weekday: "short", day: "numeric" } -> "Mon 16". */
export function formatDate(date: CivilDate, options: Intl.DateTimeFormatOptions, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(toUtc(date));
}
