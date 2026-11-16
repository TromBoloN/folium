import { Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { TransactionFilters } from "@/features/finance/components/transaction-filters";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { localDateFor } from "@/features/finance/lib/local-date";
import { ensureFinanceDefaults, listAccounts, listCategories, listTransactions } from "@/features/finance/queries";
import { transactionFiltersSchema } from "@/features/finance/schemas";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage({ searchParams }: PageProps<"/money/transactions">) {
  return (
    <>
      <PageHeader
        title="Transactions"
        back={<BackLink href="/money">Money</BackLink>}
        action={
          <Button asChild size="sm">
            <Link href="/money/new">
              <Plus aria-hidden />
              Add transaction
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton rows={5} label="Loading transactions" />}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Transactions({ searchParams }: Pick<PageProps<"/money/transactions">, "searchParams">) {
  await requireUser();
  await ensureFinanceDefaults();
  const params = await searchParams;
  const filters = transactionFiltersSchema.parse({
    account: params.account || undefined,
    category: params.category || undefined,
    kind: params.kind || undefined,
    month: params.month || undefined,
    q: typeof params.q === "string" ? params.q : undefined,
  });
  const [transactions, accounts, categories, { preferences }] = await Promise.all([
    listTransactions(filters),
    listAccounts(),
    listCategories(),
    getSettings(),
  ]);
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);
  return (
    <div className="flex flex-col gap-5">
      <TransactionFilters filters={filters} accounts={accounts} categories={categories} />
      {transactions.length === 0 ? (
        <EmptyState icon={SearchX} title="Nothing here" description="No transactions match these filters." />
      ) : (
        <TransactionList transactions={transactions} accounts={accounts} categories={categories} today={today} />
      )}
      {transactions.length === 200 ? (
        <p className="text-muted-foreground text-sm">Showing the newest 200. Narrow the filters to see older ones.</p>
      ) : null}
    </div>
  );
}
