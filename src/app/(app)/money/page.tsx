import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { AccountCards } from "@/features/finance/components/money-overview";
import { AccountsSkeleton, ListRowsSkeleton, PanelSkeleton } from "@/features/finance/components/money-skeletons";
import { BudgetWatchCard, UpcomingBillsCard } from "@/features/finance/components/planning-cards";
import { QuickExamples } from "@/features/finance/components/quick-add-bar";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { balanceSeries } from "@/features/finance/lib/balance-series";
import { addDays, localDateFor } from "@/features/finance/lib/local-date";
import { upcomingBills } from "@/features/finance/lib/reminders";
import {
  ensureFinanceDefaults,
  hasAnyTransaction,
  listAccounts,
  listCategories,
  listPostedSince,
  listTransactions,
} from "@/features/finance/queries";
import { loadBudgetProgress } from "@/features/finance/queries/budget-progress";
import { listPeople } from "@/features/finance/queries/people";
import { ensureRecurringGenerated, listBills } from "@/features/finance/queries/planning";
import { loadSafeToSpend } from "@/features/finance/queries/safe-to-spend";
import { moneyToday } from "@/features/finance/queries/today";
import { getSettings } from "@/features/settings/queries";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Money") };
}

const SPARK_DAYS = 7;

/**
 * Money Overview: 4 calm zones — Hero (Total + Safe-to-Spend + Sync/Add),
 * Accounts (7-day sparklines + inline set-balance), Needs attention (omitted
 * when quiet), and Recent transactions. Month & Spending live in Reports.
 */
export default function MoneyPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionErrorBoundary label="Accounts">
        <Suspense fallback={<AccountsSkeleton />}>
          <HeroAndAccounts />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="Needs attention">
        <Suspense fallback={<PanelSkeleton label="Loading bills and budgets" rows={2} />}>
          <NeedsAttention />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="Recent transactions">
        <Suspense fallback={<ListRowsSkeleton rows={5} label="Loading transactions" />}>
          <Recent />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}

async function HeroAndAccounts() {
  await requireUser();
  await ensureFinanceDefaults();
  const { preferences } = await getSettings();
  await io();
  const now = new Date();
  const today = localDateFor(now, preferences.timeZone);
  await ensureRecurringGenerated(today);
  const [accounts, recent, stats] = await Promise.all([
    listAccounts(),
    listPostedSince(addDays(today, -(SPARK_DAYS - 1))),
    loadSafeToSpend(today),
  ]);
  const series = Object.fromEntries(
    accounts.map((a) => [
      a.id,
      balanceSeries(a.id, a.balance, recent, { days: SPARK_DAYS, timeZone: preferences.timeZone, now }),
    ]),
  );
  return (
    <AccountCards
      accounts={accounts}
      series={series}
      safe={stats.safe}
      firstNegative={stats.firstNegative}
      today={today}
    />
  );
}

/** Bills due soon/overdue and budgets near or over limit; renders nothing when healthy. */
async function NeedsAttention() {
  await requireUser();
  await ensureFinanceDefaults();
  const { today } = await moneyToday();
  await ensureRecurringGenerated(today);
  const month = today.slice(0, 7);
  const [bills, categories, budgets] = await Promise.all([listBills(), listCategories(), loadBudgetProgress(month)]);
  const { overdue, soon } = upcomingBills(
    bills.map((b) => ({ ...b, dueOn: b.dueOn ?? b.occurredOn })),
    today,
  );
  const watchBudgets = budgets.items.filter((b) => b.state !== "ok");
  const hasBills = overdue.length + soon.length > 0;
  const hasBudgets = watchBudgets.length > 0;
  if (!hasBills && !hasBudgets) return null;
  return (
    <div className={hasBills && hasBudgets ? "grid gap-6 lg:grid-cols-2" : "flex flex-col gap-6"}>
      {hasBills ? <UpcomingBillsCard overdue={overdue} soon={soon} today={today} categories={categories} /> : null}
      {hasBudgets ? <BudgetWatchCard items={watchBudgets} month={month} /> : null}
    </div>
  );
}

async function Recent() {
  await requireUser();
  await ensureFinanceDefaults();
  const [{ today }, t] = await Promise.all([moneyToday(), getT()]);
  const [{ rows: transactions, more }, accounts, categories, any, people] = await Promise.all([
    listTransactions({}, 10),
    listAccounts(),
    listCategories(),
    hasAnyTransaction(),
    listPeople(),
  ]);

  return (
    <section aria-labelledby="recent-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-h" className="font-medium">
          {t("Recent")}
        </h2>
        {transactions.length > 0 ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/money/transactions">{more ? t("See all") : t("Open in list")}</Link>
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
