import Link from "next/link";
import { requireUser } from "@/features/auth/queries";
import { dueText } from "@/features/finance/components/bills";
import { budgetLabel } from "@/features/finance/lib/budgets";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { upcomingBills } from "@/features/finance/lib/reminders";
import { ensureFinanceDefaults } from "@/features/finance/queries";
import { loadBudgetProgress } from "@/features/finance/queries/budget-progress";
import { ensureRecurringGenerated, listBills } from "@/features/finance/queries/planning";
import { loadSafeToSpend } from "@/features/finance/queries/safe-to-spend";
import { moneyToday } from "@/features/finance/queries/today";
import { cn } from "@/lib/utils";

/** Today's money: safe to spend, bills due this week, and budgets past 80%. In-app reminders, no cron. */
export async function MoneyWidget() {
  await requireUser();
  await ensureFinanceDefaults();
  const { today } = await moneyToday();
  await ensureRecurringGenerated(today);
  const [stats, bills, budgets] = await Promise.all([
    loadSafeToSpend(today),
    listBills(),
    loadBudgetProgress(today.slice(0, 7)),
  ]);
  const { overdue, soon } = upcomingBills(
    bills.filter((b) => b.kind !== "income").map((b) => ({ ...b, dueOn: b.dueOn ?? b.occurredOn })),
    today,
  );
  const due = [...overdue, ...soon].slice(0, 3);
  const hot = budgets.items.filter((b) => b.state !== "ok").slice(0, 2);
  const { safe } = stats;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">Safe to spend</span>
        {safe.perDay !== null ? (
          <span className="font-display font-medium text-2xl tabular-nums">
            {formatIdr(safe.perDay)}
            <span className="font-normal font-sans text-muted-foreground text-sm"> a day · {safe.days}d</span>
          </span>
        ) : (
          <span className="font-display font-medium text-2xl text-money-out tabular-nums">
            Over by {formatIdr(safe.over ?? 0n)}
          </span>
        )}
      </div>
      {due.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {due.map((b) => (
            <li key={b.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {b.rule?.name ?? b.payee ?? "Bill"}{" "}
                <span className={cn("text-xs", b.dueOn < today ? "text-money-out" : "text-muted-foreground")}>
                  {dueText(b.dueOn, today)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatIdr(b.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No bills due this week.</p>
      )}
      {hot.length > 0 ? (
        <ul className="flex flex-col gap-1 border-border-soft border-t pt-3 text-sm">
          {hot.map((b) => (
            <li key={b.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate">{b.name}</span>
              <span
                className={cn("shrink-0 font-medium text-xs", b.state === "over" ? "text-money-out" : "text-warning")}
              >
                {budgetLabel(b, formatIdr)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href="/money/recurring"
        className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
      >
        Bills and recurring
      </Link>
    </div>
  );
}
