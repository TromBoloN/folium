import { Pause, Plus, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { BillRow } from "@/features/finance/components/bills";
import { ListRowsSkeleton } from "@/features/finance/components/money-skeletons";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { addDays } from "@/features/finance/lib/local-date";
import { cadenceLabel, monthlyEquivalent } from "@/features/finance/lib/recurrence";
import { RULE_TEMPLATES } from "@/features/finance/lib/rule-templates";
import { ensureFinanceDefaults, listCategories } from "@/features/finance/queries";
import { ensureRecurringGenerated, listBills, listPaidFromRules, listRules } from "@/features/finance/queries/planning";
import { moneyToday } from "@/features/finance/queries/today";
import { monthBounds } from "@/features/finance/schemas/money-math";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Recurring" };

export default function RecurringPage() {
  return (
    <SectionErrorBoundary label="Recurring">
      <Suspense fallback={<ListRowsSkeleton rows={5} label="Loading recurring" />}>
        <Recurring />
      </Suspense>
    </SectionErrorBoundary>
  );
}

function Group({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <h2 className="px-1 font-medium text-sm">
        {title} <span className="text-muted-foreground">· {count}</span>
      </h2>
      <ul className="tile flex flex-col divide-y divide-border-soft overflow-hidden">{children}</ul>
    </section>
  );
}

async function Recurring() {
  await requireUser();
  await ensureFinanceDefaults();
  const { today, timeZone } = await moneyToday();
  await ensureRecurringGenerated(today, timeZone);
  const { from, to: monthEnd } = monthBounds(today.slice(0, 7));
  const [bills, rules, categories, paid] = await Promise.all([
    listBills(),
    listRules(),
    listCategories(),
    listPaidFromRules(from, monthEnd),
  ]);
  const weekEnd = addDays(today, 7);
  const overdue = bills.filter((b) => (b.dueOn ?? b.occurredOn) < today);
  const thisWeek = bills.filter((b) => (b.dueOn ?? b.occurredOn) >= today && (b.dueOn ?? b.occurredOn) <= weekEnd);
  const laterMonth = bills.filter((b) => (b.dueOn ?? b.occurredOn) > weekEnd && (b.dueOn ?? b.occurredOn) <= monthEnd);
  const paused = rules.filter((r) => !r.active || (r.pausedUntil && r.pausedUntil >= today));

  const outgoing = (k: string) => k === "expense";
  const fixedMonthly = rules
    .filter((r) => r.active && outgoing(r.kind))
    .reduce((s, r) => s + monthlyEquivalent(r.amount, r.cadence, r.intervalCount), 0n);
  const paidThisMonth = paid.filter((t) => outgoing(t.kind)).reduce((s, t) => s + t.amount, 0n);
  const remainingThisMonth = bills
    .filter((b) => outgoing(b.kind) && (b.dueOn ?? b.occurredOn) <= monthEnd)
    .reduce((s, b) => s + b.amount, 0n);
  const next30 = bills
    .filter(
      (b) => outgoing(b.kind) && (b.dueOn ?? b.occurredOn) >= today && (b.dueOn ?? b.occurredOn) <= addDays(today, 30),
    )
    .reduce((s, b) => s + b.amount, 0n);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Fixed per month", fixedMonthly],
            ["Paid this month", paidThisMonth],
            ["Still to pay this month", remainingThisMonth],
            ["Next 30 days", next30],
          ].map(([term, value]) => (
            <div key={String(term)} className="tile flex flex-col gap-1 p-4">
              <dt className="text-muted-foreground text-xs">{String(term)}</dt>
              <dd className="font-display font-medium text-lg tabular-nums">{formatIdr(value as bigint)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section aria-labelledby="templates-h" className="flex flex-col gap-2">
        <h2 id="templates-h" className="px-1 font-medium text-sm">
          Add
        </h2>
        <ul className="flex flex-wrap gap-2">
          {RULE_TEMPLATES.map((t) => (
            <li key={t.key}>
              <Link
                href={`/money/recurring/new?template=${t.key}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 text-sm transition-colors duration-(--dur-fast) hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95"
              >
                <Plus aria-hidden className="size-3.5" />
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {rules.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nothing recurring yet"
          description="Add kos, UKT, subscriptions and your allowance once; Folium plans them ahead so you see what's coming and what's safe to spend."
        >
          <Button asChild size="sm">
            <Link href="/money/recurring/new?template=kos">Add your kos</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <Group title="Overdue" count={overdue.length}>
            {overdue.map((b) => (
              <BillRow key={b.id} bill={b} today={today} categories={categories} />
            ))}
          </Group>
          <Group title="Due this week" count={thisWeek.length}>
            {thisWeek.map((b) => (
              <BillRow key={b.id} bill={b} today={today} categories={categories} />
            ))}
          </Group>
          <Group title="Later this month" count={laterMonth.length}>
            {laterMonth.map((b) => (
              <BillRow key={b.id} bill={b} today={today} categories={categories} />
            ))}
          </Group>
          {overdue.length + thisWeek.length + laterMonth.length === 0 ? (
            <p className="px-1 text-muted-foreground text-sm">Nothing left to pay this month.</p>
          ) : null}

          <section aria-labelledby="rules-h" className="flex flex-col gap-1.5">
            <h2 id="rules-h" className="px-1 font-medium text-sm">
              All recurring <span className="text-muted-foreground">· {rules.length}</span>
            </h2>
            <ul className="tile flex flex-col divide-y divide-border-soft overflow-hidden">
              {rules.map((r) => {
                const isPaused = paused.includes(r);
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link href={`/money/recurring/${r.id}`} className="truncate font-medium text-sm hover:underline">
                        {r.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {cadenceLabel(r)}
                        {r.instalmentsTotal ? ` · ${r.instalmentsTotal} payments` : ""}
                        {isPaused
                          ? r.pausedUntil
                            ? ` · paused until ${formatDate(r.pausedUntil, { day: "numeric", month: "short" })}`
                            : " · paused"
                          : ""}
                      </span>
                    </div>
                    {isPaused ? <Pause aria-label="Paused" className="size-4 text-muted-foreground" /> : null}
                    <span className="font-medium text-sm tabular-nums">
                      {r.isEstimate ? "~" : ""}
                      {formatIdr(r.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
