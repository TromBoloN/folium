"use client";

import { CalendarClock, MapPin, Sparkles } from "lucide-react";
import { useActionState, useState } from "react";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection, MoreDetails } from "@/components/form/form-section";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { TrL, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { createExtraSession } from "../actions";
import { EXTRA_LABELS } from "../schema";

type Props = {
  courses: { id: string; name: string; code: string | null }[];
  prefill: { date: string; courseId?: string };
};

/** An extra session: a makeup class or an exam, on one date. Not part of the weekly timetable. */
export function ExtraSessionForm({ courses, prefill }: Props) {
  const t = useT();
  const [state, action, pending] = useActionState(createExtraSession, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const initial: Record<string, string> = {
    courseId: prefill.courseId ?? courses[0]?.id ?? "",
    date: prefill.date,
    startTime: "08:00",
    endTime: "09:40",
    label: t("Makeup"),
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
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="flex flex-col gap-6" noValidate>
      <SheetFormBridge state={state} message="Session added" />
      <FormSection title="What" icon={Sparkles}>
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
          <legend className="mb-1 font-medium text-sm">{t("What is it?")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {EXTRA_LABELS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={label === t(l)}
                onClick={() => setLabel(t(l))}
                className={cn(
                  "h-11 rounded-pill border border-border px-4 font-medium text-sm transition-colors md:h-9",
                  label === t(l)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-surface-1 hover:border-foreground/25",
                )}
              >
                {t(l)}
              </button>
            ))}
          </div>
          <Input
            aria-label={t("Label")}
            name="label"
            value={label}
            maxLength={40}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("e.g. Midterm exam")}
            className="sm:w-64"
          />
          {errors.label ? (
            <p className="text-destructive text-xs">
              <TrL text={errors.label} />
            </p>
          ) : null}
        </fieldset>
      </FormSection>
      <FormSection title="When" icon={CalendarClock}>
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
      </FormSection>
      <FormSection title="Where" icon={MapPin}>
        <Field id="location" label="Room" optional error={errors.location} hint="Leave blank to use the course room.">
          <Input placeholder={t("e.g. Aula Utama")} {...field("location", "hint")} />
        </Field>
      </FormSection>
      <MoreDetails summary="Add a note" open={Boolean(errors.note || value("note"))}>
        <Field id="note" label="Note" optional error={errors.note}>
          <Input placeholder={t("e.g. Bring a calculator")} maxLength={200} {...field("note")} />
        </Field>
      </MoreDetails>
      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? t("Saving…") : t("Add session")}
        </Button>
        <CancelButton href={`/courses?view=day&week=${prefill.date}`} />
      </FormFooter>
    </form>
  );
}
