import { CheckCircle2, Scale } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/features/auth/queries";
import { adjustToRealBalance, matchRealBalance } from "@/features/finance/actions/accounts";
import { AccountForm } from "@/features/finance/components/account-form";
import { formatIdr, groupDigits } from "@/features/finance/lib/format-idr";
import { type Account, ensureFinanceDefaults, listAccounts } from "@/features/finance/queries";
import { realBalanceSchema } from "@/features/finance/schemas";
import { adjustmentFor, reconciledOpening } from "@/features/finance/schemas/money-math";
import { rich } from "@/lib/i18n/rich";
import { getI18n, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Account") };
}

type Props = PageProps<"/money/accounts/[id]">;

export default function AccountPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton label="Loading account" />}>
        <AccountDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AccountDetail({ params, searchParams }: Props) {
  await requireUser();
  await ensureFinanceDefaults();
  const [{ id }, query, accounts] = await Promise.all([params, searchParams, listAccounts()]);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();
  const real = typeof query.real === "string" ? query.real : "";
  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader title={account.name} back={<BackLink href="/money/accounts">Accounts</BackLink>} />
        <AccountForm
          defaults={{
            id: account.id,
            name: account.name,
            type: account.type,
            color: account.color,
            icon: account.icon ?? "",
            isSpendable: account.isSpendable,
            openingBalance: groupDigits(account.openingBalance),
          }}
        />
      </div>
      <Reconcile account={account} real={real} matched={query.matched === "1"} />
    </div>
  );
}

/**
 * Match the app to the bank: the user types the real balance, sees the
 * difference, then either rewrites the opening balance or records an adjustment.
 * A GET form, so the preview works without JavaScript.
 */
async function Reconcile({ account, real, matched }: { account: Account; real: string; matched: boolean }) {
  const { t, tl } = await getI18n();
  const parsed = real ? realBalanceSchema.safeParse({ accountId: account.id, real }) : null;
  const target = parsed?.success ? parsed.data.real : null;
  const adjustment = target !== null ? adjustmentFor(account.balance, target) : null;
  return (
    <section id="reconcile" aria-labelledby="reconcile-h" className="tile flex scroll-mt-24 flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="reconcile-h" className="flex items-center gap-2 font-medium">
          <Scale aria-hidden className="size-4 text-muted-foreground" />
          {t("Match my real balance")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {rich(t("Folium shows {amount}."), {
            amount: <span className="font-medium text-foreground tabular-nums">{formatIdr(account.balance)}</span>,
          })}{" "}
          {t("Type what your bank or e-wallet app shows right now.")}
        </p>
      </div>
      {matched ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <CheckCircle2 aria-hidden className="size-4 text-money-in" />
          {t("Balance matched.")}
        </p>
      ) : null}
      <form method="get" action="#reconcile" className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="real">{t("Real balance")}</Label>
          <Input
            id="real"
            name="real"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={real}
            placeholder={t("e.g. {example}", { example: "1.250.000" })}
            className="w-48"
            aria-invalid={parsed && !parsed.success ? true : undefined}
            aria-describedby={parsed && !parsed.success ? "real-error" : undefined}
          />
        </div>
        <Button type="submit" variant="outline">
          {t("Preview")}
        </Button>
      </form>
      {parsed && !parsed.success ? (
        <p id="real-error" className="text-destructive text-sm">
          {tl(parsed.error.issues[0]?.message ?? "Enter an amount.")}
        </p>
      ) : null}
      {target !== null ? (
        adjustment === null ? (
          <p className="text-sm">{t("It already matches.")}</p>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-border-soft p-4">
            <p className="text-sm">
              {t("Difference:")}{" "}
              <span className="font-medium tabular-nums">
                {adjustment.direction === "in" ? "+" : "−"}
                {formatIdr(adjustment.amount)}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={matchRealBalance} fields={{ accountId: account.id, real }}>
                <SubmitButton size="sm">{t("Change the opening balance")}</SubmitButton>
              </ActionForm>
              <ActionForm action={adjustToRealBalance} fields={{ accountId: account.id, real }}>
                <SubmitButton size="sm" variant="outline">
                  {t("Add an adjustment of {amount}", {
                    amount: `${adjustment.direction === "in" ? "+" : "−"}${formatIdr(adjustment.amount)}`,
                  })}
                </SubmitButton>
              </ActionForm>
            </div>
            <p className="text-muted-foreground text-xs">
              {t(
                "Changing the opening balance sets it to {amount} and keeps every transaction as it is. Opening balance is a snapshot: run this again after you backfill older transactions.",
                { amount: formatIdr(reconciledOpening(account.balance, account.openingBalance, target)) },
              )}{" "}
              {t("An adjustment instead records the difference today.")}
            </p>
          </div>
        )
      ) : null}
    </section>
  );
}
