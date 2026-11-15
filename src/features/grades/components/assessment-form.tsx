"use client";

import { CalendarDays, ClipboardCheck, Scale } from "lucide-react";
import { useActionState, useState } from "react";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection } from "@/components/form/form-section";
import { Stepper } from "@/components/form/stepper";
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
  const [score, setScore] = useState({ score: value("score"), max: value("maxScore") || "100" });
  const percent =
    score.score !== "" && Number(score.max) > 0
      ? Math.round((Number(score.score) / Number(score.max)) * 1000) / 10
      : null;

  return (
    <form
      key={JSON.stringify(state)}
      action={action}
      className="flex flex-col gap-6"
      noValidate
      onInput={(e) => {
        const el = e.target as HTMLInputElement;
        if (el.name === "score") setScore((s) => ({ ...s, score: el.value }));
        if (el.name === "maxScore") setScore((s) => ({ ...s, max: el.value }));
      }}
    >
      <SheetFormBridge state={state} message={id ? "Assessment saved" : "Assessment added"} />
      <input type="hidden" name="courseId" value={courseId} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <FormSection title="Assessment" icon={ClipboardCheck}>
        <Field id="name" label="Name" error={errors.name} requiredMessage="Give it a name, e.g. Midterm exam.">
          <Input {...input("name")} placeholder="e.g. Midterm exam" autoComplete="off" autoFocus={!id} required />
        </Field>
        <Field id="weight" label="Weight (% of the course grade)" error={errors.weight} hint="e.g. 30 for 30%.">
          <Stepper {...input("weight", "hint")} unit="%" min={0} max={100} step={5} required />
        </Field>
      </FormSection>

      <FormSection title="Score" icon={Scale}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Field id="score" label="Score" optional error={errors.score}>
              <Input {...input("score")} type="number" inputMode="decimal" min={0} step="any" placeholder="—" />
            </Field>
          </div>
          <span className="pb-3 text-muted-foreground">/</span>
          <div className="w-32">
            <Field id="maxScore" label="Out of" error={errors.maxScore}>
              <Input {...input("maxScore")} type="number" inputMode="decimal" min={0} step="any" placeholder="100" />
            </Field>
          </div>
          <span className="pb-3 font-medium tabular-nums" aria-live="polite">
            {percent !== null && Number.isFinite(percent) ? `= ${percent}%` : ""}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">Leave the score empty until it's graded.</p>
      </FormSection>

      <FormSection title="Date" icon={CalendarDays}>
        <Field id="dueDate" label="Date" optional error={errors.dueDate}>
          <Input {...input("dueDate")} type="date" className="w-48" />
        </Field>
      </FormSection>

      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add assessment"}
        </Button>
        <CancelButton href={`/grades/${courseId}`} />
      </FormFooter>
    </form>
  );
}
