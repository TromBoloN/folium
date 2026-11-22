/**
 * This month against last month, as a whole percentage ("12% less").
 * Null when last month is 0 or less: there's nothing to compare with, and we
 * never divide by zero.
 */
export function compareMonths(
  current: bigint,
  previous: bigint,
): { direction: "more" | "less" | "same"; percent: number } | null {
  if (previous <= 0n) return null;
  const diff = current - previous;
  if (diff === 0n) return { direction: "same", percent: 0 };
  const abs = diff < 0n ? -diff : diff;
  // Round half up, in bigint.
  const percent = Number((abs * 200n + previous) / (2n * previous));
  return { direction: diff > 0n ? "more" : "less", percent };
}

/** "2026-01" shifted by n months ("2025-12" for -1). */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The month to show: a valid ?month= no later than `maxMonth` (default `currentMonth`), else `currentMonth`. */
export function resolveMonth(param: unknown, currentMonth: string, maxMonth = currentMonth): string {
  return typeof param === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) && param <= maxMonth ? param : currentMonth;
}
