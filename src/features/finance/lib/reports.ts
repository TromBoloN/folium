import { plural, type T, tEn } from "@/lib/i18n/core";
import { compareMonths } from "./compare-months";
import type { IsoDate } from "./local-date";

/**
 * Reports: income vs expense by month, savings rate, net worth over time,
 * category trends, top payees and plain rule-based insights. Only posted
 * income and expenses count as money in and out; transfers, adjustments and
 * the debt kinds never do.
 */

export type ReportRow = {
  kind: string;
  status: string;
  amount: bigint;
  feeAmount: bigint;
  adjustmentDirection: "in" | "out" | null;
  categoryId: string | null;
  payee: string | null;
  occurredOn: IsoDate;
};

const posted = (r: ReportRow) => r.status === "posted";

export function monthlyInOut(rows: readonly ReportRow[], months: readonly string[]) {
  const map = new Map(months.map((m) => [m, { month: m, income: 0n, expense: 0n }]));
  for (const r of rows) {
    if (!posted(r)) continue;
    const bucket = map.get(r.occurredOn.slice(0, 7));
    if (!bucket) continue;
    if (r.kind === "income") bucket.income += r.amount;
    else if (r.kind === "expense") bucket.expense += r.amount;
  }
  return months.map((m) => map.get(m) as { month: string; income: bigint; expense: bigint });
}

/** Share of income kept, whole percent (may be negative); null without income. */
export function savingsRate(income: bigint, expense: bigint): number | null {
  if (income <= 0n) return null;
  return Number(((income - expense) * 100n) / income);
}

/** A posted row's effect on the total of all accounts (transfers only lose their fee). */
export function netWorthEffect(r: ReportRow): bigint {
  if (!posted(r)) return 0n;
  switch (r.kind) {
    case "income":
    case "repay":
    case "borrow":
      return r.amount;
    case "expense":
    case "lend":
    case "payback":
      return -r.amount;
    case "adjustment":
      return r.adjustmentDirection === "in" ? r.amount : r.adjustmentDirection === "out" ? -r.amount : 0n;
    case "transfer":
      return -r.feeAmount;
    default:
      return 0n;
  }
}

/**
 * Total balance at the end of each month, worked backwards from today's total
 * (which comes from account_balances, like the sparklines). `rows` must cover
 * everything after the first month's end, future-dated posted rows included.
 */
export function netWorthByMonth(currentTotal: bigint, rows: readonly ReportRow[], monthEnds: readonly IsoDate[]) {
  return monthEnds.map((end) => {
    let total = currentTotal;
    for (const r of rows) if (r.occurredOn > end) total -= netWorthEffect(r);
    return { month: end.slice(0, 7), total };
  });
}

export type Trend = {
  categoryId: string;
  name: string;
  current: bigint;
  previous: bigint;
  change: ReturnType<typeof compareMonths>;
};

/** Spending per (parent) category this month against last, biggest first. */
export function categoryTrends(
  rows: readonly ReportRow[],
  categories: readonly { id: string; name: string; parentId: string | null }[],
  month: string,
  previousMonth: string,
): Trend[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string, { current: bigint; previous: bigint }>();
  for (const r of rows) {
    if (!posted(r) || r.kind !== "expense" || !r.categoryId) continue;
    const c = byId.get(r.categoryId);
    if (!c) continue;
    const key = c.parentId ?? c.id;
    const m = r.occurredOn.slice(0, 7);
    const entry = sums.get(key) ?? { current: 0n, previous: 0n };
    if (m === month) entry.current += r.amount;
    else if (m === previousMonth) entry.previous += r.amount;
    else continue;
    sums.set(key, entry);
  }
  return [...sums]
    .map(([id, s]) => ({
      categoryId: id,
      name: byId.get(id)?.name ?? "Category",
      ...s,
      change: compareMonths(s.current, s.previous),
    }))
    .sort((a, b) => (a.current === b.current ? a.name.localeCompare(b.name) : a.current > b.current ? -1 : 1));
}

/** Where the money went: posted expenses by payee (case-insensitive), top n. */
export function topPayees(rows: readonly ReportRow[], n = 5): { payee: string; total: bigint; count: number }[] {
  const map = new Map<string, { payee: string; total: bigint; count: number }>();
  for (const r of rows) {
    if (!posted(r) || r.kind !== "expense" || !r.payee?.trim()) continue;
    const key = r.payee.trim().toLowerCase();
    const entry = map.get(key) ?? { payee: r.payee.trim(), total: 0n, count: 0 };
    entry.total += r.amount;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()]
    .sort((a, b) => (a.total === b.total ? b.count - a.count : a.total > b.total ? -1 : 1))
    .slice(0, n);
}

/**
 * Plain sentences from the numbers (no AI): categories that moved at least
 * `threshold`% against last month (and by at least Rp 20.000), and how many
 * subscriptions renew this week.
 */
export function insights(input: {
  trends: readonly Trend[];
  previousLabel: string;
  renewingThisWeek: number;
  threshold?: number;
  t?: T;
}): string[] {
  const tr = input.t ?? tEn;
  const threshold = input.threshold ?? 15;
  const out: string[] = [];
  for (const t of input.trends) {
    if (!t.change || t.change.direction === "same" || t.change.percent < threshold) continue;
    const diff = t.current > t.previous ? t.current - t.previous : t.previous - t.current;
    if (diff < 20_000n) continue;
    out.push(
      tr(t.change.direction === "more" ? "{name} is {n}% higher than {month}" : "{name} is {n}% lower than {month}", {
        name: t.name,
        n: t.change.percent,
        month: input.previousLabel,
      }),
    );
    if (out.length === 3) break;
  }
  if (input.renewingThisWeek > 0) {
    out.push(
      tr(
        plural(
          input.renewingThisWeek,
          "1 bill or subscription is due this week",
          "{n} bills or subscriptions are due this week",
        ),
        {
          n: input.renewingThisWeek,
        },
      ),
    );
  }
  return out;
}
