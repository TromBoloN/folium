/**
 * Budget progress for one month. A parent category's budget includes its
 * children. Spent = posted expenses; committed = planned expenses still to come
 * (recurring bills), shown separately: left = limit − spent − committed.
 * Rollover (opt-in per budget) carries last month's unspent or overspent amount
 * one month forward (not chained further back).
 */

export type BudgetRow = { id: string; categoryId: string; amount: bigint; rollover: boolean };
export type BudgetCategory = { id: string; name: string; parentId: string | null; color: string };
export type SpendLine = { categoryId: string | null; amount: bigint };

export type BudgetState = "ok" | "warn" | "over";

export type BudgetProgress = {
  id: string;
  categoryId: string;
  name: string;
  color: string;
  amount: bigint;
  carry: bigint;
  limit: bigint;
  spent: bigint;
  committed: bigint;
  left: bigint;
  /** Whole percent of the limit spent (may pass 100). */
  percent: number;
  state: BudgetState;
};

/** A category's id plus its children's (they roll up into it). */
export function withChildren(categoryId: string, categories: readonly BudgetCategory[]): Set<string> {
  return new Set([categoryId, ...categories.filter((c) => c.parentId === categoryId).map((c) => c.id)]);
}

function sumFor(ids: Set<string>, lines: readonly SpendLine[]): bigint {
  let sum = 0n;
  for (const l of lines) if (l.categoryId && ids.has(l.categoryId)) sum += l.amount;
  return sum;
}

export function budgetProgress(input: {
  budgets: readonly BudgetRow[];
  previous: readonly BudgetRow[];
  categories: readonly BudgetCategory[];
  spent: readonly SpendLine[];
  previousSpent: readonly SpendLine[];
  planned: readonly SpendLine[];
}): BudgetProgress[] {
  const byId = new Map(input.categories.map((c) => [c.id, c]));
  return input.budgets
    .map((b) => {
      const ids = withChildren(b.categoryId, input.categories);
      const spent = sumFor(ids, input.spent);
      const committed = sumFor(ids, input.planned);
      const prev = input.previous.find((p) => p.categoryId === b.categoryId);
      const carry = b.rollover && prev ? prev.amount - sumFor(ids, input.previousSpent) : 0n;
      const limit = b.amount + carry;
      const percent = limit > 0n ? Number((spent * 100n) / limit) : spent > 0n ? 100 : 0;
      const state: BudgetState = spent > limit ? "over" : percent >= 80 ? "warn" : "ok";
      const category = byId.get(b.categoryId);
      return {
        id: b.id,
        categoryId: b.categoryId,
        name: category?.name ?? "Category",
        color: category?.color ?? "#495057",
        amount: b.amount,
        carry,
        limit,
        spent,
        committed,
        left: limit - spent - committed,
        percent,
        state,
      };
    })
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
}

/** "82% used", "over by Rp 40.000": words, never colour alone. */
export function budgetLabel(
  p: Pick<BudgetProgress, "spent" | "limit" | "percent" | "state">,
  format: (n: bigint) => string,
) {
  if (p.state === "over") return `Over by ${format(p.spent - p.limit)}`;
  return `${p.percent}% used`;
}

/**
 * A starting budget from the last months' spending: the monthly average,
 * rounded UP to the next Rp 5.000. Null when nothing was spent.
 */
export function suggestBudget(monthlyTotals: readonly bigint[]): bigint | null {
  const spent = monthlyTotals.filter((t) => t > 0n);
  if (spent.length === 0) return null;
  const average = monthlyTotals.reduce((s, t) => s + t, 0n) / BigInt(monthlyTotals.length);
  const step = 5000n;
  const rounded = ((average + step - 1n) / step) * step;
  return rounded > 0n ? rounded : step;
}
