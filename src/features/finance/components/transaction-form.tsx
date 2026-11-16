"use client";

import { ArrowDownUp, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormFooter } from "@/components/form/form-footer";
import { CancelButton, SheetFormBridge, useSheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveTransaction } from "../actions/transactions";
import { formatIdr } from "../lib/format-idr";
import { addDays } from "../lib/local-date";
import { parseAmount } from "../lib/parse-amount";
import { suggestCategory } from "../lib/suggest-category";
import type { AccountType, TransactionKind } from "../schemas";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { accountGlyph, categoryGlyph, IconBadge, KIND_ICONS } from "./money-icon";
import { markAdded } from "./new-row-mark";

export type FormAccount = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  icon: string | null;
  /** bigint as a string (props must be serialisable). */
  balance: string;
};
export type FormCategory = {
  id: string;
  name: string;
  kind: "expense" | "income";
  parentId: string | null;
  color: string;
  icon: string | null;
};

export type TransactionDefaults = {
  kind: TransactionKind;
  status: "posted" | "planned";
  amount: string;
  accountId: string;
  toAccountId: string;
  feeAmount: string;
  categoryId: string;
  payee: string;
  note: string;
  occurredOn: string;
  adjustmentDirection: string;
};

type Props = {
  id?: string;
  defaults: TransactionDefaults;
  /** The user's today ("YYYY-MM-DD"), for the Today / Yesterday chips. */
  today: string;
  accounts: FormAccount[];
  categories: FormCategory[];
  history: { payee: string; categoryId: string; occurredOn: string }[];
};

const KINDS: { value: TransactionKind; label: string; tone: string }[] = [
  {
    value: "expense",
    label: "Expense",
    tone: "has-checked:border-money-out has-checked:bg-[color-mix(in_oklab,var(--money-out)_14%,var(--surface-1))] has-checked:text-foreground",
  },
  {
    value: "income",
    label: "Income",
    tone: "has-checked:border-money-in has-checked:bg-[color-mix(in_oklab,var(--money-in)_14%,var(--surface-1))] has-checked:text-foreground",
  },
  { value: "transfer", label: "Transfer", tone: "has-checked:border-foreground/40 has-checked:bg-muted" },
  { value: "adjustment", label: "Adjust", tone: "has-checked:border-foreground/40 has-checked:bg-muted" },
];

const chip =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-xl border border-border bg-surface-1 text-sm transition-[border-color,background-color,transform] duration-(--dur-fast) hover:border-foreground/25 active:scale-[0.98] has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/30";

function ErrorText({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="text-destructive text-xs">
      {error}
    </p>
  ) : null;
}

/**
 * Add or edit a transaction. One form for every kind: fields that don't apply
 * are hidden by CSS on the checked kind (works without JavaScript) and dropped
 * by the schema. Amounts accept "25k", "25.000", "1,5jt".
 */
export function TransactionForm({ id, defaults, today, accounts, categories, history }: Props) {
  const [state, action, pending] = useActionState(saveTransaction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const submitted = state && !state.ok ? state.values : undefined;
  const value = (name: keyof TransactionDefaults) => submitted?.[name] ?? defaults[name];
  const [kind, setKind] = useState<TransactionKind>(value("kind") as TransactionKind);
  const [amountText, setAmountText] = useState(value("amount"));
  const [suggested, setSuggested] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const sheet = useSheet();
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.result?.id && !id) markAdded(state.result.id);
  }, [state, id]);

  const parsedAmount = amountText.trim() ? parseAmount(amountText) : null;
  const radio = (name: string, v: string) =>
    formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(v)}"]`);
  const checked = (name: string) =>
    formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? "";

  const onKind = (next: TransactionKind) => {
    setKind(next);
    // A category of the other kind can't stay picked (the database would refuse it).
    const current = categories.find((c) => c.id === checked("categoryId"));
    if (current && current.kind !== (next === "income" ? "income" : "expense")) {
      const none = radio("categoryId", "");
      if (none) none.checked = true;
    }
  };

  const swap = () => {
    const from = checked("accountId");
    const to = checked("toAccountId");
    const a = radio("accountId", to);
    const b = radio("toAccountId", from);
    if (a) a.checked = true;
    if (b) b.checked = true;
  };

  const suggestFrom = (payee: string) => {
    const match = categories.find((c) => c.id === suggestCategory(payee, history));
    setSuggested(match && match.kind === (kind === "income" ? "income" : "expense") ? match.id : null);
  };

  const accountChips = (name: "accountId" | "toAccountId", legend: React.ReactNode) => (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={errors[name] ? `${name}-error` : undefined}>
      <legend className="mb-1.5 font-medium text-sm">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {accounts.map((a) => {
          const balance = BigInt(a.balance);
          return (
            <label key={a.id} className={cn(chip, "p-2.5")}>
              <input type="radio" name={name} value={a.id} defaultChecked={value(name) === a.id} className="sr-only" />
              <IconBadge icon={accountGlyph(a)} color={a.color} size="sm" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{a.name}</span>
                <span className={cn("text-xs tabular-nums", balance < 0n ? "text-money-out" : "text-muted-foreground")}>
                  {formatIdr(balance)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <ErrorText id={name} error={errors[name]} />
    </fieldset>
  );

  const categoryGrid = (k: "expense" | "income") => {
    const list = categories
      .filter((c) => c.kind === k && !c.parentId)
      .flatMap((p) => [p, ...categories.filter((c) => c.parentId === p.id)]);
    return (
      <div data-kinds={k}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {list.map((c) => {
            const isSuggested = suggested === c.id;
            const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : undefined;
            return (
              <label
                key={c.id}
                className={cn(
                  chip,
                  "flex-col justify-center gap-1 px-1.5 py-2.5 text-center",
                  isSuggested && "border-dashed border-primary",
                )}
              >
                <input
                  type="radio"
                  name="categoryId"
                  value={c.id}
                  defaultChecked={value("categoryId") === c.id}
                  className="sr-only"
                  onChange={() => setSuggested(null)}
                />
                <IconBadge
                  icon={categoryGlyph(c, k === "income" ? KIND_ICONS.income : KIND_ICONS.expense)}
                  color={c.color}
                />
                <span className="line-clamp-2 text-xs leading-tight">
                  {c.name}
                  {parent ? <span className="sr-only"> (in {parent.name})</span> : null}
                </span>
                {isSuggested ? <span className="font-medium text-[0.625rem] text-primary">Suggested</span> : null}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <form
      ref={formRef}
      key={JSON.stringify(state)}
      action={action}
      className="tx-form flex flex-col gap-6"
      noValidate
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.name === "kind") onKind(el.value as TransactionKind);
      }}
    >
      <SheetFormBridge state={state} message={id ? "Transaction saved" : "Transaction added"} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Kind</legend>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-border-soft bg-muted/50 p-1">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className={cn(
                "flex h-10 cursor-pointer select-none items-center justify-center rounded-lg border border-transparent font-medium text-muted-foreground text-sm transition-colors duration-(--dur-fast) hover:text-foreground has-checked:text-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/30",
                k.tone,
              )}
            >
              <input
                type="radio"
                name="kind"
                value={k.value}
                defaultChecked={value("kind") === k.value}
                className="sr-only"
                aria-label={k.value === "adjustment" ? "Adjustment" : undefined}
              />
              {k.label}
            </label>
          ))}
        </div>
        <ErrorText id="kind" error={errors.kind} />
      </fieldset>

      <div className="flex flex-col items-center gap-1 text-center">
        <label htmlFor="amount" className="font-medium text-muted-foreground text-sm">
          Amount
        </label>
        <div className="flex items-baseline justify-center gap-2">
          <span aria-hidden className="font-display text-2xl text-muted-foreground">
            Rp
          </span>
          <input
            id="amount"
            name="amount"
            defaultValue={value("amount")}
            inputMode="decimal"
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: a new transaction starts with its amount; the sheet was opened to type it.
            autoFocus={!id}
            required
            placeholder="0"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={describedBy("amount", errors.amount, "hint")}
            onChange={(e) => setAmountText(e.target.value)}
            className={cn(
              "w-full max-w-[12ch] border-0 border-b-2 border-transparent bg-transparent text-center font-display font-medium text-4xl tabular-nums outline-none transition-colors duration-(--dur-fast) placeholder:text-muted-foreground/50 focus-visible:border-ring sm:text-5xl",
              errors.amount && "border-destructive",
            )}
          />
        </div>
        <p id="amount-hint" className="min-h-5 text-sm tabular-nums" aria-live="polite">
          {parsedAmount?.ok ? (
            <span className="font-medium">{formatIdr(parsedAmount.value)}</span>
          ) : parsedAmount ? (
            <span className="text-muted-foreground">Not an amount yet</span>
          ) : (
            <span className="text-muted-foreground">25.000, 25k or 1,5jt</span>
          )}
        </p>
        <ErrorText id="amount" error={errors.amount} />
      </div>

      {accountChips(
        "accountId",
        <>
          <span data-kinds="expense income adjustment">Account</span>
          <span data-kinds="transfer">From</span>
        </>,
      )}

      <div data-kinds="transfer">
        <div className="flex flex-col gap-4">
          <div className="-my-2 flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={swap} className="rounded-full">
              <ArrowDownUp aria-hidden />
              Swap
            </Button>
          </div>
          {accountChips("toAccountId", "To")}
          <div className="grid gap-1.5 sm:max-w-xs">
            <label htmlFor="feeAmount" className="font-medium text-sm">
              Fee <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="feeAmount"
              name="feeAmount"
              defaultValue={value("feeAmount")}
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 2.500"
              aria-invalid={errors.feeAmount ? true : undefined}
              aria-describedby={describedBy("feeAmount", errors.feeAmount, "hint")}
            />
            <p id="feeAmount-hint" className="text-muted-foreground text-xs">
              Taken from the sending account.
            </p>
            <ErrorText id="feeAmount" error={errors.feeAmount} />
          </div>
        </div>
      </div>

      <div data-kinds="adjustment">
        <ChipGroup
          name="adjustmentDirection"
          legend="Direction"
          defaultValue={value("adjustmentDirection")}
          options={[
            { value: "in", label: "Money in" },
            { value: "out", label: "Money out" },
          ]}
          error={errors.adjustmentDirection}
        />
      </div>

      <div data-kinds="expense income">
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="payee" className="font-medium text-sm">
              {kind === "income" ? "From (payer)" : "Payee"}{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="payee"
              name="payee"
              defaultValue={value("payee")}
              autoComplete="off"
              placeholder={kind === "income" ? "e.g. Mama" : "e.g. GoFood"}
              aria-invalid={errors.payee ? true : undefined}
              aria-describedby={describedBy("payee", errors.payee)}
              onChange={(e) => suggestFrom(e.target.value)}
            />
            <ErrorText id="payee" error={errors.payee} />
          </div>
          <fieldset
            className="flex min-w-0 flex-col gap-2"
            aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
          >
            <legend className="mb-1.5 flex w-full items-center justify-between gap-2 font-medium text-sm">
              Category
              <label className="flex cursor-pointer items-center gap-1.5 font-normal text-muted-foreground text-xs has-checked:text-foreground">
                <input
                  type="radio"
                  name="categoryId"
                  value=""
                  defaultChecked={!value("categoryId")}
                  className="accent-primary"
                />
                None
              </label>
            </legend>
            {categoryGrid("expense")}
            {categoryGrid("income")}
            <ErrorText id="categoryId" error={errors.categoryId} />
          </fieldset>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="occurredOn" className="font-medium text-sm">
            Date
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Today", date: today },
              { label: "Yesterday", date: addDays(today, -1) },
            ].map((d) => (
              <Button
                key={d.label}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                aria-label={`Set date to ${d.label.toLowerCase()}`}
                onClick={() => {
                  if (dateRef.current) dateRef.current.value = d.date;
                }}
              >
                {d.label}
              </Button>
            ))}
            <Input
              ref={dateRef}
              id="occurredOn"
              name="occurredOn"
              type="date"
              required
              defaultValue={value("occurredOn")}
              aria-invalid={errors.occurredOn ? true : undefined}
              aria-describedby={describedBy("occurredOn", errors.occurredOn)}
              className="w-auto"
            />
          </div>
          <ErrorText id="occurredOn" error={errors.occurredOn} />
        </div>
        <ChipGroup
          name="status"
          legend="Status"
          defaultValue={value("status")}
          options={[
            { value: "posted", label: "Done" },
            { value: "planned", label: "Planned" },
          ]}
          hint="Planned ones don't change balances yet."
        />
      </div>

      <details open={Boolean(value("note")) || Boolean(errors.note)} className="group">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md font-medium text-muted-foreground text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 group-open:mb-2">
          <StickyNote aria-hidden className="size-4" />
          <span className="group-open:hidden">Add note</span>
          <span className="hidden group-open:inline">Note</span>
        </summary>
        <label htmlFor="note" className="sr-only">
          Note
        </label>
        <Textarea
          id="note"
          name="note"
          defaultValue={value("note")}
          rows={2}
          placeholder="Anything to remember"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={describedBy("note", errors.note)}
        />
        <ErrorText id="note" error={errors.note} />
      </details>

      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add transaction"}
        </Button>
        <CancelButton href="/money" />
        {id ? (
          <span className="mr-auto">
            <DeleteTransactionButton
              id={id}
              label="this transaction"
              onDeleted={() => (sheet ? sheet.close({ refresh: true }) : router.push("/money"))}
            />
          </span>
        ) : null}
      </FormFooter>
    </form>
  );
}
