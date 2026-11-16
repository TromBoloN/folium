import { ArrowRightLeft, Pencil, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatIdr } from "../lib/format-idr";
import type { Account, Category, Transaction } from "../queries";
import { groupByDay } from "../schemas/money-math";
import { DeleteTransactionButton } from "./delete-transaction-button";

type Props = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  today: string;
};

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  const full = formatDate(date, { weekday: "short", day: "numeric", month: "short" });
  return date.slice(0, 4) === today.slice(0, 4)
    ? full
    : formatDate(date, { day: "numeric", month: "short", year: "numeric" });
}

/** Transactions grouped by day, newest first; each row opens the edit sheet and can be deleted with Undo. */
export function TransactionList({ transactions, accounts, categories, today }: Props) {
  const account = new Map(accounts.map((a) => [a.id, a]));
  const category = new Map(categories.map((c) => [c.id, c]));
  return (
    <ol className="flex flex-col gap-4">
      {groupByDay(transactions).map((group) => {
        const net = group.rows.reduce(
          (sum, t) =>
            t.status !== "posted"
              ? sum
              : t.kind === "income"
                ? sum + t.amount
                : t.kind === "expense"
                  ? sum - t.amount
                  : sum,
          0n,
        );
        return (
          <li key={group.date} className="flex flex-col gap-1.5">
            <h3 className="flex items-baseline justify-between gap-3 px-1 text-sm">
              <span className="font-medium">{dayLabel(group.date, today)}</span>
              {net !== 0n ? (
                <span className="text-muted-foreground tabular-nums">
                  {net > 0n ? "+" : ""}
                  {formatIdr(net)}
                </span>
              ) : null}
            </h3>
            <ul className="tile flex flex-col divide-y divide-border-soft overflow-hidden">
              {group.rows.map((t) => {
                const cat = t.categoryId ? category.get(t.categoryId) : undefined;
                const from = account.get(t.accountId);
                const to = t.toAccountId ? account.get(t.toAccountId) : undefined;
                const sign =
                  t.kind === "income" || (t.kind === "adjustment" && t.adjustmentDirection === "in")
                    ? "+"
                    : t.kind === "transfer"
                      ? ""
                      : "−";
                const title =
                  t.kind === "transfer"
                    ? `${from?.name ?? "?"} → ${to?.name ?? "?"}`
                    : t.kind === "adjustment"
                      ? "Balance adjustment"
                      : (t.payee ?? cat?.name ?? (t.kind === "income" ? "Income" : "Expense"));
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--c)_22%,var(--surface-1))]"
                      style={{ "--c": cat?.color ?? from?.color ?? "var(--muted-foreground)" } as React.CSSProperties}
                    >
                      {t.kind === "transfer" ? (
                        <ArrowRightLeft className="size-4" />
                      ) : t.kind === "adjustment" ? (
                        <SlidersHorizontal className="size-4" />
                      ) : (
                        <span className="size-2.5 rounded-full bg-(--c)" />
                      )}
                    </span>
                    <Link href={`/money/${t.id}/edit`} className="group/tx flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm group-hover/tx:underline">{title}</span>
                        {t.status === "planned" ? <Pill tone="warning">Planned</Pill> : null}
                      </span>
                      <span className="truncate text-muted-foreground text-xs">
                        {[cat && t.payee ? cat.name : null, t.kind !== "transfer" ? from?.name : null, t.note]
                          .filter(Boolean)
                          .join(" · ")}
                        {t.feeAmount > 0n ? ` · fee ${formatIdr(t.feeAmount)}` : ""}
                      </span>
                    </Link>
                    <span
                      className={cn(
                        "shrink-0 font-medium text-sm tabular-nums",
                        sign === "+" && "text-primary",
                        t.status === "planned" && "text-muted-foreground",
                      )}
                    >
                      {sign}
                      {formatIdr(t.amount)}
                    </span>
                    <span className="flex shrink-0 items-center">
                      <Link
                        href={`/money/${t.id}/edit`}
                        aria-label={`Edit ${title}`}
                        className="hidden size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
                      >
                        <Pencil aria-hidden className="size-4" />
                      </Link>
                      <DeleteTransactionButton id={t.id} label={`${title}, ${formatIdr(t.amount)}`} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
