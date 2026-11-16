import { addDays, type IsoDate } from "./local-date";

/**
 * Safe to spend: how much can I spend per day until the next allowance, after
 * the bills already coming?
 *
 *   per day = (liquid balance − planned outflows before payday) / max(days to payday, 1)
 *
 * - Liquid = spendable accounts only (savings excluded unless the user opts in).
 * - Payday = the next planned income on or after today (normally the allowance
 *   rule); without one, the last day of this month.
 * - Outflows = planned rows due BEFORE payday (overdue ones included), counted
 *   by their effect on spendable accounts. A bill on payday itself is paid
 *   from the new money, so it isn't counted.
 * - A negative result is "over by", never a negative per-day amount.
 */

export type PlannedRow = {
  kind: string;
  amount: bigint;
  feeAmount: bigint;
  accountId: string;
  toAccountId: string | null;
  occurredOn: IsoDate;
};

/** A planned row's effect on the total of the spendable accounts. */
export function spendableEffect(row: PlannedRow, spendable: ReadonlySet<string>): bigint {
  const from = spendable.has(row.accountId);
  switch (row.kind) {
    case "income":
    case "repay":
    case "borrow":
      return from ? row.amount : 0n;
    case "expense":
    case "lend":
    case "payback":
      return from ? -row.amount : 0n;
    case "transfer": {
      const to = row.toAccountId ? spendable.has(row.toAccountId) : false;
      return (from ? -(row.amount + row.feeAmount) : 0n) + (to ? row.amount : 0n);
    }
    default:
      return 0n;
  }
}

function lastOfMonth(date: IsoDate): IsoDate {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Next planned income on or after today, else month end. */
export function nextPayday(planned: readonly PlannedRow[], today: IsoDate): { date: IsoDate; fromIncome: boolean } {
  const income = planned
    .filter((r) => r.kind === "income" && r.occurredOn >= today)
    .map((r) => r.occurredOn)
    .sort()[0];
  return income ? { date: income, fromIncome: true } : { date: lastOfMonth(today), fromIncome: false };
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type SafeToSpend = {
  liquid: bigint;
  outflows: bigint;
  payday: IsoDate;
  paydayFromIncome: boolean;
  days: number;
  /** Per day when there's money left; null when over. */
  perDay: bigint | null;
  /** How much over (positive) when the bills already exceed the balance. */
  over: bigint | null;
};

export function safeToSpend(input: {
  liquid: bigint;
  planned: readonly PlannedRow[];
  spendable: ReadonlySet<string>;
  today: IsoDate;
}): SafeToSpend {
  const payday = nextPayday(input.planned, input.today);
  let outflows = 0n;
  for (const r of input.planned) {
    if (r.occurredOn >= payday.date) continue;
    const effect = spendableEffect(r, input.spendable);
    if (effect < 0n) outflows += -effect;
  }
  const days = Math.max(daysBetween(input.today, payday.date), 1);
  const free = input.liquid - outflows;
  return {
    liquid: input.liquid,
    outflows,
    payday: payday.date,
    paydayFromIncome: payday.fromIncome,
    days,
    perDay: free >= 0n ? free / BigInt(days) : null,
    over: free < 0n ? -free : null,
  };
}

/**
 * The spendable balance day by day for the next `days` days with every planned
 * row applied on its date (overdue ones on day 0), and the first day it would
 * drop below zero.
 */
export function forecast(input: {
  liquid: bigint;
  planned: readonly PlannedRow[];
  spendable: ReadonlySet<string>;
  today: IsoDate;
  days: number;
}): { points: { date: IsoDate; balance: bigint }[]; firstNegative: IsoDate | null } {
  const byDay = new Map<IsoDate, bigint>();
  for (const r of input.planned) {
    // biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers.
    const date = r.occurredOn < input.today ? input.today : r.occurredOn;
    byDay.set(date, (byDay.get(date) ?? 0n) + spendableEffect(r, input.spendable));
  }
  const points: { date: IsoDate; balance: bigint }[] = [];
  let balance = input.liquid;
  let firstNegative: IsoDate | null = null;
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.today, i);
    balance += byDay.get(date) ?? 0n;
    points.push({ date, balance });
    if (balance < 0n && !firstNegative) firstNegative = date;
  }
  return { points, firstNegative };
}
