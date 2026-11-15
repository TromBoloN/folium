"use client";

import { useActionState, useState } from "react";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { createExtraSession } from "../actions";
import { EXTRA_LABELS } from "../schema";

type Props = {
  courses: { id: string; name: string; code: string | null }[];
  prefill: { date: string; courseId?: string };
};

/** An extra session: a makeup class or an exam, on one date. Not part of the weekly timetable. */
export function ExtraSessionForm({ courses, prefill }: Props) {
  const [state, action, pending] = useActionState(createExtraSession, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const initial: Record<string, string> = {
    courseId: prefill.courseId ?? courses[0]?.id ?? "",
    date: prefill.date,
    startTime: "08:00",
    endTime: "09:40",
    label: "Makeup",
  };
  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const [label, setLabel] = useState(value("label"));
  const field = (name: string, hint?: string) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });

  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="flex flex-col gap-5" noValidate>
      <SheetFormBridge state={state} message="Session added" />
      <Field id="courseId" label="Course" error={errors.courseId}>
        <NativeSelect {...field("courseId")}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} · ${c.name}` : c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-medium text-sm">What is it?</legend>
        <div className="flex flex-wrap gap-1.5">
          {EXTRA_LABELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={label === l}
              onClick={() => setLabel(l)}
              className={cn(
                "rounded-full border border-border-soft px-3 py-1 text-sm transition-colors",
                label === l ? "bg-foreground text-background" : "hover:bg-accent",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <Input
          aria-label="Label"
          name="label"
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Midterm exam"
          className="sm:w-64"
        />
        {errors.label ? <p className="text-destructive text-xs">{errors.label}</p> : null}
      </fieldset>
      <Field id="date" label="Date" error={errors.date}>
        <Input type="date" required className="w-fit" {...field("date")} />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:w-fit">
        <Field id="startTime" label="Starts" error={errors.startTime}>
          <Input type="time" step={300} required {...field("startTime")} />
        </Field>
        <Field id="endTime" label="Ends" error={errors.endTime}>
          <Input type="time" step={300} required {...field("endTime")} />
        </Field>
      </div>
      <Field id="location" label="Room" optional error={errors.location} hint="Leave blank to use the course room.">
        <Input placeholder="Aula Utama" {...field("location", "hint")} />
      </Field>
      <Field id="note" label="Note" optional error={errors.note}>
        <Input placeholder="Bring a calculator" maxLength={200} {...field("note")} />
      </Field>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add session"}
        </Button>
        <CancelButton href={`/courses?view=day&week=${prefill.date}`} />
      </div>
    </form>
  );
}
