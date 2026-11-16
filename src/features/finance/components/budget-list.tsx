import { Trash2 } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/action-form";
import { cn } from "@/lib/utils";
import { deleteBudget } from "../actions/planning";
import { type BudgetProgress, budgetLabel } from "../lib/budgets";
import { formatIdr } from "../lib/format-idr";
import { ToastForm } from "./toast-form";

/** A budget bar: spent, then committed (planned bills) in a lighter shade. Decorative; the text says it all. */
function Bar({ p }: { p: BudgetProgress }) {
  const limit = p.limit > 0n ? p.limit : 1n;
  const spent = Math.min(100, Number((p.spent * 100n) / limit));
  const committed = Math.max(0, Math.min(100 - spent, Number((p.committed * 100n) / limit)));
  return (
    <div aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-muted">
      <span
        className={cn(
          "h-full",
          p.state === "over" ? "bg-money-out" : p.state === "warn" ? "bg-warning" : "money-accent",
        )}
        style={{ width: `${spent}%`, "--c": p.color } as React.CSSProperties}
      />
      <span
        className="h-full bg-[repeating-linear-gradient(45deg,var(--border)_0_4px,transparent_4px_8px)]"
        style={{ width: `${committed}%` }}
      />
    </div>
  );
}

/** Budget rows: name, "82% used" or "over by", spent / committed / left, and a bar. */
export function BudgetList({
  items,
  month,
  editable = false,
}: {
  items: BudgetProgress[];
  month: string;
  editable?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((p) => (
        <li key={p.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <Link
              href={`/money/transactions?category=${p.categoryId}&month=${month}`}
              className="truncate font-medium hover:underline"
            >
              {p.name}
            </Link>
            <span
              className={cn(
                "shrink-0 font-medium tabular-nums",
                p.state === "over" ? "text-money-out" : p.state === "warn" ? "text-warning" : "text-muted-foreground",
              )}
            >
              {budgetLabel(p, formatIdr)}
            </span>
          </div>
          <Bar p={p} />
          <div className="flex flex-wrap items-center justify-between gap-x-3 text-muted-foreground text-xs tabular-nums">
            <span>
              {formatIdr(p.spent)} of {formatIdr(p.limit)}
              {p.carry !== 0n
                ? ` (${p.carry > 0n ? "+" : "−"}${formatIdr(p.carry > 0n ? p.carry : -p.carry)} carried)`
                : ""}
              {p.committed > 0n ? ` · ${formatIdr(p.committed)} committed` : ""}
            </span>
            <span className={cn(p.left < 0n && "text-money-out")}>
              {p.left >= 0n ? `${formatIdr(p.left)} left` : `${formatIdr(-p.left)} short`}
            </span>
          </div>
          {editable ? (
            <ToastForm action={deleteBudget} fields={{ id: p.id }} className="items-end">
              <SubmitButton size="sm" variant="ghost" className="h-7 text-muted-foreground">
                <Trash2 aria-hidden />
                Remove<span className="sr-only"> the {p.name} budget</span>
              </SubmitButton>
            </ToastForm>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
