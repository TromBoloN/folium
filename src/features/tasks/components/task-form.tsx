"use client";

import { useActionState } from "react";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { CourseOption } from "../../courses/queries";
import { createTask, updateTask } from "../actions";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, STATUSES } from "../schema";

export type TaskFormDefaults = {
  title: string;
  notes: string;
  courseId: string;
  dueDate: string;
  dueTime: string;
  priority: string;
  status: string;
};

type Props = { id?: string; defaults: TaskFormDefaults; courses: CourseOption[]; timeZone: string };

export function TaskForm({ id, defaults, courses, timeZone }: Props) {
  const [state, action, pending] = useActionState(id ? updateTask : createTask, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  // After an error, show what was submitted: React resets uncontrolled fields when the action finishes.
  const submitted = state && !state.ok ? state.values : undefined;
  const value = (name: keyof TaskFormDefaults) => submitted?.[name] ?? defaults[name];
  const dueHint = `Leave the time empty for "by the end of the day" (${timeZone.replaceAll("_", " ")}).`;
  // Archived courses only appear if this task already uses one.
  const options = courses.filter((c) => !c.archived || c.id === defaults.courseId);

  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-5" noValidate>
      <SheetFormBridge state={state} message={id ? "Task saved" : "Task added"} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <Field id="title" label="Title" error={errors.title}>
        <Input
          id="title"
          name="title"
          defaultValue={value("title")}
          placeholder="Problem set 3"
          autoComplete="off"
          required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy("title", errors.title)}
        />
      </Field>

      <Field id="courseId" label="Course" optional error={errors.courseId}>
        <NativeSelect id="courseId" name="courseId" defaultValue={value("courseId")}>
          <option value="">No course</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.archived ? " (archived)" : ""}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium text-sm">
          Due <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field id="dueDate" label="Date" error={errors.dueDate}>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={value("dueDate")}
              aria-invalid={errors.dueDate ? true : undefined}
              aria-describedby={errors.dueDate ? "dueDate-error" : "due-hint"}
            />
          </Field>
          <Field id="dueTime" label="Time" error={errors.dueTime}>
            <Input
              id="dueTime"
              name="dueTime"
              type="time"
              step={300}
              defaultValue={value("dueTime")}
              aria-invalid={errors.dueTime ? true : undefined}
              aria-describedby={errors.dueTime ? "dueTime-error" : "due-hint"}
            />
          </Field>
        </div>
        <p id="due-hint" className="text-muted-foreground text-xs">
          {dueHint}
        </p>
      </fieldset>

      <ChoiceGroup
        name="priority"
        legend="Priority"
        columns={4}
        defaultValue={value("priority")}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
      />

      <Field id="status" label="Status" error={errors.status}>
        <NativeSelect id="status" name="status" defaultValue={value("status")}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field id="notes" label="Notes" optional error={errors.notes}>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={value("notes")}
          rows={5}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={describedBy("notes", errors.notes)}
        />
      </Field>

      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add task"}
        </Button>
        <CancelButton href={id ? `/tasks/${id}` : "/tasks"} />
      </div>
    </form>
  );
}
