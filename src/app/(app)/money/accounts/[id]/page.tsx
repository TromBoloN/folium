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
import { formatIdr } from "@/features/finance/lib/format-idr";
import { type Account, ensureFinanceDefaults, listAccounts } from "@/features/finance/queries";
import { realBalanceSchema } from "@/features/finance/schemas";
import { adjustmentFor, reconciledOpening } from "@/features/finance/schemas/money-math";

export const metadata: Metadata = { title: "Account" };

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

const grouped = (n: bigint) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

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
            openingBalance:
              account.openingBalance < 0n ? `-${grouped(-account.openingBalance)}` : grouped(account.openingBalance),
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
function Reconcile({ account, real, matched }: { account: Account; real: string; matched: boolean }) {
  const parsed = real ? realBalanceSchema.safeParse({ accountId: account.id, real }) : null;
  const target = parsed?.success ? parsed.data.real : null;
  const adjustment = target !== null ? adjustmentFor(account.balance, target) : null;
  return (
    <section id="reconcile" aria-labelledby="reconcile-h" className="tile flex scroll-mt-24 flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="reconcile-h" className="flex items-center gap-2 font-medium">
          <Scale aria-hidden className="size-4 text-muted-foreground" />
          Match my real balance
        </h2>
        <p className="text-muted-foreground text-sm">
          Folium shows <span className="font-medium text-foreground tabular-nums">{formatIdr(account.balance)}</span>.
          Type what your bank or e-wallet app shows right now.
        </p>
      </div>
      {matched ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <CheckCircle2 aria-hidden className="size-4 text-money-in" />
          Balance matched.
        </p>
      ) : null}
      <form method="get" action="#reconcile" className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="real">Real balance</Label>
          <Input
            id="real"
            name="real"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={real}
            placeholder="e.g. 1.250.000"
            className="w-48"
            aria-invalid={parsed && !parsed.success ? true : undefined}
            aria-describedby={parsed && !parsed.success ? "real-error" : undefined}
          />
        </div>
        <Button type="submit" variant="outline">
          Preview
        </Button>
      </form>
      {parsed && !parsed.success ? (
        <p id="real-error" className="text-destructive text-sm">
          {parsed.error.issues[0]?.message ?? "Enter an amount."}
        </p>
      ) : null}
      {target !== null ? (
        adjustment === null ? (
          <p className="text-sm">It already matches.</p>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-border-soft p-4">
            <p className="text-sm">
              Difference:{" "}
              <span className="font-medium tabular-nums">
                {adjustment.direction === "in" ? "+" : "−"}
                {formatIdr(adjustment.amount)}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={matchRealBalance} fields={{ accountId: account.id, real }}>
                <SubmitButton size="sm">Change the opening balance</SubmitButton>
              </ActionForm>
              <ActionForm action={adjustToRealBalance} fields={{ accountId: account.id, real }}>
                <SubmitButton size="sm" variant="outline">
                  Add an adjustment of {adjustment.direction === "in" ? "+" : "−"}
                  {formatIdr(adjustment.amount)}
                </SubmitButton>
              </ActionForm>
            </div>
            <p className="text-muted-foreground text-xs">
              Changing the opening balance sets it to{" "}
              {formatIdr(reconciledOpening(account.balance, account.openingBalance, target))} and keeps every
              transaction as it is. Opening balance is a snapshot: run this again after you backfill older transactions.
              An adjustment instead records the difference today.
            </p>
          </div>
        )
      ) : null}
    </section>
  );
}
