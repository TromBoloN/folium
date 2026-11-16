import { Download, Landmark, Plus, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { AccountCards, MonthTotals } from "@/features/finance/components/money-overview";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { localDateFor } from "@/features/finance/lib/local-date";
import {
  ensureFinanceDefaults,
  listAccounts,
  listCategories,
  listPostedInOut,
  listTransactions,
} from "@/features/finance/queries";
import { monthRange, monthTotals } from "@/features/finance/schemas/money-math";
import { getSettings } from "@/features/settings/queries";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Money" };

function CardsSkeleton({ count, label }: { count: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="h-24 animate-pulse rounded-tile bg-muted" />
      ))}
    </div>
  );
}

export default function MoneyPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Money"
        description="Your accounts and what came in and went out. Press N to add one in a line: “gofood 32k #food @gopay”."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/money/accounts">
                <Landmark aria-hidden />
                Accounts
              </Link>
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
      <SectionErrorBoundary label="Accounts">
        <Suspense fallback={<CardsSkeleton count={4} label="Loading accounts" />}>
          <Accounts />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="This month">
        <Suspense fallback={<CardsSkeleton count={3} label="Loading this month" />}>
          <ThisMonth />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary label="Recent transactions">
        <Suspense fallback={<ListSkeleton rows={4} label="Loading transactions" />}>
          <Recent />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}

async function Accounts() {
  await requireUser();
  await ensureFinanceDefaults();
  return <AccountCards accounts={await listAccounts()} />;
}

async function ThisMonth() {
  await requireUser();
  await ensureFinanceDefaults();
  const { preferences } = await getSettings();
  await io();
  const { from, to, month } = monthRange(localDateFor(new Date(), preferences.timeZone));
  const totals = monthTotals(await listPostedInOut(from, to));
  return (
    <MonthTotals
      income={totals.income}
      expense={totals.expense}
      label={formatDate(`${month}-01`, { month: "long", year: "numeric" })}
    />
  );
}

async function Recent() {
  await requireUser();
  await ensureFinanceDefaults();
  const { preferences } = await getSettings();
  const [transactions, accounts, categories] = await Promise.all([
    listTransactions({}, 15),
    listAccounts(),
    listCategories(),
  ]);
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);

  return (
    <section aria-labelledby="recent-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-h" className="font-medium">
          Recent
        </h2>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost">
            <a href="/money/export.csv" download>
              <Download aria-hidden />
              Export CSV
            </a>
          </Button>
          {transactions.length > 0 ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/money/transactions">All transactions</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Add what you spend and receive, and Folium keeps each account's balance. Your four usual accounts are ready: Livin' by Mandiri, DANA, GoPay and Cash."
        >
          <Button asChild size="sm">
            <Link href="/money/new">Add your first transaction</Link>
          </Button>
        </EmptyState>
      ) : (
        <TransactionList transactions={transactions} accounts={accounts} categories={categories} today={today} />
      )}
    </section>
  );
}
