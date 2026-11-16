import "server-only";
import { type BudgetProgress, budgetProgress } from "../lib/budgets";
import { shiftMonth } from "../lib/compare-months";
import { monthBounds } from "../schemas/money-math";
import { listCategories } from "./index";
import { listBudgets, listExpenseLines } from "./planning";

/** Everything the Budgets tab and the Overview widget need for one month. */
export async function loadBudgetProgress(month: string): Promise<{
  items: BudgetProgress[];
  uncategorised: bigint;
}> {
  const previous = shiftMonth(month, -1);
  const { from, to } = monthBounds(month);
  const prev = monthBounds(previous);
  const [budgets, categories, spent, previousSpent, planned] = await Promise.all([
    listBudgets(month, previous),
    listCategories(),
    listExpenseLines(from, to, "posted"),
    listExpenseLines(prev.from, prev.to, "posted"),
    listExpenseLines(from, to, "planned"),
  ]);
  const items = budgetProgress({
    budgets: budgets.current,
    previous: budgets.previous,
    categories,
    spent,
    previousSpent,
    planned,
  });
  const uncategorised = spent.filter((l) => !l.categoryId).reduce((s, l) => s + l.amount, 0n);
  return { items, uncategorised };
}
