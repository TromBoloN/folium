"use client";

import { useActionState } from "react";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { startNewSemester } from "../actions";

type Props = { semesters: { label: string | null; count: number }[]; suggestion: string };

/** Copy last semester's courses (and optionally their class times) into a new semester. */
export function RolloverForm({ semesters, suggestion }: Props) {
  const [state, action, pending] = useActionState(startNewSemester, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const v = (name: string, fallback = "") => state?.values?.[name] ?? fallback;
  const checked = (name: string) => (state?.values ? state.values[name] === "on" : true);
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="flex flex-col gap-5" noValidate>
      <SheetFormBridge state={state} message="New semester ready" />
      <Field id="from" label="Copy courses from" error={errors.from}>
        <NativeSelect id="from" name="from" defaultValue={v("from", semesters[0]?.label ?? "")}>
          {semesters.map((s) => (
            <option key={s.label ?? ""} value={s.label ?? ""}>
              {s.label ?? "No semester set"} ({s.count} {s.count === 1 ? "course" : "courses"})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="to" label="New semester" error={errors.to}>
        <Input
          id="to"
          name="to"
          required
          defaultValue={v("to", suggestion)}
          placeholder="2027 Genap"
          aria-invalid={errors.to ? true : undefined}
          aria-describedby={describedBy("to", errors.to)}
        />
      </Field>
      <fieldset className="grid gap-3 rounded-xl border border-border-soft p-3">
        <label className="flex items-center gap-2 font-medium text-sm">
          <input
            type="checkbox"
            name="copySlots"
            defaultChecked={checked("copySlots")}
            className="size-4 accent-(--primary)"
          />
          Copy the weekly class times too
        </label>
        <div className="grid grid-cols-2 gap-4 sm:w-fit">
          <Field id="startsOn" label="First day of classes" optional error={errors.startsOn}>
            <Input id="startsOn" name="startsOn" type="date" defaultValue={v("startsOn")} />
          </Field>
          <Field id="endsOn" label="Last day" optional error={errors.endsOn}>
            <Input id="endsOn" name="endsOn" type="date" defaultValue={v("endsOn")} />
          </Field>
        </div>
        <p className="text-muted-foreground text-xs">
          Times often change between semesters: fix any that did after copying.
        </p>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="archiveOld"
          defaultChecked={checked("archiveOld")}
          className="size-4 accent-(--primary)"
        />
        Archive the old courses (their grades, tasks and attendance are kept)
      </label>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Copying…" : "Start new semester"}
        </Button>
        <CancelButton href="/courses" />
      </div>
    </form>
  );
}
