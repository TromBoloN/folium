"use client";

import { useActionState } from "react";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createCourse, updateCourse } from "../actions";
import type { Course } from "../schema";
import { ColorField } from "./color-field";

type Props =
  | { mode: "create"; defaultColor: string; course?: undefined }
  | { mode: "edit"; course: Course; defaultColor?: undefined };

const TEXT_FIELDS = [
  { name: "name", label: "Name", autoComplete: "off", placeholder: "Calculus I", required: true },
  { name: "code", label: "Code", placeholder: "MAT101" },
  { name: "lecturer", label: "Lecturer", placeholder: "Dr. Siti Rahma" },
  {
    name: "room",
    label: "Room",
    placeholder: "Building B, 2.04",
    hint: "Used for class times without their own location.",
  },
  { name: "semester", label: "Semester", placeholder: "2026 Ganjil" },
] as const;

export function CourseForm(props: Props) {
  const [state, action, pending] = useActionState(props.mode === "create" ? createCourse : updateCourse, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const initial: Record<string, string | null | undefined> = props.course
    ? { ...props.course, credits: String(props.course.credits) }
    : {};
  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const cancelHref = props.mode === "edit" ? `/courses/${props.course.id}` : "/courses";

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <SheetFormBridge state={state} message={props.mode === "create" ? "Course added" : "Course saved"} />
      {props.mode === "edit" ? <input type="hidden" name="id" value={props.course.id} /> : null}

      {TEXT_FIELDS.map((f) => {
        const required = "required" in f && f.required;
        const hint = "hint" in f ? f.hint : undefined;
        return (
          <Field key={f.name} id={f.name} label={f.label} optional={!required} error={errors[f.name]} hint={hint}>
            <Input
              id={f.name}
              name={f.name}
              defaultValue={value(f.name)}
              placeholder={f.placeholder}
              required={required}
              autoComplete={"autoComplete" in f ? f.autoComplete : undefined}
              aria-invalid={errors[f.name] ? true : undefined}
              aria-describedby={describedBy(f.name, errors[f.name], hint)}
            />
          </Field>
        );
      })}

      <Field
        id="credits"
        label="Credits (SKS)"
        optional
        error={errors.credits}
        hint="Used to weight your GPA. Leave 0 for things that aren't graded."
      >
        <Input
          id="credits"
          name="credits"
          type="number"
          inputMode="decimal"
          min={0}
          max={24}
          step="0.5"
          defaultValue={value("credits") || "0"}
          className="w-28"
          aria-invalid={errors.credits ? true : undefined}
          aria-describedby={describedBy("credits", errors.credits, "hint")}
        />
      </Field>

      <ColorField
        // Remount with the submitted colour if the server sends the form back.
        key={state?.values?.color ?? "initial"}
        defaultValue={state?.values?.color ?? props.course?.color ?? props.defaultColor ?? ""}
        error={errors.color}
      />

      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : props.mode === "create" ? "Add course" : "Save changes"}
        </Button>
        <CancelButton href={cancelHref} />
      </div>
    </form>
  );
}
