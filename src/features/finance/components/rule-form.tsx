"use client";

import { useActionState, useState } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormFooter } from "@/components/form/form-footer";
import { CancelButton } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveRule } from "../actions/planning";

export type RuleDefaults = {
  id?: string;
  name: string;
  kind: string;
  amount: string;
  isEstimate: boolean;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  payee: string;
  cadence: string;
  intervalCount: string;
  dueDay: string;
  startsOn: string;
  endsOn: string;
  instalmentsTotal: string;
  remindDaysBefore: string;
  createTask: boolean;
};

type Option = { id: string; name: string };

/**
 * A recurring rule: subscriptions, kos, UKT instalments, data credit, service
 * reminders, allowance, sinking funds. Fields that don't apply to the kind or
 * cadence are hidden with JavaScript and ignored by the server without it.
 */
export function RuleForm({
  defaults,
  accounts,
  categories,
}: {
  defaults: RuleDefaults;
  accounts: Option[];
  categories: (Option & { kind: "expense" | "income" })[];
}) {
  const [state, action, pending] = useActionState(saveRule, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const v = (name: keyof RuleDefaults) => {
    const sent = state && !state.ok ? state.values?.[name] : undefined;
    return sent ?? String(defaults[name] ?? "");
  };
  const checked = (name: "isEstimate" | "createTask") =>
    state && !state.ok ? state.values?.[name] === "on" : defaults[name];
  const [kind, setKind] = useState(v("kind"));
  const [cadence, setCadence] = useState(v("cadence"));
  const field = (name: keyof RuleDefaults, hint?: string) => ({
    id: name,
    name,
    defaultValue: v(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });

  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-5" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Field id="name" label="Name" error={errors.name}>
        <Input {...field("name")} required maxLength={80} placeholder="e.g. Spotify, Kos, UKT" />
      </Field>
      <ChipGroup
        name="kind"
        legend="Kind"
        defaultValue={v("kind")}
        onChange={([value]) => setKind(value)}
        options={[
          { value: "expense", label: "Bill" },
          { value: "income", label: "Income" },
          { value: "transfer", label: "Set aside (transfer)" },
        ]}
        error={errors.kind}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="amount" label="Amount" error={errors.amount}>
          <Input {...field("amount")} inputMode="decimal" required placeholder="e.g. 54.990" className="tabular-nums" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="isEstimate"
            defaultChecked={checked("isEstimate")}
            className="size-4 accent-primary"
          />
          The amount changes (an estimate)
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="accountId"
          label={kind === "transfer" ? "From account" : kind === "income" ? "Into account" : "Paid from"}
          error={errors.accountId}
        >
          <NativeSelect {...field("accountId")}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {kind === "transfer" ? (
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
        ) : (
          <Field id="categoryId" label="Category" optional error={errors.categoryId}>
            <NativeSelect {...field("categoryId")}>
              <option value="">No category</option>
              {categories
                .filter((c) => c.kind === (kind === "income" ? "income" : "expense"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      <fieldset className="flex flex-col gap-4 rounded-xl border border-border-soft p-4">
        <legend className="px-1 font-medium text-sm">How often</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="cadence" label="Repeats" error={errors.cadence}>
            <NativeSelect {...field("cadence")} onChange={(e) => setCadence(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </NativeSelect>
          </Field>
          <Field id="intervalCount" label="Every" error={errors.intervalCount} hint="1 = every time; 3 = every third.">
            <Input {...field("intervalCount", "hint")} type="number" min={1} max={24} />
          </Field>
          {cadence !== "weekly" ? (
            <Field id="dueDay" label="Due day" error={errors.dueDay} hint="31 means the last day in shorter months.">
              <Input {...field("dueDay", "hint")} type="number" min={1} max={31} />
            </Field>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="startsOn" label="Starts" error={errors.startsOn}>
            <Input {...field("startsOn")} type="date" required />
          </Field>
          <Field id="endsOn" label="Ends" optional error={errors.endsOn}>
            <Input {...field("endsOn")} type="date" />
          </Field>
          <Field
            id="instalmentsTotal"
            label="Number of payments"
            optional
            error={errors.instalmentsTotal}
            hint="For instalments, e.g. UKT in 6."
          >
            <Input {...field("instalmentsTotal", "hint")} type="number" min={1} max={120} />
          </Field>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="remindDaysBefore" label="Remind me (days before)" error={errors.remindDaysBefore}>
          <Input {...field("remindDaysBefore")} type="number" min={0} max={60} />
        </Field>
        <Field id="payee" label="Payee" optional error={errors.payee}>
          <Input {...field("payee")} maxLength={120} placeholder="Shown on the transaction" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="createTask"
          defaultChecked={checked("createTask")}
          className="size-4 accent-primary"
        />
        Also add a “Pay …” task on each due date (done when you mark it paid)
      </label>
      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : defaults.id ? "Save changes" : "Add"}
        </Button>
        <CancelButton href="/money/recurring" />
      </FormFooter>
    </form>
  );
}
