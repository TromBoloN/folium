import { Archive, Check, HandCoins, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { addPerson, setPersonArchived, settlePerson, splitBillAction } from "@/features/finance/actions/debts";
import { PanelSkeleton } from "@/features/finance/components/money-skeletons";
import { ToastForm } from "@/features/finance/components/toast-form";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { personBalanceLabel } from "@/features/finance/lib/goals-debts";
import { ensureFinanceDefaults, lastUsedAccountId, listAccounts, listCategories } from "@/features/finance/queries";
import { listPeople } from "@/features/finance/queries/people";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Debts") };
}

export default function DebtsPage() {
  return (
    <SectionErrorBoundary label="Debts">
      <Suspense fallback={<PanelSkeleton label="Loading debts" rows={4} />}>
        <Debts />
      </Suspense>
    </SectionErrorBoundary>
  );
}

const input =
  "h-10 rounded-md border border-border bg-surface-1 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

async function Debts() {
  await requireUser();
  await ensureFinanceDefaults();
  const [people, accounts, categories, t] = await Promise.all([listPeople(), listAccounts(), listCategories(), getT()]);
  const active = accounts.filter((a) => !a.archived);
  const defaultAccount = (await lastUsedAccountId(accounts)) ?? active[0]?.id ?? "";
  const owedToMe = people.reduce((s, p) => s + (p.balance > 0n ? p.balance : 0n), 0n);
  const iOwe = people.reduce((s, p) => s + (p.balance < 0n ? -p.balance : 0n), 0n);
  const shown = people.filter((p) => !p.archived || p.balance !== 0n);
  const accountSelect = (id: string) => (
    <select id={id} name="accountId" defaultValue={defaultAccount} className={input}>
      {active.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3">
        <div className="tile flex flex-col gap-1 p-4">
          <dt className="text-muted-foreground text-xs">{t("Owed to you")}</dt>
          <dd className="font-display font-medium text-money-in text-xl tabular-nums">{formatIdr(owedToMe)}</dd>
        </div>
        <div className="tile flex flex-col gap-1 p-4">
          <dt className="text-muted-foreground text-xs">{t("You owe")}</dt>
          <dd className="font-display font-medium text-money-out text-xl tabular-nums">{formatIdr(iOwe)}</dd>
        </div>
      </dl>

      {shown.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No debts"
          description="Lend, borrow or split a bill with friends. Lending moves real money out of an account, so balances stay right, and it never counts as spending."
        >
          <Button asChild size="sm">
            <Link href="/money/new?kind=lend">{t("Record a loan")}</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="tile flex flex-col divide-y divide-border-soft overflow-hidden">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground text-sm"
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-sm">{p.name}</span>
                <span
                  className={cn(
                    "text-xs",
                    p.balance > 0n ? "text-money-in" : p.balance < 0n ? "text-money-out" : "text-muted-foreground",
                  )}
                >
                  {personBalanceLabel(p.name, p.balance, formatIdr, t)}
                </span>
              </div>
              {p.balance !== 0n ? (
                <ToastForm
                  action={settlePerson}
                  fields={{ personId: p.id }}
                  className="flex-row flex-wrap items-center gap-2"
                >
                  <label htmlFor={`settle-${p.id}`} className="sr-only">
                    {t("Account for settling with {name}", { name: p.name })}
                  </label>
                  {accountSelect(`settle-${p.id}`)}
                  <SubmitButton size="sm" variant="outline">
                    <Check aria-hidden />
                    {t("Mark settled")}
                    <span className="sr-only">{t(" with {name}", { name: p.name })}</span>
                  </SubmitButton>
                </ToastForm>
              ) : (
                <ToastForm action={setPersonArchived} fields={{ id: p.id, archive: "true" }}>
                  <SubmitButton size="sm" variant="ghost" aria-label={t("Hide {name}", { name: p.name })}>
                    <Archive aria-hidden />
                  </SubmitButton>
                </ToastForm>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["lend", "I lent money"],
            ["borrow", "I borrowed"],
            ["repay", "Someone paid me back"],
            ["payback", "I paid someone back"],
          ] as const
        ).map(([kind, label]) => (
          <Button key={kind} asChild size="sm" variant="outline">
            <Link href={`/money/new?kind=${kind}`}>{t(label)}</Link>
          </Button>
        ))}
      </div>

      <section aria-labelledby="split-h" className="tile flex flex-col gap-3 p-5">
        <h2 id="split-h" className="flex items-center gap-2 font-medium">
          <HandCoins aria-hidden className="size-4 text-muted-foreground" />
          {t("Split a bill (patungan)")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("You paid the whole bill. Your share becomes an expense; each friend's share is a loan to them.")}
        </p>
        <ToastForm action={splitBillAction} className="gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="s-amount" className="font-medium text-sm">
                {t("Total")}
              </label>
              <input
                id="s-amount"
                name="amount"
                inputMode="decimal"
                required
                placeholder={t("e.g. {example}", { example: "150k" })}
                className={`${input} w-32`}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="s-payee" className="font-medium text-sm">
                {t("What")}
              </label>
              <input id="s-payee" name="payee" maxLength={120} placeholder={t("e.g. Pizza night")} className={input} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="s-account" className="font-medium text-sm">
                {t("Paid from")}
              </label>
              {accountSelect("s-account")}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="s-category" className="font-medium text-sm">
                {t("Your share's category")}
              </label>
              <select id="s-category" name="categoryId" className={input}>
                <option value="">{t("No category")}</option>
                {categories
                  .filter((c) => c.kind === "expense" && !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="s-names" className="font-medium text-sm">
              {t("Split with")}
            </label>
            <input
              id="s-names"
              name="names"
              list="people-list"
              required
              placeholder={t("Names, separated by commas: Budi, Sari")}
              aria-describedby="s-names-hint"
              className={input}
            />
            <datalist id="people-list">
              {people
                .filter((p) => !p.archived)
                .map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
            </datalist>
            <p id="s-names-hint" className="text-muted-foreground text-xs">
              {t("New names are added as people.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeMe" defaultChecked className="size-4 accent-primary" />
              {t("Include my own share")}
            </label>
            <SubmitButton size="sm">{t("Split it")}</SubmitButton>
          </div>
        </ToastForm>
      </section>

      <section aria-labelledby="add-person-h" className="tile flex flex-col gap-3 p-5">
        <h2 id="add-person-h" className="font-medium">
          {t("Add a person")}
        </h2>
        <ToastForm action={addPerson} className="flex-row flex-wrap items-end gap-2">
          <label htmlFor="p-name" className="sr-only">
            {t("Name")}
          </label>
          <input id="p-name" name="name" required maxLength={60} placeholder={t("Name")} className={input} />
          <SubmitButton size="sm" variant="outline">
            {t("Add")}
          </SubmitButton>
        </ToastForm>
      </section>
    </div>
  );
}
