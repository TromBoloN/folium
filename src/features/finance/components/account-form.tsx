"use client";

import { Landmark } from "lucide-react";
import { useActionState } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection } from "@/components/form/form-section";
import { CancelButton } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { saveAccount } from "../actions/accounts";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "../schemas";
import { AppearanceFields } from "./appearance-fields";

export type AccountDefaults = {
  id?: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  openingBalance: string;
  isSpendable?: boolean;
};

export function AccountForm({ defaults }: { defaults: AccountDefaults }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveAccount, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const value = (name: Exclude<keyof AccountDefaults, "isSpendable">) => state?.values?.[name] ?? defaults[name] ?? "";
  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-6" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <FormSection title="Account" icon={Landmark}>
        <Field id="name" label="Name" error={errors.name}>
          <Input
            id="name"
            name="name"
            required
            autoFocus={!defaults.id}
            maxLength={60}
            defaultValue={value("name")}
            placeholder={t("e.g. BCA, OVO, Savings jar")}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name", errors.name)}
          />
        </Field>
        <ChipGroup
          name="type"
          legend={t("Type")}
          defaultValue={value("type")}
          options={ACCOUNT_TYPES.map((type) => ({ value: type, label: t(ACCOUNT_TYPE_LABELS[type]) }))}
          error={errors.type}
        />
        <Field
          id="openingBalance"
          label="Opening balance"
          optional
          error={errors.openingBalance}
          hint="What was in it before your first transaction here (may be negative). Later you can match it to your real balance."
        >
          <Input
            id="openingBalance"
            name="openingBalance"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={value("openingBalance")}
            placeholder={t("e.g. {example}", { example: "250.000" })}
            aria-invalid={errors.openingBalance ? true : undefined}
            aria-describedby={describedBy("openingBalance", errors.openingBalance, "hint")}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isSpendable"
            defaultChecked={state && !state.ok ? state.values?.isSpendable === "on" : (defaults.isSpendable ?? true)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            {t("Count it in “safe to spend”")}
            <span className="block text-muted-foreground text-xs">
              {t("Leave savings out so they aren't treated as spending money.")}
            </span>
          </span>
        </label>
        <AppearanceFields color={value("color")} icon={value("icon")} errors={errors} />
      </FormSection>
      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? t("Saving…") : defaults.id ? t("Save changes") : t("Add account")}
        </Button>
        <CancelButton href="/money/accounts" />
      </FormFooter>
    </form>
  );
}
