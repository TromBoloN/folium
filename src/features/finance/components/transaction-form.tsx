"use client";

import { ArrowRightLeft, CalendarDays, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection } from "@/components/form/form-section";
import { CancelButton, SheetFormBridge, useSheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveTransaction } from "../actions/transactions";
import { formatIdr } from "../lib/format-idr";
import { parseAmount } from "../lib/parse-amount";
import { suggestCategory } from "../lib/suggest-category";
import { KIND_LABELS, TRANSACTION_KINDS, type TransactionKind } from "../schemas";
import { DeleteTransactionButton } from "./delete-transaction-button";

export type FormAccount = { id: string; name: string };
export type FormCategory = { id: string; name: string; kind: "expense" | "income"; parentId: string | null };

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
  accounts: FormAccount[];
  categories: FormCategory[];
  history: { payee: string; categoryId: string; occurredOn: string }[];
};

/**
 * Add or edit a transaction. One form for every kind: fields that don't apply
 * are hidden by CSS on the checked kind (works without JavaScript) and dropped
 * by the schema. Amounts accept "25k", "25.000", "1,5jt".
 */
export function TransactionForm({ id, defaults, accounts, categories, history }: Props) {
  const [state, action, pending] = useActionState(saveTransaction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const submitted = state && !state.ok ? state.values : undefined;
  const value = (name: keyof TransactionDefaults) => submitted?.[name] ?? defaults[name];
  const [kind, setKind] = useState<TransactionKind>(value("kind") as TransactionKind);
  const [amountText, setAmountText] = useState(value("amount"));
  const [suggested, setSuggested] = useState<string | null>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const sheet = useSheet();
  const router = useRouter();

  const parsedAmount = amountText.trim() ? parseAmount(amountText) : null;
  const visibleCategories = categories.filter((c) => (kind === "income" ? c.kind === "income" : c.kind === "expense"));
  const field = (name: keyof TransactionDefaults, hint?: string) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });

  const categoryOptions = (list: FormCategory[]) =>
    list
      .filter((c) => !c.parentId)
      .flatMap((parent) => [parent, ...list.filter((c) => c.parentId === parent.id)])
      .map((c) => (
        <option key={c.id} value={c.id}>
          {c.parentId ? `   ${c.name}` : c.name}
        </option>
      ));

  return (
    <form
      key={JSON.stringify(state)}
      action={action}
      className="tx-form flex flex-col gap-6"
      noValidate
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.name === "kind") setKind(el.value as TransactionKind);
      }}
    >
      <SheetFormBridge state={state} message={id ? "Transaction saved" : "Transaction added"} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <ChipGroup
        name="kind"
        legend="Kind"
        defaultValue={value("kind")}
        options={TRANSACTION_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
        error={errors.kind}
      />

      <FormSection title="Amount" icon={Receipt}>
        <Field id="amount" label="Amount" error={errors.amount} hint="Rupiah: 25.000, 25k or 1,5jt.">
          <Input
            {...field("amount", "hint")}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!id}
            required
            placeholder="e.g. 32k"
            onChange={(e) => setAmountText(e.target.value)}
            className="text-lg tabular-nums"
          />
        </Field>
        <p className="-mt-2 min-h-5 text-sm tabular-nums" aria-live="polite">
          {parsedAmount?.ok ? (
            <span className="font-medium">= {formatIdr(parsedAmount.value)}</span>
          ) : parsedAmount ? (
            <span className="text-muted-foreground">Not an amount yet</span>
          ) : null}
        </p>

        <Field id="accountId" label={kind === "transfer" ? "From account" : "Account"} error={errors.accountId}>
          <NativeSelect {...field("accountId")}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <div data-kinds="transfer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="toAccountId" label="To account" error={errors.toAccountId}>
              <NativeSelect {...field("toAccountId")}>
                <option value="">Choose…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="feeAmount" label="Fee" optional error={errors.feeAmount} hint="Taken from the sending account.">
              <Input {...field("feeAmount", "hint")} inputMode="decimal" autoComplete="off" placeholder="e.g. 2.500" />
            </Field>
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
      </FormSection>

      <div data-kinds="expense income">
        <FormSection title="Details" icon={ArrowRightLeft}>
          <Field
            id="payee"
            label={kind === "income" ? "From (payer)" : "Payee"}
            optional
            error={errors.payee}
            hint={suggested ? `Category suggested from past entries: ${suggested}.` : undefined}
          >
            <Input
              {...field("payee", suggested ? "hint" : undefined)}
              autoComplete="off"
              placeholder={kind === "income" ? "e.g. Mama" : "e.g. GoFood"}
              onBlur={(e) => {
                // Progressive enhancement: fill an empty category from this payee's history.
                const select = categoryRef.current;
                if (!select || select.value) return;
                const id = suggestCategory(e.target.value, history);
                const match = visibleCategories.find((c) => c.id === id);
                if (match) {
                  select.value = match.id;
                  setSuggested(match.name);
                }
              }}
            />
          </Field>
          <Field id="categoryId" label="Category" optional error={errors.categoryId}>
            <NativeSelect ref={categoryRef} {...field("categoryId")} onChange={() => setSuggested(null)}>
              <option value="">No category</option>
              {kind === "expense" || kind === "income" ? (
                categoryOptions(visibleCategories)
              ) : (
                <>
                  <optgroup label="Expense">{categoryOptions(categories.filter((c) => c.kind === "expense"))}</optgroup>
                  <optgroup label="Income">{categoryOptions(categories.filter((c) => c.kind === "income"))}</optgroup>
                </>
              )}
            </NativeSelect>
          </Field>
        </FormSection>
      </div>

      <FormSection title="When" icon={CalendarDays}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="occurredOn" label="Date" error={errors.occurredOn}>
            <Input {...field("occurredOn")} type="date" required />
          </Field>
          <ChipGroup
            name="status"
            legend="Status"
            defaultValue={value("status")}
            options={[
              { value: "posted", label: "Done" },
              { value: "planned", label: "Planned" },
            ]}
            hint="Planned ones don't change balances."
          />
        </div>
        <Field id="note" label="Note" optional error={errors.note}>
          <Textarea {...field("note")} rows={2} placeholder="Anything to remember" />
        </Field>
      </FormSection>

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
