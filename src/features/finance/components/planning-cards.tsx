import { AlertTriangle, CalendarClock, Gauge, PiggyBank } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "../lib/budgets";
import { formatIdr } from "../lib/format-idr";
import type { SafeToSpend } from "../lib/safe-to-spend";
import type { Category } from "../queries";
import type { Bill } from "../queries/planning";
import { BillRow } from "./bills";
import { BudgetList } from "./budget-list";

const head = "flex items-center justify-between gap-3";

/** A 30-day line of the spendable balance, with a zero line. Decorative: the text carries the meaning. */
function ForecastChart({ points }: { points: { date: string; balance: bigint }[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => Number(p.balance));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const [w, h] = [100, 40];
  const y = (v: number) => (1 - (v - min) / span) * h;
  const line = values
    .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-14 w-full overflow-visible"
      focusable="false"
    >
      <path
        d={`M0 ${y(0)} L${w} ${y(0)}`}
        stroke="var(--border)"
        strokeWidth="1"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** "Safe to spend": per day until payday, after the bills already coming, plus the 30-day forecast. */
export function SafeToSpendCard({
  safe,
  points,
  firstNegative,
  today,
}: {
  safe: SafeToSpend;
  points: { date: string; balance: bigint }[];
  firstNegative: string | null;
  today: string;
}) {
  const payday = formatDate(safe.payday, { weekday: "short", day: "numeric", month: "short" });
  return (
    <section
      aria-labelledby="safe-h"
      className="tile reveal flex flex-col gap-3 p-5"
      style={{ "--i": 5 } as React.CSSProperties}
    >
      <div className={head}>
        <h2 id="safe-h" className="flex items-center gap-2 font-medium">
          <Gauge aria-hidden className="size-4 text-muted-foreground" />
          Safe to spend
        </h2>
        <Link href="/money/recurring" className="text-muted-foreground text-xs hover:text-foreground hover:underline">
          Bills
        </Link>
      </div>
      {safe.perDay !== null ? (
        <p className="font-display font-medium text-3xl tabular-nums">
          {formatIdr(safe.perDay)}
          <span className="font-normal font-sans text-base text-muted-foreground"> a day</span>
        </p>
      ) : (
        <p className="font-display font-medium text-3xl text-money-out tabular-nums">
          Over by {formatIdr(safe.over ?? 0n)}
        </p>
      )}
      <p className="text-muted-foreground text-sm">
        For {safe.days} {safe.days === 1 ? "day" : "days"} until{" "}
        {safe.paydayFromIncome ? "your next income" : "month end"} ({payday}
        ), after {formatIdr(safe.outflows)} of bills. {formatIdr(safe.liquid)} in spendable accounts.
      </p>
      <ForecastChart points={points} />
      {firstNegative ? (
        <p role="note" className="flex items-center gap-2 font-medium text-money-out text-sm">
          <AlertTriangle aria-hidden className="size-4" />
          {firstNegative === today
            ? "Planned bills already take you below zero."
            : `Below zero on ${formatDate(firstNegative, { weekday: "short", day: "numeric", month: "short" })} if nothing changes.`}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">Next 30 days with planned bills and income: never below zero.</p>
      )}
    </section>
  );
}

/** Overdue and this week's bills with "Mark paid". */
export function UpcomingBillsCard({
  overdue,
  soon,
  today,
  categories,
}: {
  overdue: Bill[];
  soon: Bill[];
  today: string;
  categories: Category[];
}) {
  const bills = [...overdue, ...soon].slice(0, 5);
  return (
    <section
      aria-labelledby="bills-h"
      className="tile reveal flex flex-col overflow-hidden"
      style={{ "--i": 6 } as React.CSSProperties}
    >
      <div className={cn(head, "px-5 pt-5 pb-2")}>
        <h2 id="bills-h" className="flex items-center gap-2 font-medium">
          <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
          Upcoming bills
        </h2>
        <Link href="/money/recurring" className="text-muted-foreground text-xs hover:text-foreground hover:underline">
          All recurring
        </Link>
      </div>
      {bills.length === 0 ? (
        <p className="px-5 pb-5 text-muted-foreground text-sm">Nothing due in the next 7 days.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-soft">
          {bills.map((b) => (
            <BillRow key={b.id} bill={b} today={today} categories={categories} compact />
          ))}
        </ul>
      )}
    </section>
  );
}

/** The three budgets closest to their limit. */
export function BudgetWatchCard({ items, month }: { items: BudgetProgress[]; month: string }) {
  return (
    <section
      aria-labelledby="watch-h"
      className="tile reveal flex flex-col gap-4 p-5"
      style={{ "--i": 7 } as React.CSSProperties}
    >
      <div className={head}>
        <h2 id="watch-h" className="flex items-center gap-2 font-medium">
          <PiggyBank aria-hidden className="size-4 text-muted-foreground" />
          Budgets
        </h2>
        <Link
          href={`/money/budgets?month=${month}`}
          className="text-muted-foreground text-xs hover:text-foreground hover:underline"
        >
          All budgets
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No budgets this month.{" "}
          <Link href="/money/budgets" className="font-medium text-primary underline underline-offset-2">
            Set one
          </Link>
        </p>
      ) : (
        <BudgetList items={items.slice(0, 3)} month={month} />
      )}
    </section>
  );
}
