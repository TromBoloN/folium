"use client";

import { useActionState } from "react";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createBreak } from "../actions";

/** "No classes from 23 to 27 Nov": every regular class in the range is cancelled at once. */
export function BreakForm({ prefill }: { prefill: { startsOn: string; endsOn: string } }) {
  const [state, action, pending] = useActionState(createBreak, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const initial: Record<string, string> = { label: "", ...prefill };
  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const field = (name: string, hint?: string) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="flex flex-col gap-5" noValidate>
      <SheetFormBridge state={state} message="Break added" />
      <Field id="label" label="Name" error={errors.label}>
        <Input
          required
          placeholder="Mid-semester break, exam week, public holiday"
          maxLength={60}
          {...field("label")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:w-fit">
        <Field id="startsOn" label="First day" error={errors.startsOn}>
          <Input type="date" required {...field("startsOn")} />
        </Field>
        <Field id="endsOn" label="Last day" error={errors.endsOn}>
          <Input type="date" required {...field("endsOn")} />
        </Field>
      </div>
      <p className="text-muted-foreground text-sm">
        Every regular class in these days shows as cancelled. Extra sessions (an exam in exam week) still happen.
      </p>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add break"}
        </Button>
        <CancelButton href={`/courses?view=day&week=${prefill.startsOn}`} />
      </div>
    </form>
  );
}
