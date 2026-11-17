import { HandCoins, Pencil } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { formatDate } from "@/lib/dates";
import { EN, type I18n, type T, tEn } from "@/lib/i18n/core";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { formatIdr } from "../lib/format-idr";
import { addDays } from "../lib/local-date";
import type { Account, Category, Transaction } from "../queries";
import { isDebtKind, KIND_LABELS } from "../schemas";
import { groupByDay } from "../schemas/money-math";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { categoryGlyph, IconBadge, KIND_ICONS } from "./money-icon";
import { NewRowMark } from "./new-row-mark";

type Props = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  /** Names for debt rows ("Lent to Budi"). */
  people?: { id: string; name: string }[];
  today: string;
};

/** "Lent to Budi", "Budi paid you back"… */
function debtTitle(kind: string, name: string, tr: T) {
  if (kind === "lend") return tr("Lent to {name}", { name });
  if (kind === "repay") return tr("{name} paid you back", { name });
  if (kind === "borrow") return tr("Borrowed from {name}", { name });
  return tr("Paid {name} back", { name });
}

/** "Today", "Yesterday", a weekday within the last week, else a date (with the year if it isn't this one). */
export function dayLabel(date: string, today: string, { t, intl }: I18n = EN) {
  if (date === today) return t("Today");
  if (date === addDays(today, -1)) return t("Yesterday");
  if (date < today && date > addDays(today, -7)) return formatDate(date, { weekday: "long" }, intl);
  return date.slice(0, 4) === today.slice(0, 4)
    ? formatDate(date, { weekday: "short", day: "numeric", month: "short" }, intl)
    : formatDate(date, { day: "numeric", month: "short", year: "numeric" }, intl);
}

/** A day's posted net (income minus expenses; transfers and adjustments are moves, not spending). */
function dayNet(rows: readonly Transaction[]) {
  let net = 0n;
  for (const t of rows) {
    if (t.status !== "posted") continue;
    if (t.kind === "income") net += t.amount;
    else if (t.kind === "expense") net -= t.amount;
  }
  return net;
}

/** Transactions grouped by day, newest first. Used on /money and /money/transactions. */
export async function TransactionList({ transactions, accounts, categories, people = [], today }: Props) {
  const i18n = await getI18n();
  const account = new Map(accounts.map((a) => [a.id, a]));
  const category = new Map(categories.map((c) => [c.id, c]));
  const person = new Map(people.map((p) => [p.id, p.name]));
  return (
    <ol className="flex flex-col gap-5">
      {groupByDay(transactions).map((group) => {
        const net = dayNet(group.rows);
        return (
          <li key={group.date} className="flex flex-col gap-1.5">
            <h3 className="flex items-baseline justify-between gap-3 px-1 text-sm">
              <span className="font-medium">{dayLabel(group.date, today, i18n)}</span>
              {net !== 0n ? (
                <span className={cn("tabular-nums", net > 0n ? "text-money-in" : "text-muted-foreground")}>
                  <span className="sr-only">{i18n.t("Net")} </span>
                  {net > 0n ? "+" : "−"}
                  {formatIdr(net < 0n ? -net : net)}
                </span>
              ) : null}
            </h3>
            <ul className="tile flex flex-col divide-y divide-border-soft overflow-hidden">
              {group.rows.map((t) => (
                <TransactionRow key={t.id} t={t} account={account} category={category} person={person} tr={i18n.t} />
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** One transaction: coloured icon, title and details, a signed amount, and edit/delete on hover, focus or touch. */
export function TransactionRow({
  t,
  account,
  category,
  person = new Map(),
  tr = tEn,
}: {
  t: Transaction;
  account: Map<string, Account>;
  category: Map<string, Category>;
  person?: Map<string, string>;
  tr?: T;
}) {
  const debt = isDebtKind(t.kind);
  const cat = t.categoryId ? category.get(t.categoryId) : undefined;
  const from = account.get(t.accountId);
  const to = t.toAccountId ? account.get(t.toAccountId) : undefined;
  const planned = t.status === "planned";
  const sign: "+" | "−" | "" =
    t.kind === "income" ||
    t.kind === "repay" ||
    t.kind === "borrow" ||
    (t.kind === "adjustment" && t.adjustmentDirection === "in")
      ? "+"
      : t.kind === "transfer"
        ? ""
        : "−";

  const title =
    t.kind === "transfer"
      ? `${from?.name ?? "?"} → ${to?.name ?? "?"}`
      : t.kind === "adjustment"
        ? tr("Balance adjustment")
        : debt
          ? debtTitle(t.kind, (t.personId && person.get(t.personId)) || tr("someone"), tr)
          : (t.payee ?? cat?.name ?? tr(KIND_LABELS[t.kind]));

  const fallback = debt
    ? HandCoins
    : t.kind === "transfer"
      ? KIND_ICONS.transfer
      : t.kind === "adjustment"
        ? t.adjustmentDirection === "in"
          ? KIND_ICONS.adjustmentIn
          : KIND_ICONS.adjustmentOut
        : t.kind === "income"
          ? KIND_ICONS.income
          : KIND_ICONS.expense;
  const icon = t.kind === "expense" || t.kind === "income" ? categoryGlyph(cat, fallback) : fallback;
  const subtitle = [
    t.kind === "adjustment" ? (t.adjustmentDirection === "in" ? tr("Money in") : tr("Money out")) : null,
    t.payee && cat ? cat.name : null,
    t.kind !== "transfer" ? from?.name : null,
    t.note,
  ]
    .filter(Boolean)
    .join(" · ");
  const amountText = `${sign}${formatIdr(t.amount)}`;

  return (
    <NewRowMark
      id={t.id}
      className={cn(
        "group/row flex items-center gap-3 px-4 py-2.5",
        planned && "bg-muted/30 outline outline-1 outline-border outline-dashed -outline-offset-4",
      )}
    >
      <IconBadge icon={icon} color={cat?.color ?? (t.kind === "transfer" ? null : from?.color)} dashed={planned} />
      <Link
        href={`/money/${t.id}/edit`}
        className="flex min-w-0 flex-1 flex-col rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-medium text-sm hover:underline", planned && "text-muted-foreground")}>
            {title}
          </span>
          {planned ? <Pill tone="warning">{tr("Planned")}</Pill> : null}
        </span>
        {subtitle ? <span className="truncate text-muted-foreground text-xs">{subtitle}</span> : null}
      </Link>
      <span className="flex shrink-0 flex-col items-end">
        <span
          data-slot="amount"
          className={cn(
            "font-medium text-sm tabular-nums",
            planned
              ? "text-muted-foreground"
              : sign === "+"
                ? "text-money-in"
                : sign === "−" && t.kind === "expense"
                  ? "text-money-out"
                  : "text-foreground",
          )}
        >
          {amountText}
        </span>
        {t.feeAmount > 0n ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {tr("fee {amount}", { amount: formatIdr(t.feeAmount) })}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center transition-opacity duration-(--dur-fast) group-focus-within/row:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100">
        <Link
          href={`/money/${t.id}/edit`}
          aria-label={tr("Edit {name}", { name: title })}
          className="hidden size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:flex"
        >
          <Pencil aria-hidden className="size-4" />
        </Link>
        <DeleteTransactionButton id={t.id} label={`${title}, ${amountText}`} />
      </span>
    </NewRowMark>
  );
}
