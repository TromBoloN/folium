"use client";

import { useActionState } from "react";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createAssessment, updateAssessment } from "../actions";

export type AssessmentDefaults = { name: string; weight: string; maxScore: string; score: string; dueDate: string };

type Props = { courseId: string; id?: string; defaults: AssessmentDefaults };

export function AssessmentForm({ courseId, id, defaults }: Props) {
  const [state, action, pending] = useActionState(id ? updateAssessment : createAssessment, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const submitted = state && !state.ok ? state.values : undefined;
  const value = (name: keyof AssessmentDefaults) => submitted?.[name] ?? defaults[name];
  const input = (name: keyof AssessmentDefaults, hint?: string) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });

  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-5" noValidate>
      <SheetFormBridge state={state} message={id ? "Assessment saved" : "Assessment added"} />
      <input type="hidden" name="courseId" value={courseId} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <Field id="name" label="Name" error={errors.name}>
        <Input {...input("name")} placeholder="Midterm exam" autoComplete="off" required />
      </Field>

      <Field id="weight" label="Weight (% of the course grade)" error={errors.weight} hint="e.g. 30 for 30%.">
        <Input
          {...input("weight", "hint")}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="any"
          className="w-32"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="score" label="Score" optional error={errors.score} hint="Leave empty until it's graded.">
          <Input {...input("score", "hint")} type="number" inputMode="decimal" min={0} step="any" />
        </Field>
        <Field id="maxScore" label="Out of" error={errors.maxScore}>
          <Input {...input("maxScore")} type="number" inputMode="decimal" min={0} step="any" placeholder="100" />
        </Field>
      </div>

      <Field id="dueDate" label="Date" optional error={errors.dueDate}>
        <Input {...input("dueDate")} type="date" className="w-48" />
      </Field>

      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add assessment"}
        </Button>
        <CancelButton href={`/grades/${courseId}`} />
      </div>
    </form>
  );
}
