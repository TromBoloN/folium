import { Pause, Play, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SubmitButton } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { deleteRule, pauseRule } from "@/features/finance/actions/planning";
import { RuleForm } from "@/features/finance/components/rule-form";
import { ToastForm } from "@/features/finance/components/toast-form";
import { ensureFinanceDefaults, listAccounts, listCategories } from "@/features/finance/queries";
import { getRule } from "@/features/finance/queries/planning";
import { moneyToday } from "@/features/finance/queries/today";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Edit recurring" };

export default function EditRulePage({ params }: PageProps<"/money/recurring/[id]">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton label="Loading" />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: Pick<PageProps<"/money/recurring/[id]">, "params">) {
  await requireUser();
  await ensureFinanceDefaults();
  const [{ id }, accounts, categories, { today }] = await Promise.all([
    params,
    listAccounts(),
    listCategories(),
    moneyToday(),
  ]);
  const rule = await getRule(id);
  if (!rule) notFound();
  const paused = rule.pausedUntil !== null && rule.pausedUntil >= today;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title={rule.name} back={<BackLink href="/money/recurring">Recurring</BackLink>} />
        <p className="-mt-3 mb-5 text-muted-foreground text-sm">
          Changes apply to upcoming payments only. Paid ones stay as they were.
        </p>
        <RuleForm
          defaults={{
            id: rule.id,
            name: rule.name,
            kind: rule.kind,
            amount: rule.amount.toString(),
            isEstimate: rule.isEstimate,
            accountId: rule.accountId,
            toAccountId: rule.toAccountId ?? "",
            categoryId: rule.categoryId ?? "",
            payee: rule.payee ?? "",
            cadence: rule.cadence,
            intervalCount: String(rule.intervalCount),
            dueDay: rule.dueDay ? String(rule.dueDay) : "",
            startsOn: rule.startsOn,
            endsOn: rule.endsOn ?? "",
            instalmentsTotal: rule.instalmentsTotal ? String(rule.instalmentsTotal) : "",
            remindDaysBefore: String(rule.remindDaysBefore),
          }}
          accounts={accounts
            .filter((a) => !a.archived || a.id === rule.accountId)
            .map((a) => ({ id: a.id, name: a.name }))}
          categories={categories
            .filter((c) => !c.archived || c.id === rule.categoryId)
            .map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        />
      </div>
      <section aria-labelledby="rule-actions-h" className="tile flex flex-col gap-3 p-5">
        <h2 id="rule-actions-h" className="font-medium">
          Pause or delete
        </h2>
        {paused ? (
          <p className="text-sm">
            Paused until {formatDate(rule.pausedUntil as string, { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        ) : null}
        <div className="flex flex-wrap items-start gap-2">
          {paused ? (
            <ToastForm action={pauseRule} fields={{ id: rule.id, until: "" }}>
              <SubmitButton size="sm" variant="outline">
                <Play aria-hidden />
                Resume
              </SubmitButton>
            </ToastForm>
          ) : (
            <ToastForm action={pauseRule} fields={{ id: rule.id }} className="flex-row flex-wrap items-center gap-2">
              <label htmlFor="until" className="text-sm">
                Pause until
              </label>
              <input
                id="until"
                name="until"
                type="date"
                min={today}
                required
                className="h-9 rounded-md border border-border bg-surface-1 px-2 text-sm"
              />
              <SubmitButton size="sm" variant="outline">
                <Pause aria-hidden />
                Pause
              </SubmitButton>
            </ToastForm>
          )}
          <ToastForm action={deleteRule} fields={{ id: rule.id }}>
            <SubmitButton size="sm" variant="ghost" className="text-destructive">
              <Trash2 aria-hidden />
              Delete
            </SubmitButton>
          </ToastForm>
        </div>
        <p className="text-muted-foreground text-xs">
          Deleting keeps every payment already made; upcoming planned ones are removed.
        </p>
      </section>
    </div>
  );
}
