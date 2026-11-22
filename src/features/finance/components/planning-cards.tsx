import { CalendarClock, PiggyBank } from "lucide-react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "../lib/budgets";
import type { Category } from "../queries";
import type { Bill } from "../queries/planning";
import { BillRow } from "./bills";
import { BudgetList } from "./budget-list";

const head = "flex items-center justify-between gap-3";

/** Overdue and this week's bills with "Mark paid". Hidden when nothing is due. */
export async function UpcomingBillsCard({
  overdue,
  soon,
  today,
  categories,
}: {
  overdue: Bill[];
  soon: Bill[];
  today: string;
  categories: Category[];
}) {
  const bills = [...overdue, ...soon].slice(0, 5);
  if (bills.length === 0) return null;
  const t = await getT();
  return (
    <section
      aria-labelledby="bills-h"
      className="tile reveal flex flex-col overflow-hidden"
      style={{ "--i": 6 } as React.CSSProperties}
    >
      <div className={cn(head, "px-5 pt-5 pb-2")}>
        <h2 id="bills-h" className="flex items-center gap-2 font-medium">
          <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
          {t("Upcoming bills")}
        </h2>
        <Link href="/money/recurring" className="text-muted-foreground text-xs hover:text-foreground hover:underline">
          {t("All recurring")}
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-border-soft">
        {bills.map((b) => (
          <BillRow key={b.id} bill={b} today={today} categories={categories} compact />
        ))}
      </ul>
    </section>
  );
}

/** Budgets near or over their limit. Hidden when none need attention. */
export async function BudgetWatchCard({ items, month }: { items: BudgetProgress[]; month: string }) {
  if (items.length === 0) return null;
  const t = await getT();
  return (
    <section
      aria-labelledby="watch-h"
      className="tile reveal flex flex-col gap-4 p-5"
      style={{ "--i": 7 } as React.CSSProperties}
    >
      <div className={head}>
        <h2 id="watch-h" className="flex items-center gap-2 font-medium">
          <PiggyBank aria-hidden className="size-4 text-muted-foreground" />
          {t("Budgets")}
        </h2>
        <Link
          href={`/money/budgets?month=${month}`}
          className="text-muted-foreground text-xs hover:text-foreground hover:underline"
        >
          {t("All budgets")}
        </Link>
      </div>
      <BudgetList items={items.slice(0, 3)} month={month} />
    </section>
  );
}
