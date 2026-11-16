import { Copy, PiggyBank, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { requireUser } from "@/features/auth/queries";
import { copyLastMonthBudgets, saveBudget, suggestBudgets } from "@/features/finance/actions/planning";
import { BudgetList } from "@/features/finance/components/budget-list";
import { MonthNav } from "@/features/finance/components/money-overview";
import { PanelSkeleton } from "@/features/finance/components/money-skeletons";
import { ToastForm } from "@/features/finance/components/toast-form";
import { resolveMonth, shiftMonth } from "@/features/finance/lib/compare-months";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { ensureFinanceDefaults, listCategories } from "@/features/finance/queries";
import { loadBudgetProgress } from "@/features/finance/queries/budget-progress";
import { moneyToday } from "@/features/finance/queries/today";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage({ searchParams }: PageProps<"/money/budgets">) {
  return (
    <SectionErrorBoundary label="Budgets">
      <Suspense fallback={<PanelSkeleton label="Loading budgets" rows={5} />}>
        <Budgets searchParams={searchParams} />
      </Suspense>
    </SectionErrorBoundary>
  );
}

const input =
  "h-10 rounded-md border border-border bg-surface-1 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

async function Budgets({ searchParams }: Pick<PageProps<"/money/budgets">, "searchParams">) {
  await requireUser();
  await ensureFinanceDefaults();
  const [{ today }, params, categories] = await Promise.all([moneyToday(), searchParams, listCategories()]);
  const current = today.slice(0, 7);
  // Budgets may be planned a month ahead.
  const requested = typeof params.month === "string" ? params.month : undefined;
  const month = resolveMonth(requested, shiftMonth(current, 1));
  const { items, uncategorised } = await loadBudgetProgress(month);
  const label = formatDate(`${month}-01`, { month: "long", year: "numeric" });
  const parents = categories.filter((c) => c.kind === "expense" && !c.parentId && !c.archived);
  const withoutBudget = parents.filter((c) => !items.some((i) => i.categoryId === c.id));
  const totalLimit = items.reduce((s, i) => s + i.limit, 0n);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0n);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="font-display font-medium text-2xl">{label}</h2>
          {items.length > 0 ? (
            <p className="text-muted-foreground text-sm tabular-nums">
              {formatIdr(totalSpent)} spent of {formatIdr(totalLimit)} budgeted
            </p>
          ) : null}
        </div>
        <MonthNav
          label={label}
          prevHref={`/money/budgets?month=${shiftMonth(month, -1)}`}
          nextHref={month <= current ? `/money/budgets?month=${shiftMonth(month, 1)}` : null}
        />
      </div>

      {uncategorised > 0n ? (
        <p className="tile flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span>
            <span className="font-medium tabular-nums">{formatIdr(uncategorised)}</span> of spending has no category, so
            no budget counts it.
          </span>
          <Link
            href={`/money/transactions?category=none&kind=expense&month=${month}`}
            className="font-medium text-primary underline underline-offset-2"
          >
            Categorise
          </Link>
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets for this month"
          description="Set a monthly limit per category. Start from last month, or from what you spent on average."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <ToastForm action={copyLastMonthBudgets} fields={{ month }}>
              <SubmitButton size="sm" variant="outline">
                <Copy aria-hidden />
                Copy last month
              </SubmitButton>
            </ToastForm>
            <ToastForm action={suggestBudgets} fields={{ month }}>
              <SubmitButton size="sm">
                <Sparkles aria-hidden />
                Suggest from 3 months
              </SubmitButton>
            </ToastForm>
          </div>
        </EmptyState>
      ) : (
        <section aria-label="Budgets" className="tile p-5">
          <BudgetList items={items} month={month} editable />
        </section>
      )}

      <section aria-labelledby="set-budget-h" className="tile flex flex-col gap-3 p-5">
        <h2 id="set-budget-h" className="font-medium">
          Set a budget
        </h2>
        <ToastForm action={saveBudget} fields={{ month }} className="gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="b-category" className="font-medium text-sm">
                Category
              </label>
              <select id="b-category" name="categoryId" className={input} defaultValue={withoutBudget[0]?.id ?? ""}>
                {parents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {items.some((i) => i.categoryId === c.id) ? " (update)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="b-amount" className="font-medium text-sm">
                Monthly limit
              </label>
              <input
                id="b-amount"
                name="amount"
                inputMode="decimal"
                required
                placeholder="e.g. 600k"
                className={`${input} w-36`}
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" name="rollover" className="size-4 accent-primary" />
              Carry the rest over
            </label>
            <SubmitButton size="sm">Save budget</SubmitButton>
          </div>
          <p className="text-muted-foreground text-xs">
            A category's budget includes its subcategories. Planned bills show as “committed”.
          </p>
        </ToastForm>
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-border-soft border-t pt-3">
            <ToastForm action={copyLastMonthBudgets} fields={{ month }}>
              <SubmitButton size="sm" variant="ghost">
                <Copy aria-hidden />
                Copy missing from last month
              </SubmitButton>
            </ToastForm>
            <ToastForm action={suggestBudgets} fields={{ month }}>
              <SubmitButton size="sm" variant="ghost">
                <Sparkles aria-hidden />
                Suggest the rest
              </SubmitButton>
            </ToastForm>
          </div>
        ) : null}
      </section>
    </div>
  );
}
