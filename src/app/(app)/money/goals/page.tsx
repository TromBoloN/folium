import { Flag, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { CONTROL, CONTROL_HEIGHT } from "@/components/ui/control";
import { requireUser } from "@/features/auth/queries";
import { deleteGoal, saveGoal } from "@/features/finance/actions/planning";
import { PanelSkeleton } from "@/features/finance/components/money-skeletons";
import { ToastForm } from "@/features/finance/components/toast-form";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { goalPace } from "@/features/finance/lib/goals-debts";
import { ensureFinanceDefaults, listAccounts } from "@/features/finance/queries";
import { listGoals } from "@/features/finance/queries/planning";
import { moneyToday } from "@/features/finance/queries/today";
import { formatDate } from "@/lib/dates";
import type { MessageKey } from "@/lib/i18n/core";
import { getI18n, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Goals") };
}

export default function GoalsPage() {
  return (
    <SectionErrorBoundary label="Goals">
      <Suspense fallback={<PanelSkeleton label="Loading goals" rows={3} />}>
        <Goals />
      </Suspense>
    </SectionErrorBoundary>
  );
}

// The shared control look (theme packs restyle it in one place), sized for an inline row.
const input = cn(CONTROL, CONTROL_HEIGHT, "w-auto px-3");

const STATUS: Record<string, MessageKey> = {
  done: "Reached",
  ahead: "Ahead of pace",
  behind: "Behind pace",
  "no-date": "No date set",
  past: "Date passed",
};

async function Goals() {
  await requireUser();
  await ensureFinanceDefaults();
  const [{ today }, goals, accounts, { t, intl }] = await Promise.all([
    moneyToday(),
    listGoals(),
    listAccounts(),
    getI18n(),
  ]);
  const savings = accounts.filter((a) => a.type === "savings" && !a.archived);
  const free = savings.filter((a) => !goals.some((g) => g.accountId === a.id));

  return (
    <div className="flex flex-col gap-6">
      {goals.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No goals yet"
          description="A laptop, next semester's UKT, an emergency buffer. Link a goal to a savings account; moving money into it is your progress."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const account = accounts.find((a) => a.id === g.accountId);
            const pace = goalPace({
              target: g.targetAmount,
              saved: account?.balance ?? 0n,
              createdOn: g.createdOn,
              targetOn: g.targetOn,
              today,
            });
            return (
              <li
                key={g.id}
                className="tile flex flex-col gap-3 p-5"
                style={{ "--c": account?.color } as React.CSSProperties}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="truncate font-medium">{g.name}</h2>
                  <span
                    className={cn(
                      "shrink-0 font-medium text-xs",
                      pace.status === "behind" || pace.status === "past" ? "text-warning" : "text-money-in",
                    )}
                  >
                    {t(STATUS[pace.status])}
                  </span>
                </div>
                <p className="font-display font-medium text-2xl tabular-nums">
                  {formatIdr(pace.saved)}
                  <span className="font-normal font-sans text-muted-foreground text-sm">
                    {" "}
                    {t("of {amount}", { amount: formatIdr(g.targetAmount) })}
                  </span>
                </p>
                <div aria-hidden className="h-2.5 overflow-hidden rounded-pill bg-muted">
                  <span className="money-accent block h-full" style={{ width: `${pace.percent}%` }} />
                </div>
                <p className="text-muted-foreground text-sm">
                  {t("{n}% · in {account}", { n: pace.percent, account: account?.name ?? t("an account") })}
                  {g.targetOn
                    ? t(" · by {date}", {
                        date: formatDate(g.targetOn, { day: "numeric", month: "short", year: "numeric" }, intl),
                      })
                    : ""}
                  {pace.monthlyNeeded
                    ? t(" · {amount} a month to get there", { amount: formatIdr(pace.monthlyNeeded) })
                    : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {pace.status !== "done" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/money/new?kind=transfer&to=${g.accountId}`}>
                        <Plus aria-hidden />
                        {t("Add money")}
                        <span className="sr-only">{t(" to {name}", { name: g.name })}</span>
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/money/recurring/new?template=sinking`}>{t("Set aside monthly")}</Link>
                  </Button>
                  <ToastForm action={deleteGoal} fields={{ id: g.id }} className="ml-auto">
                    <SubmitButton size="sm" variant="ghost" aria-label={t("Delete the goal {name}", { name: g.name })}>
                      <Trash2 aria-hidden />
                    </SubmitButton>
                  </ToastForm>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="new-goal-h" className="tile flex flex-col gap-3 p-5">
        <h2 id="new-goal-h" className="font-medium">
          {t("New goal")}
        </h2>
        {free.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("A goal needs its own savings account.")}{" "}
            <Link href="/money/accounts/new" className="font-medium text-primary underline underline-offset-2">
              {t("Add a savings account")}
            </Link>{" "}
            {t("(type “Savings”) first.")}
          </p>
        ) : (
          <ToastForm action={saveGoal} className="gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <label htmlFor="g-name" className="font-medium text-sm">
                  {t("Name")}
                </label>
                <input
                  id="g-name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder={t("e.g. Laptop")}
                  className={input}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="g-target" className="font-medium text-sm">
                  {t("Target")}
                </label>
                <input
                  id="g-target"
                  name="targetAmount"
                  inputMode="decimal"
                  required
                  placeholder={t("e.g. 8jt")}
                  className={cn(input, "w-32")}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="g-date" className="font-medium text-sm">
                  {t("By")} <span className="font-normal text-muted-foreground">{t("(optional)")}</span>
                </label>
                <input id="g-date" name="targetOn" type="date" min={today} className={input} />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="g-account" className="font-medium text-sm">
                  {t("Savings account")}
                </label>
                <select id="g-account" name="accountId" className={input}>
                  {free.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton size="sm">{t("Add goal")}</SubmitButton>
            </div>
          </ToastForm>
        )}
      </section>
    </div>
  );
}
