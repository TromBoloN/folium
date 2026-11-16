import { CalendarClock, Check, Repeat } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/action-form";
import { Pill } from "@/components/ui/pill";
import { EN, type I18n, plural } from "@/lib/i18n/core";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { markPaid } from "../actions/planning";
import { formatIdr } from "../lib/format-idr";
import { addDays } from "../lib/local-date";
import type { Category } from "../queries";
import type { Bill } from "../queries/planning";
import { categoryGlyph, IconBadge, KIND_ICONS } from "./money-icon";
import { ToastForm } from "./toast-form";
import { dayLabel } from "./transaction-list";

/** "Due today", "Due tomorrow", "Due Fri 21 Nov", "3 days overdue". */
export function dueText(dueOn: string, today: string, i18n: I18n = EN) {
  const { t } = i18n;
  if (dueOn === today) return t("Due today");
  if (dueOn === addDays(today, 1)) return t("Due tomorrow");
  if (dueOn < today) {
    const days = Math.round((Date.parse(today) - Date.parse(dueOn)) / 86_400_000);
    return t(plural(days, "{n} day overdue", "{n} days overdue"), { n: days });
  }
  return t("Due {when}", { when: dayLabel(dueOn, today, i18n) });
}

/** One planned bill (or allowance, or set-aside) with "Mark paid" (and the real amount for an estimate). */
export async function BillRow({
  bill,
  today,
  categories,
  compact = false,
}: {
  bill: Bill;
  today: string;
  categories: Category[];
  compact?: boolean;
}) {
  const i18n = await getI18n();
  const { t } = i18n;
  const cat = bill.categoryId ? categories.find((c) => c.id === bill.categoryId) : undefined;
  const name = bill.rule?.name ?? bill.payee ?? bill.note ?? t("Bill");
  const due = bill.dueOn ?? bill.occurredOn;
  const overdue = due < today;
  const estimate = bill.rule?.isEstimate ?? false;
  const fallback = bill.kind === "income" ? KIND_ICONS.income : bill.kind === "transfer" ? KIND_ICONS.transfer : Repeat;
  const markLabel =
    bill.kind === "income" ? t("Mark received") : bill.kind === "transfer" ? t("Mark done") : t("Mark paid");
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <IconBadge icon={categoryGlyph(cat, fallback)} color={cat?.color} size={compact ? "sm" : "md"} />
      <div className="flex min-w-0 flex-1 flex-col">
        {bill.rule ? (
          <Link href={`/money/recurring/${bill.rule.id}`} className="truncate font-medium text-sm hover:underline">
            {name}
          </Link>
        ) : (
          <span className="truncate font-medium text-sm">{name}</span>
        )}
        <span className={cn("flex items-center gap-1 text-xs", overdue ? "text-money-out" : "text-muted-foreground")}>
          <CalendarClock aria-hidden className="size-3.5" />
          {dueText(due, today, i18n)}
        </span>
      </div>
      <span
        className={cn(
          "font-medium text-sm tabular-nums",
          bill.kind === "income" ? "text-money-in" : bill.kind === "expense" ? "text-money-out" : "",
        )}
      >
        {bill.kind === "income" ? "+" : bill.kind === "expense" ? "−" : ""}
        {estimate ? "~" : ""}
        {formatIdr(bill.amount)}
        {estimate ? <span className="sr-only">{t(" (estimate)")}</span> : null}
      </span>
      {estimate && !compact ? <Pill tone="warning">{t("Estimate")}</Pill> : null}
      <ToastForm action={markPaid} fields={{ id: bill.id }} className="flex-row items-center gap-1.5">
        {estimate && !compact ? (
          <>
            <label htmlFor={`paid-${bill.id}`} className="sr-only">
              {t("Amount paid for {name}", { name })}
            </label>
            <input
              id={`paid-${bill.id}`}
              name="amount"
              inputMode="decimal"
              placeholder={String(bill.amount)}
              className="h-9 w-24 rounded-md border border-border bg-surface-1 px-2 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
          </>
        ) : null}
        <SubmitButton size="sm" variant="outline" pendingLabel="…">
          <Check aria-hidden />
          {markLabel}
          <span className="sr-only">: {name}</span>
        </SubmitButton>
      </ToastForm>
    </li>
  );
}
