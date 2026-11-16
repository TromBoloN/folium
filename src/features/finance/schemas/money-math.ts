import { addDays } from "../lib/local-date";

/**
 * "Match my real balance": the opening balance that makes the computed balance
 * equal what the bank app shows, keeping every transaction as it is.
 *   balance = opening + movements  →  new opening = real − (balance − opening)
 * Opening balance is a snapshot: re-run after backfilling older transactions.
 */
export function reconciledOpening(balance: bigint, opening: bigint, real: bigint): bigint {
  return real - (balance - opening);
}

/** "Adjust": the adjustment that takes the balance to the real amount; null if it already matches. */
export function adjustmentFor(balance: bigint, real: bigint): { direction: "in" | "out"; amount: bigint } | null {
  const diff = real - balance;
  if (diff === 0n) return null;
  return diff > 0n ? { direction: "in", amount: diff } : { direction: "out", amount: -diff };
}

/** The month of a local date: "2026-11" and its first and last day ("2026-11-01" … "2026-11-30"). */
export function monthRange(localDate: string): { month: string; from: string; to: string } {
  const month = localDate.slice(0, 7);
  return { month, ...monthBounds(month) };
}

/** "2026-02" → first and last day, leap years included. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: `${month}-01`, to: addDays(nextFirst, -1) };
}

/** Rows in day groups, newest day first, keeping the given order inside a day. */
export function groupByDay<T extends { occurredOn: string }>(rows: readonly T[]): { date: string; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.occurredOn, [...(groups.get(row.occurredOn) ?? []), row]);
  return [...groups].sort((a, b) => b[0].localeCompare(a[0])).map(([date, list]) => ({ date, rows: list }));
}

/** Income and expense totals (transfers and adjustments don't count as money in or out). */
export function monthTotals(rows: readonly { kind: string; amount: bigint }[]): { income: bigint; expense: bigint } {
  let income = 0n;
  let expense = 0n;
  for (const r of rows) {
    if (r.kind === "income") income += r.amount;
    else if (r.kind === "expense") expense += r.amount;
  }
  return { income, expense };
}
