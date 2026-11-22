"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { setAccountBalanceInline } from "../actions/accounts";
import { deleteTransaction } from "../actions/transactions";
import { formatIdr, groupDigits } from "../lib/format-idr";
import { MoneyCountUp } from "./money-count-up";

/**
 * Tap-to-set balance on an account card. Sits at z-10 over the card's
 * stretched link (zero nested interactive elements). Typing a new balance and
 * pressing Enter runs a silent adjustment with a 1-tap Undo toast.
 */
export function AccountBalanceInline({
  accountId,
  accountName,
  balance,
  negative,
}: {
  accountId: string;
  accountName: string;
  balance: string;
  negative: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [display, setDisplay] = useState(balance);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();
  const { t, tl } = useI18n();

  // Keep synced with server updates when not actively editing.
  const current = editing ? display : balance;
  const isNeg = editing ? BigInt(display) < 0n : negative;

  const open = () => {
    const num = BigInt(balance);
    setDisplay(balance);
    setDraft(num < 0n ? `-${groupDigits(-num)}` : groupDigits(num));
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  const save = () => {
    if (pending) return;
    start(async () => {
      const result = await setAccountBalanceInline({ accountId, real: draft });
      if (!result.ok) {
        toast({ message: tl(result.error), tone: "error" });
        inputRef.current?.focus();
        return;
      }
      setDisplay(result.data.balance);
      setEditing(false);
      const txId = result.data.id;
      if (txId) {
        toast({
          message: t("{name}: {amount}", { name: accountName, amount: formatIdr(BigInt(result.data.balance)) }),
          duration: 8000,
          action: {
            label: t("Undo"),
            onClick: async () => {
              const undone = await deleteTransaction(txId);
              if (!undone.ok) toast({ message: tl(undone.error), tone: "error" });
              else router.refresh();
            },
          },
        });
      } else {
        toast({ message: t("Balance already matches") });
      }
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="relative z-10 flex items-center gap-1">
        <label htmlFor={`bal-${accountId}`} className="sr-only">
          {t("Real balance for {name}", { name: accountName })}
        </label>
        <input
          ref={inputRef}
          id={`bal-${accountId}`}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-ring bg-surface-0 px-2 font-display font-medium text-base tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-label={t("Save balance for {name}", { name: accountName })}
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-60"
        >
          <Check aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          aria-label={t("Cancel")}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      data-testid={`balance-${accountId}`}
      className={cn(
        "group/bal relative z-10 -mx-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left font-display font-medium text-xl leading-none transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:text-2xl",
        isNeg && "text-money-out",
      )}
    >
      <span className="truncate">
        <MoneyCountUp amount={current} />
      </span>
      <Pencil
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/bal:opacity-100 group-focus-visible/bal:opacity-100"
      />
      <span className="sr-only"> — {t("Set balance")}</span>
    </button>
  );
}
