import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { AccountCards, MonthOverview } from "@/features/finance/components/money-overview";
import { AccountsSkeleton, ListRowsSkeleton, PanelSkeleton } from "@/features/finance/components/money-skeletons";
import { BudgetWatchCard, SafeToSpendCard, UpcomingBillsCard } from "@/features/finance/components/planning-cards";
import { QuickExamples } from "@/features/finance/components/quick-add-bar";
import { SpendingByCategory } from "@/features/finance/components/spending-by-category";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { balanceSeries } from "@/features/finance/lib/balance-series";
import { compareMonths, resolveMonth, shiftMonth } from "@/features/finance/lib/compare-months";
import { addDays, localDateFor } from "@/features/finance/lib/local-date";
import { upcomingBills } from "@/features/finance/lib/reminders";
import { rollupByCategory } from "@/features/finance/lib/rollup-by-category";
import {
  ensureFinanceDefaults,
  hasAnyTransaction,
  listAccounts,
  listCategories,
  listPostedInOut,
  listPostedSince,
  listTransactions,
} from "@/features/finance/queries";
import { loadBudgetProgress } from "@/features/finance/queries/budget-progress";
import { listPeople } from "@/features/finance/queries/people";
import { ensureRecurringGenerated, listBills } from "@/features/finance/queries/planning";
import { loadSafeToSpend } from "@/features/finance/queries/safe-to-spend";
import { moneyToday } from "@/features/finance/queries/today";
import { monthBounds, monthTotals } from "@/features/finance/schemas/money-math";
import { getSettings } from "@/features/settings/queries";
import { formatDate } from "@/lib/dates";
import { getI18n, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Money") };
}

type Search = Pick<PageProps<"/money">, "searchParams">;

const SPARK_DAYS = 7;

export default function MoneyPage({ searchParams }: PageProps<"/money">) {
  return (
    <div className="flex flex-col gap-6">
      <SectionErrorBoundary label="Accounts">
        <Suspense fallback={<AccountsSkeleton />}>
          <Accounts />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="Planning">
        <Suspense fallback={<PanelSkeleton label="Loading bills and budgets" rows={3} />}>
          <Planning />
        </Suspense>
      </SectionErrorBoundary>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionErrorBoundary label="This month">
          <Suspense fallback={<PanelSkeleton label="Loading this month" rows={2} />}>
            <Month searchParams={searchParams} />
          </Suspense>
        </SectionErrorBoundary>
        <SectionErrorBoundary label="Spending by category">
          <Suspense fallback={<PanelSkeleton label="Loading spending" rows={4} />}>
            <Spending searchParams={searchParams} />
          </Suspense>
        </SectionErrorBoundary>
      </div>
      <SectionErrorBoundary label="Recent transactions">
        <Suspense fallback={<ListRowsSkeleton rows={5} label="Loading transactions" />}>
          <Recent searchParams={searchParams} />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}

/** Today in the user's zone, and the month the page shows (?month=, never in the future). */
async function pageMonth(searchParams: Search["searchParams"]) {
  const [{ preferences }, params, i18n] = await Promise.all([getSettings(), searchParams, getI18n()]);
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);
  const current = today.slice(0, 7);
  const month = resolveMonth(params.month, current);
  return { today, month, current, timeZone: preferences.timeZone, params, i18n };
}

const monthLabel = (month: string, withYear: boolean, intl: string) =>
  formatDate(`${month}-01`, withYear ? { month: "long", year: "numeric" } : { month: "long" }, intl);

/** Safe to spend, bills due soon and the budgets closest to their limit (generates planned bills first). */
async function Planning() {
  await requireUser();
  await ensureFinanceDefaults();
  const { today } = await moneyToday();
  await ensureRecurringGenerated(today);
  const month = today.slice(0, 7);
  const [stats, bills, categories, budgets] = await Promise.all([
    loadSafeToSpend(today),
    listBills(),
    listCategories(),
    loadBudgetProgress(month),
  ]);
  const { overdue, soon } = upcomingBills(
    bills.map((b) => ({ ...b, dueOn: b.dueOn ?? b.occurredOn })),
    today,
  );
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SafeToSpendCard safe={stats.safe} points={stats.points} firstNegative={stats.firstNegative} today={today} />
      <UpcomingBillsCard overdue={overdue} soon={soon} today={today} categories={categories} />
      <BudgetWatchCard items={budgets.items} month={month} />
    </div>
  );
}

async function Accounts() {
  await requireUser();
  await ensureFinanceDefaults();
  const { preferences } = await getSettings();
  await io();
  const now = new Date();
  const today = localDateFor(now, preferences.timeZone);
  const [accounts, recent] = await Promise.all([listAccounts(), listPostedSince(addDays(today, -(SPARK_DAYS - 1)))]);
  const series = Object.fromEntries(
    accounts.map((a) => [
      a.id,
      balanceSeries(a.id, a.balance, recent, { days: SPARK_DAYS, timeZone: preferences.timeZone, now }),
    ]),
  );
  return <AccountCards accounts={accounts} series={series} />;
}

async function Month({ searchParams }: Search) {
  await requireUser();
  await ensureFinanceDefaults();
  const { month, current, i18n } = await pageMonth(searchParams);
  const previous = shiftMonth(month, -1);
  const [thisRows, lastRows] = await Promise.all([
    listPostedInOut(monthBounds(month).from, monthBounds(month).to),
    listPostedInOut(monthBounds(previous).from, monthBounds(previous).to),
  ]);
  const totals = monthTotals(thisRows);
  const last = monthTotals(lastRows);
  return (
    <MonthOverview
      summary={{
        month,
        // Always the month's name, so the arrows beside it make sense.
        label: monthLabel(month, true, i18n.intl),
        income: totals.income,
        expense: totals.expense,
        comparison: compareMonths(totals.expense, last.expense),
        previousLabel: monthLabel(previous, previous.slice(0, 4) !== current.slice(0, 4), i18n.intl),
        prevHref: `/money?month=${previous}`,
        nextHref:
          month < current
            ? shiftMonth(month, 1) === current
              ? "/money"
              : `/money?month=${shiftMonth(month, 1)}`
            : null,
      }}
    />
  );
}

async function Spending({ searchParams }: Search) {
  await requireUser();
  await ensureFinanceDefaults();
  const { month } = await pageMonth(searchParams);
  const { from, to } = monthBounds(month);
  const [rows, categories] = await Promise.all([listPostedInOut(from, to), listCategories()]);
  const { slices, total } = rollupByCategory(rows, categories);
  return <SpendingByCategory slices={slices} total={total} month={month} />;
}

async function Recent({ searchParams }: Search) {
  await requireUser();
  await ensureFinanceDefaults();
  const { today, month, current, i18n } = await pageMonth(searchParams);
  const { t } = i18n;
  const [{ rows: transactions, more }, accounts, categories, any, people] = await Promise.all([
    listTransactions({ month }, 15),
    listAccounts(),
    listCategories(),
    hasAnyTransaction(),
    listPeople(),
  ]);
  const listHref = `/money/transactions?month=${month}`;

  return (
    <section aria-labelledby="recent-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-h" className="font-medium">
          {month === current
            ? t("Recent")
            : t("In {month}", { month: monthLabel(month, month.slice(0, 4) !== current.slice(0, 4), i18n.intl) })}
        </h2>
        {transactions.length > 0 ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={listHref}>{more ? t("See all") : t("Open in list")}</Link>
          </Button>
        ) : null}
      </div>
      {!any ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Type one line in the box above and press Enter. Try one of these:"
        >
          <QuickExamples />
        </EmptyState>
      ) : transactions.length === 0 ? (
        <EmptyState icon={Receipt} title="Nothing this month" description="No transactions in this month yet." />
      ) : (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          people={people}
          today={today}
        />
      )}
    </section>
  );
}
