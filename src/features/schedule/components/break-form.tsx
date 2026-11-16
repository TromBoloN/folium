"use client";

import { CalendarOff } from "lucide-react";
import { useActionState, useRef } from "react";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection } from "@/components/form/form-section";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { createBreak } from "../actions";

/** "No classes from 23 to 27 Nov": every regular class in the range is cancelled at once. */
export function BreakForm({ prefill }: { prefill: { startsOn: string; endsOn: string } }) {
  const [state, action, pending] = useActionState(createBreak, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const t = useT();
  const initial: Record<string, string> = { label: "", ...prefill };
  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const field = (name: string, hint?: string) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });
  const labelRef = useRef<HTMLInputElement>(null);
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="flex flex-col gap-6" noValidate>
      <SheetFormBridge state={state} message="Break added" />
      <FormSection title="No classes" icon={CalendarOff}>
        <Field id="label" label="Name" error={errors.label} requiredMessage="Give the break a name.">
          <Input
            ref={labelRef}
            required
            autoFocus
            placeholder={t("e.g. Midterm week")}
            maxLength={60}
            {...field("label")}
          />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {(["Public holiday", "Midterm week", "Final exams", "Semester break"] as const).map((key) => {
            const l = t(key);
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  if (labelRef.current) labelRef.current.value = l;
                }}
                className="h-9 rounded-full border border-border bg-surface-1 px-3 text-sm transition-colors hover:border-foreground/25"
              >
                {l}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:w-fit">
          <Field id="startsOn" label="First day" error={errors.startsOn}>
            <Input type="date" required {...field("startsOn")} />
          </Field>
          <Field id="endsOn" label="Last day" error={errors.endsOn}>
            <Input type="date" required {...field("endsOn")} />
          </Field>
        </div>
        <p className="text-muted-foreground text-sm">
          {t(
            "Every regular class in these days shows as cancelled. Extra sessions (an exam in exam week) still happen.",
          )}
        </p>
      </FormSection>
      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? t("Saving…") : t("Add break")}
        </Button>
        <CancelButton href={`/courses?view=day&week=${prefill.startsOn}`} />
      </FormFooter>
    </form>
  );
}
