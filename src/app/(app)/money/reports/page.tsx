import { BarChart3, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { requireUser } from "@/features/auth/queries";
import { PanelSkeleton } from "@/features/finance/components/money-skeletons";
import { shiftMonth } from "@/features/finance/lib/compare-months";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { addDays } from "@/features/finance/lib/local-date";
import {
  categoryTrends,
  insights,
  monthlyInOut,
  netWorthByMonth,
  type ReportRow,
  savingsRate,
  topPayees,
} from "@/features/finance/lib/reports";
import { ensureFinanceDefaults, listAccounts, listCategories, listPostedSince } from "@/features/finance/queries";
import { ensureRecurringGenerated, listBills } from "@/features/finance/queries/planning";
import { moneyToday } from "@/features/finance/queries/today";
import { monthBounds } from "@/features/finance/schemas/money-math";
import { formatDate } from "@/lib/dates";
import { plural } from "@/lib/i18n/core";
import { getI18n, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Reports") };
}

export default function ReportsPage() {
  return (
    <SectionErrorBoundary label="Reports">
      <Suspense fallback={<PanelSkeleton label="Loading reports" rows={6} />}>
        <Reports />
      </Suspense>
    </SectionErrorBoundary>
  );
}

const short = (n: bigint) => {
  const abs = n < 0n ? -n : n;
  const sign = n < 0n ? "−" : "";
  if (abs >= 1_000_000n) return `${sign}${(Number(abs) / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (abs >= 1_000n) return `${sign}${Math.round(Number(abs) / 1_000)}rb`;
  return `${sign}${abs}`;
};

async function Reports() {
  await requireUser();
  await ensureFinanceDefaults();
  const { today } = await moneyToday();
  await ensureRecurringGenerated(today);
  const current = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(current, i - 11));
  const firstEnd = monthBounds(months[0]).from;
  const { t, intl } = await getI18n();
  const [rows, accounts, categories, bills] = await Promise.all([
    listPostedSince(addDays(firstEnd, -1)),
    listAccounts(),
    listCategories(),
    listBills(),
  ]);
  const report: ReportRow[] = rows;
  const inOut = monthlyInOut(report, months);
  const anything = inOut.some((m) => m.income > 0n || m.expense > 0n);
  if (!anything) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing to report yet"
        description="Reports fill in as you add income and spending: month by month, categories, top payees and your net worth."
      />
    );
  }
  const total = accounts.reduce((s, a) => s + a.balance, 0n);
  const worth = netWorthByMonth(
    total,
    report,
    months.map((m) => monthBounds(m).to),
  );
  const previous = shiftMonth(current, -1);
  const trends = categoryTrends(report, categories, current, previous);
  const monthRows = report.filter((r) => r.occurredOn.startsWith(current));
  const year = current.slice(0, 4);
  const yearRows = inOut.filter((m) => m.month.startsWith(year));
  const yearIncome = yearRows.reduce((s, m) => s + m.income, 0n);
  const yearExpense = yearRows.reduce((s, m) => s + m.expense, 0n);
  const thisMonth = inOut[inOut.length - 1];
  const rate = savingsRate(thisMonth.income, thisMonth.expense);
  const weekEnd = addDays(today, 7);
  const renewing = bills.filter(
    (b) => b.kind === "expense" && (b.dueOn ?? b.occurredOn) >= today && (b.dueOn ?? b.occurredOn) <= weekEnd,
  ).length;
  const notes = insights({
    trends,
    previousLabel: formatDate(`${previous}-01`, { month: "long" }, intl),
    renewingThisWeek: renewing,
    t,
  });
  // The tallest bar (bigint, so no Math.max).
  let maxBar = 1n;
  for (const x of inOut) for (const v of [x.income, x.expense]) if (v > maxBar) maxBar = v;
  const worthValues = worth.map((w) => Number(w.total));
  const wMin = Math.min(...worthValues, 0);
  const wMax = Math.max(...worthValues, 0);
  const wSpan = wMax - wMin || 1;
  const monthName = (m: string) => formatDate(`${m}-01`, { month: "short" }, intl);

  return (
    <div className="flex flex-col gap-6">
      {notes.length > 0 ? (
        <section aria-labelledby="insights-h" className="tile flex flex-col gap-2 p-5">
          <h2 id="insights-h" className="flex items-center gap-2 font-medium">
            <Lightbulb aria-hidden className="size-4 text-muted-foreground" />
            {t("Worth knowing")}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="inout-h" className="tile flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="inout-h" className="font-medium">
            {t("In and out, last 12 months")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {rate === null ? t("No income this month") : t("Kept {n}% of this month's income", { n: rate })}
          </p>
        </div>
        <div aria-hidden className="flex h-40 items-end gap-1.5">
          {inOut.map((m) => (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <span
                  className="w-1/2 max-w-3 rounded-t-sm bg-money-in"
                  style={{ height: `${Number((m.income * 100n) / maxBar)}%` }}
                />
                <span
                  className="w-1/2 max-w-3 rounded-t-sm bg-money-out"
                  style={{ height: `${Number((m.expense * 100n) / maxBar)}%` }}
                />
              </div>
              <span className="text-[0.625rem] text-muted-foreground">{monthName(m.month).slice(0, 3)}</span>
            </div>
          ))}
        </div>
        <details>
          <summary className="cursor-pointer text-muted-foreground text-sm hover:text-foreground">
            {t("Show the numbers")}
          </summary>
          <table className="mt-2 w-full text-sm tabular-nums">
            <caption className="sr-only">{t("Income and expenses by month")}</caption>
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th scope="col" className="py-1 font-normal">
                  {t("Month")}
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  {t("In")}
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  {t("Out")}
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  {t("Net")}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...inOut].reverse().map((m) => (
                <tr key={m.month} className="border-border-soft border-t">
                  <th scope="row" className="py-1 text-left font-normal">
                    {formatDate(`${m.month}-01`, { month: "long", year: "numeric" }, intl)}
                  </th>
                  <td className="py-1 text-right text-money-in">{formatIdr(m.income)}</td>
                  <td className="py-1 text-right text-money-out">{formatIdr(m.expense)}</td>
                  <td className={cn("py-1 text-right", m.income - m.expense < 0n && "text-money-out")}>
                    {formatIdr(m.income - m.expense)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="worth-h" className="tile flex flex-col gap-3 p-5">
          <h2 id="worth-h" className="font-medium">
            {t("Net worth")}
          </h2>
          <p className="font-display font-medium text-2xl tabular-nums">{formatIdr(total)}</p>
          <svg
            aria-hidden
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="h-24 w-full overflow-visible"
            focusable="false"
          >
            <path
              d={worthValues
                .map(
                  (v, i) =>
                    `${i ? "L" : "M"}${((i / (worthValues.length - 1)) * 100).toFixed(1)} ${((1 - (v - wMin) / wSpan) * 40).toFixed(1)}`,
                )
                .join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.75"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <p className="text-muted-foreground text-sm">
            {t("{amount} at the end of {month}; all accounts together (money lent out not included).", {
              amount: formatIdr(worth[0].total),
              month: formatDate(`${months[0]}-01`, { month: "long", year: "numeric" }, intl),
            })}
          </p>
        </section>

        <section aria-labelledby="year-h" className="tile flex flex-col gap-3 p-5">
          <h2 id="year-h" className="font-medium">
            {t("{year} so far", { year })}
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{t("In")}</dt>
              <dd className="font-medium text-money-in tabular-nums">{short(yearIncome)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t("Out")}</dt>
              <dd className="font-medium text-money-out tabular-nums">{short(yearExpense)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t("Kept")}</dt>
              <dd className="font-medium tabular-nums">
                {savingsRate(yearIncome, yearExpense) === null ? "—" : `${savingsRate(yearIncome, yearExpense)}%`}
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground text-xs">
            In: {formatIdr(yearIncome)}. Out: {formatIdr(yearExpense)}. Transfers, adjustments and debts aren't counted.
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="trends-h" className="tile flex flex-col gap-3 p-5">
          <h2 id="trends-h" className="font-medium">
            {t("Categories vs {month}", { month: formatDate(`${previous}-01`, { month: "long" }, intl) })}
          </h2>
          {trends.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("No categorised spending in these two months.")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-soft text-sm">
              {trends.slice(0, 8).map((trend) => (
                <li key={trend.categoryId} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{trend.name}</span>
                  <span className="tabular-nums">{formatIdr(trend.current)}</span>
                  <span
                    className={cn(
                      "w-24 text-right text-xs tabular-nums",
                      trend.change?.direction === "more"
                        ? "text-money-out"
                        : trend.change?.direction === "less"
                          ? "text-money-in"
                          : "text-muted-foreground",
                    )}
                  >
                    {trend.change === null
                      ? t("new")
                      : trend.change.direction === "same"
                        ? t("same")
                        : trend.change.direction === "more"
                          ? t("▲ {n}% more", { n: trend.change.percent })
                          : t("▼ {n}% less", { n: trend.change.percent })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="payees-h" className="tile flex flex-col gap-3 p-5">
          <h2 id="payees-h" className="font-medium">
            {t("Top payees this month")}
          </h2>
          {topPayees(monthRows).length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("No payees this month yet.")}</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border-soft text-sm">
              {topPayees(monthRows).map((p) => (
                <li key={p.payee} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{p.payee}</span>
                  <span className="text-muted-foreground text-xs">
                    {t(plural(p.count, "1 time", "{n} times"), { n: p.count })}
                  </span>
                  <span className="tabular-nums">{formatIdr(p.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
