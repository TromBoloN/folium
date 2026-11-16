import { Receipt, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { ListRowsSkeleton } from "@/features/finance/components/money-skeletons";
import { TransactionFilters } from "@/features/finance/components/transaction-filters";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { filtersHref } from "@/features/finance/lib/filters-href";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { localDateFor } from "@/features/finance/lib/local-date";
import {
  ensureFinanceDefaults,
  hasAnyTransaction,
  listAccounts,
  listCategories,
  listTransactions,
  summarizeTransactions,
} from "@/features/finance/queries";
import { listPeople } from "@/features/finance/queries/people";
import { transactionFiltersSchema } from "@/features/finance/schemas";
import { getSettings } from "@/features/settings/queries";
import { plural } from "@/lib/i18n/core";
import { rich } from "@/lib/i18n/rich";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Transactions") };
}

const PAGE = 50;
const MAX = 1000;

export default function TransactionsPage({ searchParams }: PageProps<"/money/transactions">) {
  return (
    <Suspense fallback={<ListRowsSkeleton rows={6} label="Loading transactions" />}>
      <Transactions searchParams={searchParams} />
    </Suspense>
  );
}

async function Transactions({ searchParams }: Pick<PageProps<"/money/transactions">, "searchParams">) {
  await requireUser();
  await ensureFinanceDefaults();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const filters = transactionFiltersSchema.parse({
    account: one(params.account),
    category: one(params.category),
    kind: one(params.kind),
    month: one(params.month),
    q: one(params.q),
  });
  // "Load more" grows the page size in the URL, so it works without JavaScript and survives a reload.
  const requested = Number.parseInt(one(params.limit) ?? "", 10);
  const limit = Number.isFinite(requested) ? Math.min(MAX, Math.max(PAGE, requested)) : PAGE;

  const [{ rows, more }, summary, accounts, categories, { preferences }, any, people] = await Promise.all([
    listTransactions(filters, limit),
    summarizeTransactions(filters),
    listAccounts(),
    listCategories(),
    getSettings(),
    hasAnyTransaction(),
    listPeople(),
  ]);
  const t = await getT();
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);
  const filtered = Object.values(filters).some(Boolean);
  const moreHref = `${filtersHref(filters)}${filtered ? "&" : "?"}limit=${limit + PAGE}`;

  return (
    <div className="flex flex-col gap-5">
      <TransactionFilters
        filters={filters}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, archived: a.archived }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          parentId: c.parentId,
          archived: c.archived,
        }))}
        currentMonth={today.slice(0, 7)}
      />
      {rows.length > 0 ? (
        <p className="px-1 text-muted-foreground text-sm" aria-live="polite">
          {rich(
            t(
              plural(
                summary.count,
                "1 transaction · in {income} · out {expense}",
                "{n} transactions · in {income} · out {expense}",
              ),
              {
                n: summary.count,
              },
            ),
            {
              income: <span className="font-medium text-money-in tabular-nums">{formatIdr(summary.income)}</span>,
              expense: <span className="font-medium text-money-out tabular-nums">{formatIdr(summary.expense)}</span>,
            },
          )}
        </p>
      ) : null}
      {!any ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Add one from Money with a single line, or the full form."
        >
          <Button asChild size="sm">
            <Link href="/money">{t("Go to Money")}</Link>
          </Button>
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No matches" description="Nothing matches these filters.">
          <Button asChild size="sm" variant="outline">
            <Link href="/money/transactions">{t("Clear all filters")}</Link>
          </Button>
        </EmptyState>
      ) : (
        <TransactionList
          transactions={rows}
          accounts={accounts}
          categories={categories}
          people={people}
          today={today}
        />
      )}
      {more && limit < MAX ? (
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href={moreHref} scroll={false}>
              {t("Load more")}
            </Link>
          </Button>
        </div>
      ) : more ? (
        <p className="text-center text-muted-foreground text-sm">
          {t("Showing the newest {n}. Narrow the filters to see older ones.", { n: MAX })}
        </p>
      ) : null}
    </div>
  );
}
