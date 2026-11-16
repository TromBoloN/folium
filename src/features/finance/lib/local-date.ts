/**
 * Calendar dates for money: the user's local day, as "YYYY-MM-DD".
 * "Now" and the zone are always passed in (never Date.now() or the server's zone).
 */

export type IsoDate = string;

/** The local date at `now` in `timeZone`, e.g. 2026-11-16T16:00Z in Asia/Makassar = "2026-11-17". */
export function localDateFor(now: Date, timeZone: string): IsoDate {
  if (Number.isNaN(now.getTime())) throw new RangeError("Invalid date");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar arithmetic on "YYYY-MM-DD" through UTC, so no zone or DST can shift it. */
export function addDays(isoDate: IsoDate, n: number): IsoDate {
  const m = ISO_DATE.exec(isoDate);
  if (!m || !Number.isSafeInteger(n)) throw new RangeError(`Invalid date or day count: ${isoDate}, ${n}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject impossible dates ("2026-02-30") instead of rolling them over.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new RangeError(`Invalid date: ${isoDate}`);
  }
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
