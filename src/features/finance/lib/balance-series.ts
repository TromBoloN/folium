import { addDays, type IsoDate, localDateFor } from "./local-date";

/**
 * An account's end-of-day balance for the last `days` days (oldest first, the
 * last one is today), worked BACKWARDS from the current balance that the
 * `account_balances` view returns. Never re-add history from the opening
 * balance: the view is the one source of truth, and this only undoes the
 * recent days on top of it.
 *
 * - The view counts every posted row, including ones dated after today, so
 *   those are undone first to get today's closing balance.
 * - Planned rows are ignored (the view ignores them too).
 * - Transfers: the sender loses amount + fee, the receiver gains amount.
 * - Days with no activity carry the balance forward.
 */

export type SeriesRow = {
  kind: string;
  status: string;
  amount: bigint;
  feeAmount: bigint;
  accountId: string;
  toAccountId: string | null;
  adjustmentDirection: "in" | "out" | null;
  occurredOn: IsoDate;
};

export type SeriesPoint = { date: IsoDate; balance: bigint };

/** How one posted row moves one account's balance (the same CASE as the view). */
export function effectOn(accountId: string, row: SeriesRow): bigint {
  if (row.status !== "posted") return 0n;
  switch (row.kind) {
    case "income":
      return row.accountId === accountId ? row.amount : 0n;
    case "expense":
      return row.accountId === accountId ? -row.amount : 0n;
    // Debts move real money: repay/borrow come in, lend/payback go out.
    case "repay":
    case "borrow":
      return row.accountId === accountId ? row.amount : 0n;
    case "lend":
    case "payback":
      return row.accountId === accountId ? -row.amount : 0n;
    case "adjustment":
      if (row.accountId !== accountId) return 0n;
      return row.adjustmentDirection === "in" ? row.amount : row.adjustmentDirection === "out" ? -row.amount : 0n;
    case "transfer":
      if (row.toAccountId === accountId) return row.amount;
      if (row.accountId === accountId) return -(row.amount + row.feeAmount);
      return 0n;
    default:
      return 0n;
  }
}

export function balanceSeries(
  accountId: string,
  currentBalance: bigint,
  rows: readonly SeriesRow[],
  { days, timeZone, now }: { days: number; timeZone: string; now: Date },
): SeriesPoint[] {
  if (!Number.isInteger(days) || days < 1) return [];
  const today = localDateFor(now, timeZone);
  const byDay = new Map<IsoDate, bigint>();
  let future = 0n;
  for (const row of rows) {
    const effect = effectOn(accountId, row);
    if (effect === 0n) continue;
    if (row.occurredOn > today) future += effect;
    else byDay.set(row.occurredOn, (byDay.get(row.occurredOn) ?? 0n) + effect);
  }

  const points: SeriesPoint[] = [];
  let balance = currentBalance - future;
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i);
    points.push({ date, balance });
    balance -= byDay.get(date) ?? 0n;
  }
  return points.reverse();
}

/** First to last point of a series ("up Rp X this week"); 0 for a flat or empty series. */
export function seriesChange(points: readonly SeriesPoint[]): bigint {
  if (points.length < 2) return 0n;
  return points[points.length - 1].balance - points[0].balance;
}
