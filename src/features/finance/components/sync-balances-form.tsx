"use client";

import { StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormFooter } from "@/components/form/form-footer";
import { CancelButton, useSheet } from "@/components/sheet";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import { syncBalances, undoSyncedBalances } from "../actions/accounts";
import { formatIdr } from "../lib/format-idr";
import { type AccountType, signedAmount } from "../schemas";
import { accountGlyph, IconBadge } from "./money-icon";

export type SyncAccountItem = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  icon: string | null;
  balance: string;
};

/**
 * One-screen balance sync: enter real balances for any accounts that drifted
 * (leave the rest blank). Submits real balances — never diffs — so double-taps
 * are harmless. Always records silent adjustments (never skews Reports/Budgets).
 */
export function SyncBalancesForm({ accounts }: { accounts: SyncAccountItem[] }) {
  const { t, tl } = useI18n();
  const [state, action, pending] = useActionState(syncBalances, null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const handled = useRef(state);
  const sheet = useSheet();
  const toast = useToast();
  const router = useRouter();

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const submitted = state && !state.ok ? state.values : undefined;

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (!state.ok) return;
    const rawIds = state.result?.ids ?? "";
    const ids = rawIds ? rawIds.split(",").filter(Boolean) : [];
    const count = ids.length;
    toast({
      message:
        count === 0
          ? t("Balances marked up to date")
          : t(plural(count, "Synced 1 account", "Synced {n} accounts"), { n: count }),
      duration: 8000,
      action:
        ids.length > 0
          ? {
              label: t("Undo"),
              onClick: async () => {
                const undone = await undoSyncedBalances(ids);
                if (!undone.ok) toast({ message: tl(undone.error), tone: "error" });
                else router.refresh();
              },
            }
          : undefined,
    });
    if (sheet) sheet.close({ refresh: true });
    else router.push("/money");
  }, [state, sheet, toast, router, t, tl]);

  const valueFor = (id: string) => inputs[id] ?? submitted?.[`real:${id}`] ?? "";

  let changedCount = 0;
  const diffs = new Map<string, { ok: true; diff: bigint } | { ok: false }>();
  for (const a of accounts) {
    const raw = valueFor(a.id).trim();
    if (!raw) continue;
    const parsed = signedAmount.safeParse(raw);
    if (!parsed.success) {
      diffs.set(a.id, { ok: false });
    } else {
      const diff = parsed.data - BigInt(a.balance);
      diffs.set(a.id, { ok: true, diff });
      if (diff !== 0n) changedCount++;
    }
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {sheet ? <input type="hidden" name="_sheet" value="1" /> : null}
      <p className="text-muted-foreground text-sm">
        {t("Type the balance your bank or wallet app shows. Leave unchanged accounts blank.")}
      </p>

      <ul className="flex flex-col divide-y divide-border-soft rounded-tile border border-border-soft bg-surface-1">
        {accounts.map((a) => {
          const bal = BigInt(a.balance);
          const fieldName = `real:${a.id}`;
          const noteName = `note:${a.id}`;
          const err = errors[fieldName];
          const preview = diffs.get(a.id);
          return (
            <li key={a.id} className="flex flex-col gap-2 p-3.5 sm:p-4">
              <input type="hidden" name="accountId" value={a.id} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <IconBadge icon={accountGlyph(a)} color={a.color} size="sm" />
                  <div className="flex min-w-0 flex-col">
                    <label htmlFor={`sync-${a.id}`} className="truncate font-medium text-sm">
                      {a.name}
                    </label>
                    <span className={cn("text-xs tabular-nums", bal < 0n ? "text-money-out" : "text-muted-foreground")}>
                      {t("Now {amount}", { amount: formatIdr(bal) })}
                    </span>
                  </div>
                </div>
                <Input
                  id={`sync-${a.id}`}
                  name={fieldName}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={valueFor(a.id)}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  placeholder={formatIdr(bal)}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? `sync-${a.id}-err` : undefined}
                  className="w-40 text-right tabular-nums sm:w-44"
                />
              </div>

              {err ? (
                <p id={`sync-${a.id}-err`} role="alert" className="text-destructive text-xs">
                  {tl(err)}
                </p>
              ) : preview ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {!preview.ok ? (
                    <span className="text-muted-foreground">{t("Not an amount yet")}</span>
                  ) : preview.diff === 0n ? (
                    <span className="text-muted-foreground">{t("Already matches")}</span>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          preview.diff > 0n ? "text-money-in" : "text-money-out",
                        )}
                      >
                        {preview.diff > 0n ? `+${formatIdr(preview.diff)}` : formatIdr(preview.diff)}
                        <span className="ml-1.5 font-normal text-muted-foreground">· {t("Silent adjustment")}</span>
                      </span>
                      <details className="w-full sm:w-auto">
                        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground">
                          <StickyNote aria-hidden className="size-3.5" />
                          {t("Add note")}
                        </summary>
                        <div className="mt-1.5">
                          <label htmlFor={`note-${a.id}`} className="sr-only">
                            {t("Note")}
                          </label>
                          <Input
                            id={`note-${a.id}`}
                            name={noteName}
                            defaultValue={submitted?.[noteName] ?? ""}
                            maxLength={200}
                            placeholder={t("Optional note")}
                            className="h-8 text-xs"
                          />
                        </div>
                      </details>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending
            ? t("Saving…")
            : changedCount > 0
              ? t(plural(changedCount, "Sync 1 account", "Sync {n} accounts"), { n: changedCount })
              : t("Looks right")}
        </Button>
        <CancelButton href="/money" />
      </FormFooter>
    </form>
  );
}
