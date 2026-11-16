import { Download, Plus, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { getQuickMoneyContext } from "@/features/finance/actions/transactions";
import { AccountCards, MonthOverview } from "@/features/finance/components/money-overview";
import {
  AccountsSkeleton,
  ListRowsSkeleton,
  PanelSkeleton,
  QuickAddSkeleton,
} from "@/features/finance/components/money-skeletons";
import { QuickAddBar, QuickExamples } from "@/features/finance/components/quick-add-bar";
import { SpendingByCategory } from "@/features/finance/components/spending-by-category";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { balanceSeries } from "@/features/finance/lib/balance-series";
import { compareMonths, resolveMonth, shiftMonth } from "@/features/finance/lib/compare-months";
import { addDays, localDateFor } from "@/features/finance/lib/local-date";
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
import { monthBounds, monthTotals } from "@/features/finance/schemas/money-math";
import { getSettings } from "@/features/settings/queries";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Money" };

type Search = Pick<PageProps<"/money">, "searchParams">;

const SPARK_DAYS = 7;

export default function MoneyPage({ searchParams }: PageProps<"/money">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Money"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <a href="/money/export.csv" download>
                <Download aria-hidden />
                Export CSV
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href="/money/new">
                <Plus aria-hidden />
                Add transaction
              </Link>
            </Button>
          </div>
        }
      />
      <SectionErrorBoundary label="Quick add">
        <Suspense fallback={<QuickAddSkeleton />}>
          <Quick searchParams={searchParams} />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="Accounts">
        <Suspense fallback={<AccountsSkeleton />}>
          <Accounts />
        </Suspense>
      </SectionErrorBoundary>
      <div className="grid gap-6 lg:grid-cols-2">
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
  const [{ preferences }, params] = await Promise.all([getSettings(), searchParams]);
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);
  const current = today.slice(0, 7);
  const month = resolveMonth(params.month, current);
  return { today, month, current, timeZone: preferences.timeZone, params };
}

const monthLabel = (month: string, withYear: boolean) =>
  formatDate(`${month}-01`, withYear ? { month: "long", year: "numeric" } : { month: "long" });

async function Quick({ searchParams }: Search) {
  await requireUser();
  await ensureFinanceDefaults();
  const [context, params] = await Promise.all([getQuickMoneyContext(), searchParams]);
  if (!context.ok) throw new Error(context.error);
  const quick = typeof params.quick === "string" ? params.quick.slice(0, 300) : "";
  return <QuickAddBar context={context.data} initialText={quick} />;
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
  const { month, current } = await pageMonth(searchParams);
  const previous = shiftMonth(month, -1);
  const [thisRows, lastRows] = await Promise.all([
    listPostedInOut(monthBounds(month).from, monthBounds(month).to),
    listPostedInOut(monthBounds(previous).from, monthBounds(previous).to),
  ]);
  const totals = monthTotals(thisRows);
  const last = monthTotals(lastRows);
  const sameYear = month.slice(0, 4) === current.slice(0, 4);
  return (
    <MonthOverview
      summary={{
        month,
        label: month === current ? "This month" : monthLabel(month, !sameYear),
        income: totals.income,
        expense: totals.expense,
        comparison: compareMonths(totals.expense, last.expense),
        previousLabel: monthLabel(previous, previous.slice(0, 4) !== current.slice(0, 4)),
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
  const { today, month, current } = await pageMonth(searchParams);
  const [{ rows: transactions, more }, accounts, categories, any] = await Promise.all([
    listTransactions({ month }, 15),
    listAccounts(),
    listCategories(),
    hasAnyTransaction(),
  ]);
  const listHref = `/money/transactions?month=${month}`;

  return (
    <section aria-labelledby="recent-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-h" className="font-medium">
          {month === current ? "Recent" : `In ${monthLabel(month, month.slice(0, 4) !== current.slice(0, 4))}`}
        </h2>
        {transactions.length > 0 ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={listHref}>{more ? "See all" : "Open in list"}</Link>
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
        <TransactionList transactions={transactions} accounts={accounts} categories={categories} today={today} />
      )}
    </section>
  );
}
