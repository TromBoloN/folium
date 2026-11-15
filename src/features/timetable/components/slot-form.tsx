"use client";

import { useActionState } from "react";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createSlot, updateSlot } from "../actions";
import { WEEKDAYS } from "../logic";
import type { TimetableSlot } from "../types";

type Props = {
  /** The course the class time belongs to; omit to let the user pick one from `courses`. */
  courseId?: string;
  courses?: { id: string; name: string; code: string | null }[];
  slot?: TimetableSlot;
  defaultLocation?: string | null;
  /** Prefill for a new class time (e.g. the timetable cell that was clicked). */
  prefill?: { weekday?: number; startTime?: string; endTime?: string };
  /** Where to go after saving on a full page (validated by the action); default: the course. */
  returnTo?: string;
};

export function SlotForm({ courseId, courses, slot, defaultLocation, prefill, returnTo }: Props) {
  const [state, action, pending] = useActionState(slot ? updateSlot : createSlot, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const initial: Record<string, string> = slot
    ? {
        weekday: String(slot.weekday),
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: slot.location ?? "",
        startsOn: slot.startsOn ?? "",
        endsOn: slot.endsOn ?? "",
      }
    : {
        weekday: String(prefill?.weekday ?? 1),
        startTime: prefill?.startTime ?? "08:00",
        endTime: prefill?.endTime ?? "09:40",
        courseId: courses?.[0]?.id ?? "",
      };
  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const field = (name: string, hint?: string) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });

  const locationHint = defaultLocation ? `Leave blank to use the course room (${defaultLocation}).` : undefined;
  const rangeHint = "Leave blank if the class runs all semester.";

  return (
    // key: remount so selects pick up values the server sends back after an error.
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="flex flex-col gap-5" noValidate>
      <SheetFormBridge state={state} message={slot ? "Class time saved" : "Class time added"} />
      {courseId ? (
        <input type="hidden" name="courseId" value={courseId} />
      ) : (
        <Field id="courseId" label="Course" error={errors.courseId}>
          <NativeSelect {...field("courseId")}>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} · ${c.name}` : c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {slot ? <input type="hidden" name="id" value={slot.id} /> : null}

      <Field id="weekday" label="Day" error={errors.weekday}>
        <NativeSelect {...field("weekday")}>
          {WEEKDAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="startTime" label="Starts" error={errors.startTime}>
          <Input type="time" step={300} required {...field("startTime")} />
        </Field>
        <Field id="endTime" label="Ends" error={errors.endTime}>
          <Input type="time" step={300} required {...field("endTime")} />
        </Field>
      </div>

      <Field id="location" label="Location" optional error={errors.location} hint={locationHint}>
        <Input placeholder={defaultLocation ?? "Building B, 2.04"} {...field("location", locationHint)} />
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium text-sm">
          Date range <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field id="startsOn" label="First class" error={errors.startsOn}>
            <Input
              type="date"
              {...field("startsOn")}
              aria-describedby={errors.startsOn ? "startsOn-error" : "range-hint"}
            />
          </Field>
          <Field id="endsOn" label="Last class" error={errors.endsOn}>
            <Input type="date" {...field("endsOn")} aria-describedby={errors.endsOn ? "endsOn-error" : "range-hint"} />
          </Field>
        </div>
        <p id="range-hint" className="text-muted-foreground text-xs">
          {rangeHint}
        </p>
      </fieldset>

      <p className="text-muted-foreground text-xs">
        Overlapping another class is fine; it will be marked in your timetable.
      </p>

      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : slot ? "Save changes" : "Add class time"}
        </Button>
        <CancelButton href={returnTo ?? (courseId ? `/courses/${courseId}` : "/courses")} />
      </div>
    </form>
  );
}
