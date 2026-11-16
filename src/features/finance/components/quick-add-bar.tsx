"use client";

import { CornerDownLeft, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast/toaster";
import { motionLevel } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { deleteTransaction, type QuickMoneyContext, quickAddForm } from "../actions/transactions";
import type { Chip } from "../lib/parse-quick-transaction";
import { type FixType, tokenFor, withToken } from "../lib/quick-line";
import { markAdded } from "./new-row-mark";
import { QuickMoneyPreview, useQuickMoney } from "./quick-money";

export const QUICK_ADD_INPUT_ID = "quick-add-input";
export const QUICK_ADD_PREFILL = "folium:quick-add-prefill";

export const QUICK_EXAMPLES = [
  "gofood 32k #food @gopay",
  "+1,5jt allowance #allowance @livin",
  "50k from livin to dana",
  "kopi 18k #food @cash kemarin",
  "spotify 54.990 #subscriptions @dana",
];

/**
 * The quick-add line at the top of /money. A real <form> posting to a server
 * action that parses the line again, so it works without JavaScript; with it,
 * chips preview the line as you type and the unclear ones open a picker.
 */
export function QuickAddBar({ context }: { context: QuickMoneyContext }) {
  // ?quick= prefills the bar (the example links, without JavaScript).
  const initialText = useSearchParams().get("quick")?.slice(0, 300) ?? "";
  const [state, action, pending] = useActionState(quickAddForm, null);
  const [text, setText] = useState(state && !state.ok ? (state.values?.text ?? initialText) : initialText);
  const [picking, setPicking] = useState<FixType | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handled = useRef(state);
  const toast = useToast();
  const money = useQuickMoney(text, true, context);

  // Success: clear, highlight the new row, toast with Undo.
  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (!state.ok) {
      inputRef.current?.focus();
      return;
    }
    const id = state.result?.id;
    if (!id) return;
    markAdded(id);
    setText("");
    setPicking(null);
    toast({
      message: state.result?.message ?? "Added",
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undone = await deleteTransaction(id);
          if (!undone.ok) toast({ message: undone.error, tone: "error" });
        },
      },
    });
  }, [state, toast]);

  // Example lines elsewhere on the page prefill the bar.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      inputRef.current?.focus();
    };
    window.addEventListener(QUICK_ADD_PREFILL, onPrefill);
    return () => window.removeEventListener(QUICK_ADD_PREFILL, onPrefill);
  }, []);

  // A gently cycling example while empty and idle; static with reduced or no motion.
  useEffect(() => {
    if (text || focused || motionLevel() !== "full") {
      setHint(null);
      return;
    }
    setHint(0);
    const timer = window.setInterval(() => setHint((i) => ((i ?? 0) + 1) % QUICK_EXAMPLES.length), 3500);
    return () => window.clearInterval(timer);
  }, [text, focused]);

  const fix = (chip: Chip) => {
    if (chip.type === "amount") {
      inputRef.current?.focus();
      return;
    }
    const type = chip.type as FixType;
    setPicking((current) => (current === type ? null : type));
  };

  const choose = (type: FixType, item: { id: string; name: string }, items: { id: string; name: string }[]) => {
    setText((t) => withToken(t, type, tokenFor(item, items)));
    setPicking(null);
    inputRef.current?.focus();
  };

  const kind = money.draft?.kind ?? "expense";
  const options =
    picking === "category"
      ? context.categories.filter((c) => c.kind === (kind === "income" ? "income" : "expense"))
      : picking
        ? context.accounts
        : [];
  const serverError = state && !state.ok && state.values?.text === text ? state.error : null;

  return (
    <section
      aria-label="Quick add"
      className="tile reveal flex flex-col gap-3 p-3 sm:p-4"
      style={{ "--i": 0 } as React.CSSProperties}
    >
      <form
        action={action}
        onSubmit={(e) => {
          if (!money.canSave) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor={QUICK_ADD_INPUT_ID} className="sr-only">
          Quick add a transaction
        </label>
        <Sparkles aria-hidden className="ml-1 size-5 shrink-0 text-primary" />
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            id={QUICK_ADD_INPUT_ID}
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (picking) setPicking(null);
                else (e.target as HTMLInputElement).blur();
              }
            }}
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
            placeholder={hint === null ? `Try “${QUICK_EXAMPLES[0]}”` : ""}
            aria-describedby="quick-add-help"
            aria-invalid={serverError ? true : undefined}
            className="h-11 w-full rounded-lg border border-transparent bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          {hint !== null ? (
            <span
              key={hint}
              aria-hidden
              // Both edges pinned (it must stop at the input, not run under the button) and a
              // block with the input's line height, so `truncate` can add the ellipsis.
              className="quick-hint pointer-events-none absolute inset-x-2 top-0 block h-11 truncate text-base text-muted-foreground leading-11"
            >
              Try “{QUICK_EXAMPLES[hint]}”
            </span>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-disabled={!money.canSave || undefined}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-primary-foreground text-sm transition-[opacity,transform] duration-(--dur-fast) active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
            !money.canSave && text && "opacity-60",
          )}
        >
          <CornerDownLeft aria-hidden className="size-4" />
          {pending ? "Adding…" : "Add"}
        </button>
      </form>

      <p id="quick-add-help" className="sr-only">
        An amount, then optional #category, @account, “to” another account for a transfer, and today or yesterday. Press
        Enter to add.
      </p>

      {money.draft ? (
        <div aria-live="polite">
          <QuickMoneyPreview
            draft={money.draft}
            onFix={fix}
            open={picking}
            errorId={serverError ? undefined : "quick-add-error"}
          />
        </div>
      ) : (
        <p className="px-1 text-muted-foreground text-xs">
          An amount, #category, @account. “+” for income, “to dana” for a transfer.
        </p>
      )}

      {picking ? (
        <fieldset className="flex flex-wrap gap-1.5 border-border-soft border-t pt-3">
          <legend className="sr-only">{picking === "category" ? "Choose a category" : "Choose an account"}</legend>
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(picking, item, options)}
              className="h-9 rounded-full border border-border bg-surface-1 px-3 text-sm transition-colors duration-(--dur-fast) hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95"
            >
              {item.name}
            </button>
          ))}
        </fieldset>
      ) : null}

      {serverError ? (
        <p role="alert" className="px-1 text-destructive text-sm">
          {serverError}
        </p>
      ) : null}
    </section>
  );
}

/** Example lines (empty state): links that prefill the bar, or with JavaScript fill it in place. */
export function QuickExamples() {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {QUICK_EXAMPLES.slice(0, 3).map((line) => (
        <li key={line}>
          <a
            href={`/money?quick=${encodeURIComponent(line)}`}
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent(QUICK_ADD_PREFILL, { detail: line }));
              window.scrollTo({ top: 0, behavior: motionLevel() === "full" ? "smooth" : "auto" });
            }}
            className="inline-flex h-9 items-center rounded-full border border-border border-dashed bg-surface-1 px-3 font-mono text-xs transition-colors duration-(--dur-fast) hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            {line}
          </a>
        </li>
      ))}
    </ul>
  );
}
