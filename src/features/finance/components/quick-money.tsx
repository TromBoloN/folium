"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { getQuickMoneyContext, type QuickMoneyContext } from "../actions/transactions";
import { type Chip, parseQuickTransaction, type QuickTransaction } from "../lib/parse-quick-transaction";

/**
 * Preview a one-line transaction ("gofood 32k #food @gopay") while typing.
 * Accounts and categories load once when the box opens. The server parses the
 * line again before saving, so this is only what the user sees.
 */
export function useQuickMoney(text: string, active: boolean) {
  const [context, setContext] = useState<QuickMoneyContext | null>(null);
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

  if (!active || !context || !text.trim()) return { draft: null, canSave: false, loading: active && !context };
  const draft = parseQuickTransaction(text, { ...context, now: new Date() });
  // Enter only saves a clean line: amount and account resolved, nothing typed left unmatched.
  const canSave = draft.errors.length === 0 && draft.amount !== undefined && draft.accountId !== undefined;
  return { draft, canSave, loading: false };
}

const TONE: Record<Chip["state"], "accent" | "neutral" | "warning" | "danger"> = {
  matched: "accent",
  default: "neutral",
  ambiguous: "warning",
  missing: "danger",
};
const STATE_TEXT: Record<Chip["state"], string> = {
  matched: "",
  default: " (default)",
  ambiguous: " (several match)",
  missing: " (missing)",
};

/** What the line will become, as chips: matched, default, ambiguous or missing. */
export function QuickMoneyPreview({ draft }: { draft: QuickTransaction }) {
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-wrap gap-1.5" aria-label="Understood">
        {draft.chips.map((chip) => (
          <li key={`${chip.type}-${chip.label}`}>
            <Pill
              tone={TONE[chip.state]}
              className={chip.state === "default" ? "border border-border-soft border-dashed" : undefined}
            >
              {chip.label}
              <span className="sr-only">{STATE_TEXT[chip.state]}</span>
            </Pill>
          </li>
        ))}
        {draft.payee ? (
          <li>
            <Pill tone="neutral">“{draft.payee}”</Pill>
          </li>
        ) : null}
      </ul>
      {draft.errors.length > 0 ? <p className="text-destructive text-xs">{draft.errors[0]}</p> : null}
    </div>
  );
}
