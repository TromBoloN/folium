import { AlertTriangle, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import { formatDate } from "@/lib/dates";
import { getI18n, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "../lib/balance-series";
import { formatIdr } from "../lib/format-idr";
import type { SafeToSpend } from "../lib/safe-to-spend";
import type { Account } from "../queries";
import { ACCOUNT_TYPE_LABELS } from "../schemas";
import { AccountBalanceInline } from "./account-balance-inline";
import { MoneyCountUp } from "./money-count-up";
import { accountGlyph, IconBadge } from "./money-icon";

/** A tiny line of day-end balances. Decorative. */
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
  if (max === min) {
    return (
      <svg
        aria-hidden
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-7 w-full text-border"
        focusable="false"
      >
        <path
          d={`M0 ${h / 2} L${w} ${h / 2}`}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
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

/** Hero (Total + Safe-to-Spend/day + Sync/Add) and Account cards (name, inline balance, sparkline). */
export async function AccountCards({
  accounts,
  series,
  safe,
  firstNegative,
  today,
}: {
  accounts: Account[];
  series: Record<string, SeriesPoint[]>;
  safe?: SafeToSpend;
  firstNegative?: string | null;
  today?: string;
}) {
  const { t, intl } = await getI18n();
  const active = accounts.filter((a) => !a.archived);
  const total = active.reduce((sum, a) => sum + a.balance, 0n);
  return (
    <section aria-labelledby="accounts-h" className="flex flex-col gap-4">
      <div className="tile reveal flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="flex flex-col gap-1.5">
          <h2 id="accounts-h" className="text-muted-foreground text-xs">
            {t("Total")}
          </h2>
          <p
            data-slot="amount-total"
            className={cn(
              "font-display font-medium text-3xl leading-none tracking-tight sm:text-4xl",
              total < 0n && "text-money-out",
            )}
          >
            <MoneyCountUp amount={total.toString()} durationMs={900} />
          </p>
          {safe ? (
            <p className="text-muted-foreground text-xs tabular-nums">
              {safe.perDay !== null ? (
                <>
                  <span className="font-medium text-foreground">{formatIdr(safe.perDay)}</span>
                  {t("/day · {days}d", { days: safe.days })}
                </>
              ) : (
                <span className="font-medium text-money-out">
                  {t("Over by {amount}", { amount: formatIdr(safe.over ?? 0n) })}
                </span>
              )}
            </p>
          ) : null}
          {firstNegative ? (
            <p role="note" className="flex items-center gap-1.5 font-medium text-money-out text-xs">
              <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
              {firstNegative === today
                ? t("Planned bills already take you below zero.")
                : t("Below zero on {date} if nothing changes.", {
                    date: formatDate(firstNegative, { weekday: "short", day: "numeric", month: "short" }, intl),
                  })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/money/sync">
              <RefreshCw aria-hidden className="size-3.5" />
              {t("Sync balances")}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/money/new">
              <Plus aria-hidden className="size-4" />
              {t("Add")}
            </Link>
          </Button>
          <Link
            href="/money/accounts"
            className="rounded-md px-2 py-1.5 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            {t("Manage accounts")}
          </Link>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {active.map((a, i) => {
          const points = series[a.id] ?? [];
          const negative = a.balance < 0n;
          return (
            <li key={a.id}>
              <Tile
                reveal={i + 1}
                spotlight
                className={cn(
                  "relative flex h-full flex-col gap-2 overflow-hidden p-4 pl-5 transition-transform duration-(--dur-fast) hover:-translate-y-0.5",
                  negative && "ring-1 ring-money-out/40",
                )}
                style={{ "--c": a.color } as React.CSSProperties}
              >
                <span aria-hidden className="money-accent absolute inset-y-0 left-0 w-1" />
                <Link
                  href={`/money/transactions?account=${a.id}`}
                  className="flex min-w-0 items-center gap-2 text-sm outline-none after:absolute after:inset-0 focus-visible:after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  <IconBadge icon={accountGlyph(a)} color={a.color} size="sm" />
                  <span className="truncate font-medium">{a.name}</span>
                  {/* Keeps the card link's accessible name (type + balance) for screen readers and e2e. */}
                  <span className="sr-only">
                    {t(", {type}, balance {amount} ", {
                      type: t(ACCOUNT_TYPE_LABELS[a.type]),
                      amount: formatIdr(a.balance),
                    })}
                  </span>
                </Link>
                <AccountBalanceInline
                  accountId={a.id}
                  accountName={a.name}
                  balance={a.balance.toString()}
                  negative={negative}
                />
                {negative ? <span className="font-medium text-money-out text-xs">{t("Overdrawn")}</span> : null}
                <Sparkline points={points} />
              </Tile>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Previous / next month links (?month=YYYY-MM). No "next" past the current month. */
export async function MonthNav({
  prevHref,
  nextHref,
  label,
}: {
  prevHref: string;
  nextHref: string | null;
  label: string;
}) {
  const t = await getT();
  const base =
    "flex size-9 items-center justify-center rounded-full border border-border-soft text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95";
  return (
    <nav aria-label={t("Month: {label}", { label })} className="flex items-center gap-1">
      <Link href={prevHref} className={base} aria-label={t("Previous month")} scroll={false}>
        <ChevronLeft aria-hidden className="size-4" />
      </Link>
      {nextHref ? (
        <Link href={nextHref} className={base} aria-label={t("Next month")} scroll={false}>
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
