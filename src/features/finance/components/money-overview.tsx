import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { Tile } from "@/components/ui/tile";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "../lib/balance-series";
import { formatIdr } from "../lib/format-idr";
import type { Account } from "../queries";
import { ACCOUNT_TYPE_LABELS } from "../schemas";
import { MoneyCountUp } from "./money-count-up";
import { accountGlyph, IconBadge } from "./money-icon";

/** A tiny line of day-end balances. Decorative: the card says the change in words. */
function Sparkline({ points }: { points: SeriesPoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => Number(p.balance));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const [w, h, pad] = [100, 28, 2];
  const xy = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    max === min ? h / 2 : pad + (1 - (v - min) / span) * (h - pad * 2),
  ]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="money-ink h-7 w-full overflow-visible"
      focusable="false"
    >
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="currentColor" opacity="0.1" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function changeText(change: bigint) {
  if (change === 0n) return "No change this week";
  return `${change > 0n ? "Up" : "Down"} ${formatIdr(change > 0n ? change : -change)} this week`;
}

/** The total across active accounts (hero) and one card per account with a 7-day sparkline. */
export function AccountCards({ accounts, series }: { accounts: Account[]; series: Record<string, SeriesPoint[]> }) {
  const active = accounts.filter((a) => !a.archived);
  const total = active.reduce((sum, a) => sum + a.balance, 0n);
  return (
    <section aria-labelledby="accounts-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="accounts-h" className="text-muted-foreground text-sm">
            Total across accounts
          </h2>
          <p
            className={cn(
              "reveal font-display font-medium text-4xl leading-none tracking-tight sm:text-5xl",
              total < 0n && "text-money-out",
            )}
          >
            <MoneyCountUp amount={total.toString()} durationMs={900} />
          </p>
        </div>
        <Link
          href="/money/accounts"
          className="rounded-sm text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          Manage accounts
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {active.map((a, i) => {
          const points = series[a.id] ?? [];
          const change = points.length > 1 ? points[points.length - 1].balance - points[0].balance : 0n;
          const negative = a.balance < 0n;
          return (
            <li key={a.id}>
              <Tile
                as={Link}
                href={`/money/transactions?account=${a.id}`}
                reveal={i + 1}
                spotlight
                className={cn(
                  "relative flex h-full flex-col gap-2 overflow-hidden p-4 pl-5 transition-transform duration-(--dur-fast) hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
                  negative && "ring-1 ring-money-out/40",
                )}
                style={{ "--c": a.color } as React.CSSProperties}
              >
                <span aria-hidden className="money-accent absolute inset-y-0 left-0 w-1" />
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <IconBadge icon={accountGlyph(a)} color={a.color} size="sm" />
                  <span className="truncate font-medium">{a.name}</span>
                  {/* The link's name is its visible text plus this (no aria-label: it must contain what's shown). */}
                  <span className="sr-only">, {ACCOUNT_TYPE_LABELS[a.type]}, balance</span>
                </span>
                <span
                  data-testid={`balance-${a.id}`}
                  className={cn(
                    "font-display font-medium text-xl leading-none sm:text-2xl",
                    negative && "text-money-out",
                  )}
                >
                  <MoneyCountUp amount={a.balance.toString()} />
                </span>
                {negative ? <span className="font-medium text-money-out text-xs">Overdrawn</span> : null}
                <Sparkline points={points} />
                <span className="text-muted-foreground text-xs">{changeText(change)}</span>
              </Tile>
            </li>
          );
        })}
        <li>
          <Link
            href="/money/accounts/new"
            className="flex h-full min-h-28 flex-col items-center justify-center gap-1.5 rounded-tile border border-border border-dashed p-4 text-muted-foreground text-sm transition-colors duration-(--dur-fast) hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            <Plus aria-hidden className="size-4" />
            Add account
          </Link>
        </li>
      </ul>
    </section>
  );
}

export type MonthSummary = {
  month: string;
  label: string;
  income: bigint;
  expense: bigint;
  comparison: { direction: "more" | "less" | "same"; percent: number } | null;
  previousLabel: string;
  prevHref: string;
  nextHref: string | null;
};

/** One wide card: in, out, net, a proportion bar, and how spending compares with last month. */
export function MonthOverview({ summary }: { summary: MonthSummary }) {
  const { income, expense, comparison } = summary;
  const net = income - expense;
  const total = income + expense;
  // Integer percent for the bar width; the bar is decorative, the numbers carry the meaning.
  const inShare = total === 0n ? 0 : Number((income * 1000n) / total) / 10;
  return (
    <section
      aria-labelledby="month-h"
      className="tile reveal flex flex-col gap-4 p-5"
      style={{ "--i": 6 } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="month-h" className="font-medium">
          {summary.label}
        </h2>
        <MonthNav prevHref={summary.prevHref} nextHref={summary.nextHref} label={summary.label} />
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <dt className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <ArrowDownLeft aria-hidden className="size-4 text-money-in" />
            In
          </dt>
          <dd className="font-display font-medium text-lg text-money-in leading-tight sm:text-2xl">
            <MoneyCountUp amount={income.toString()} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <ArrowUpRight aria-hidden className="size-4 text-money-out" />
            Out
          </dt>
          <dd className="font-display font-medium text-lg text-money-out leading-tight sm:text-2xl">
            <MoneyCountUp amount={expense.toString()} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-sm">Net</dt>
          <dd
            className={cn(
              "font-display font-medium text-lg leading-tight sm:text-2xl",
              net < 0n ? "text-money-out" : net > 0n ? "text-money-in" : "",
            )}
          >
            {net > 0n ? "+" : ""}
            <MoneyCountUp amount={net.toString()} />
          </dd>
        </div>
      </dl>
      <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-muted">
        {total > 0n ? (
          <>
            <span className="h-full bg-money-in" style={{ width: `${inShare}%` }} />
            <span className="h-full flex-1 bg-money-out" />
          </>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {total === 0n
          ? "Nothing in or out yet this month."
          : comparison === null
            ? "Transfers and adjustments aren't counted as in or out."
            : comparison.direction === "same"
              ? `Spent the same as ${summary.previousLabel}.`
              : `Spent ${comparison.percent}% ${comparison.direction} than ${summary.previousLabel}.`}
      </p>
    </section>
  );
}

/** Previous / next month links (?month=YYYY-MM). No "next" past the current month. */
export function MonthNav({ prevHref, nextHref, label }: { prevHref: string; nextHref: string | null; label: string }) {
  const base =
    "flex size-9 items-center justify-center rounded-full border border-border-soft text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95";
  return (
    <nav aria-label={`Month: ${label}`} className="flex items-center gap-1">
      <Link href={prevHref} className={base} aria-label="Previous month" scroll={false}>
        <ChevronLeft aria-hidden className="size-4" />
      </Link>
      {nextHref ? (
        <Link href={nextHref} className={base} aria-label="Next month" scroll={false}>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(base, "pointer-events-none opacity-40")}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
