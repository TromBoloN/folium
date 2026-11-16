"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import { getQuickMoneyContext, type QuickMoneyContext } from "../actions/transactions";
import { type Chip, parseQuickTransaction, type QuickTransaction } from "../lib/parse-quick-transaction";

/**
 * Preview a one-line transaction ("gofood 32k #food @gopay") while typing.
 * Accounts and categories load once when the box opens (or come in as
 * `initial`). The server parses the line again before saving, so this is only
 * what the user sees.
 */
export function useQuickMoney(text: string, active: boolean, initial?: QuickMoneyContext) {
  const [context, setContext] = useState<QuickMoneyContext | null>(initial ?? null);
  useEffect(() => {
    if (!active || context) return;
    let current = true;
    getQuickMoneyContext().then((result) => {
      if (current && result.ok) setContext(result.data);
    });
    return () => {
      current = false;
    };
  }, [active, context]);

  if (!active || !context || !text.trim()) return { draft: null, canSave: false, loading: active && !context, context };
  const draft = parseQuickTransaction(text, { ...context, now: new Date() });
  // Enter only saves a clean line: amount and account resolved, nothing typed left unmatched.
  const canSave = draft.errors.length === 0 && draft.amount !== undefined && draft.accountId !== undefined;
  return { draft, canSave, loading: false, context };
}

const TONE: Record<Chip["state"], "accent" | "neutral" | "warning" | "danger"> = {
  matched: "accent",
  default: "neutral",
  ambiguous: "warning",
  missing: "danger",
};
const STATE_TEXT: Record<Chip["state"], MessageKey | ""> = {
  matched: "",
  default: " (default)",
  ambiguous: " (several match)",
  missing: " (missing)",
};

/** Chips that a picker can fix: accounts and categories that are missing, ambiguous or just the default. */
export function fixable(chip: Chip) {
  if (chip.type === "account") return chip.state !== "matched";
  if (chip.type === "toAccount" || chip.type === "category")
    return chip.state === "ambiguous" || chip.state === "missing";
  return chip.type === "amount" && chip.state === "missing";
}

/**
 * What the line will become, as chips: matched, default, ambiguous or missing.
 * With `onFix`, the chips a picker can fix are buttons.
 */
export function QuickMoneyPreview({
  draft,
  onFix,
  open,
  errorId,
}: {
  draft: QuickTransaction;
  onFix?: (chip: Chip) => void;
  open?: Chip["type"] | null;
  errorId?: string;
}) {
  const { t, tl } = useI18n();
  const state = (chip: Chip) => (STATE_TEXT[chip.state] ? t(STATE_TEXT[chip.state] as MessageKey) : "");
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-wrap gap-1.5" aria-label={t("Understood")}>
        {draft.chips.map((chip) => {
          const pill = (
            <Pill
              tone={TONE[chip.state]}
              className={cn(chip.state === "default" && "border border-border-soft border-dashed")}
            >
              {tl(chip.label)}
              <span className="sr-only">{state(chip)}</span>
              {onFix && fixable(chip) && chip.type !== "amount" ? <ChevronDown aria-hidden /> : null}
            </Pill>
          );
          return (
            <li key={`${chip.type}-${chip.label}`}>
              {onFix && fixable(chip) ? (
                <button
                  type="button"
                  onClick={() => onFix(chip)}
                  aria-expanded={chip.type === "amount" ? undefined : open === chip.type}
                  aria-label={
                    chip.type === "amount"
                      ? t("Amount missing: type one")
                      : t("Change {name}", { name: `${tl(chip.label)}${state(chip)}` })
                  }
                  className="rounded-full transition-transform duration-(--dur-fast) focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95"
                >
                  {pill}
                </button>
              ) : (
                pill
              )}
            </li>
          );
        })}
        {draft.payee ? (
          <li>
            <Pill tone="neutral">“{draft.payee}”</Pill>
          </li>
        ) : null}
      </ul>
      {draft.errors.length > 0 ? (
        <p id={errorId} className="text-destructive text-xs">
          {tl(draft.errors[0])}
        </p>
      ) : null}
    </div>
  );
}
