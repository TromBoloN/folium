"use client";

import { CalendarClock, ListTodo, NotebookPen } from "lucide-react";
import { useActionState, useRef } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection, MoreDetails } from "@/components/form/form-section";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { addDays, todayIn } from "@/lib/dates";
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
  const dueHint = `No time means "by the end of the day" (${timeZone.replaceAll("_", " ")}).`;
  // Archived courses only appear if this task already uses one.
  const options = courses.filter((c) => !c.archived || c.id === defaults.courseId);
  const dateRef = useRef<HTMLInputElement>(null);
  const today = todayIn(timeZone);
  const quickDates = [
    ["Today", today],
    ["Tomorrow", addDays(today, 1)],
    ["In a week", addDays(today, 7)],
  ] as const;

  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-6" noValidate>
      <SheetFormBridge state={state} message={id ? "Task saved" : "Task added"} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <FormSection title="Task" icon={ListTodo}>
        <Field id="title" label="Title" error={errors.title} requiredMessage="Give the task a title.">
          <Input
            id="title"
            name="title"
            defaultValue={value("title")}
            placeholder="e.g. Problem set 3"
            autoComplete="off"
            autoFocus={!id}
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
                {c.code ? `${c.code} · ${c.name}` : c.name}
                {c.archived ? " (archived)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <ChipGroup
          name="priority"
          legend="Priority"
          defaultValue={value("priority")}
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        />
      </FormSection>

      <FormSection title="Due" icon={CalendarClock}>
        <div className="grid grid-cols-2 gap-4 sm:w-fit">
          <Field id="dueDate" label="Date" optional error={errors.dueDate}>
            <Input
              ref={dateRef}
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={value("dueDate")}
              aria-invalid={errors.dueDate ? true : undefined}
              aria-describedby={errors.dueDate ? "dueDate-error" : "due-hint"}
            />
          </Field>
          <Field id="dueTime" label="Time" optional error={errors.dueTime}>
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
        <div className="flex flex-wrap items-center gap-1.5">
          {quickDates.map(([label, date]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (dateRef.current) dateRef.current.value = date;
              }}
              className="h-9 rounded-full border border-border px-3 text-sm transition-colors hover:border-foreground/25 hover:bg-accent"
            >
              {label}
            </button>
          ))}
        </div>
        <p id="due-hint" className="text-muted-foreground text-xs">
          {dueHint}
        </p>
      </FormSection>

      <MoreDetails hint="Status and notes" open={Boolean(errors.notes || errors.status || (id && value("notes")))}>
        <FormSection title="Progress and notes" icon={NotebookPen}>
          <ChipGroup
            name="status"
            legend="Status"
            defaultValue={value("status")}
            options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            error={errors.status}
          />
          <Field id="notes" label="Notes" optional error={errors.notes}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={value("notes")}
              rows={5}
              placeholder="Links, page numbers, who's in your group…"
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={describedBy("notes", errors.notes)}
            />
          </Field>
        </FormSection>
      </MoreDetails>

      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add task"}
        </Button>
        <CancelButton href={id ? `/tasks/${id}` : "/tasks"} />
      </FormFooter>
    </form>
  );
}
