"use client";

import { Archive, CalendarRange, Copy } from "lucide-react";
import { useActionState } from "react";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection } from "@/components/form/form-section";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/core";
import { startNewSemester } from "../actions";

type Props = { semesters: { label: string | null; count: number }[]; suggestion: string };

/** Copy last semester's courses (and optionally their class times) into a new semester. */
export function RolloverForm({ semesters, suggestion }: Props) {
  const t = useT();
  const [state, action, pending] = useActionState(startNewSemester, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const v = (name: string, fallback = "") => state?.values?.[name] ?? fallback;
  const checked = (name: string) => (state?.values ? state.values[name] === "on" : true);
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="flex flex-col gap-6" noValidate>
      <SheetFormBridge state={state} message="New semester ready" />
      <FormSection title="Semesters" icon={CalendarRange}>
        <Field id="from" label="Copy courses from" error={errors.from}>
          <NativeSelect id="from" name="from" defaultValue={v("from", semesters[0]?.label ?? "")}>
            {semesters.map((s) => (
              <option key={s.label ?? ""} value={s.label ?? ""}>
                {s.label ?? t("No semester set")} ({t(plural(s.count, "{n} course", "{n} courses"), { n: s.count })})
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
            placeholder={t("e.g. {example}", { example: "2027 Genap" })}
            aria-invalid={errors.to ? true : undefined}
            aria-describedby={describedBy("to", errors.to)}
          />
        </Field>
      </FormSection>
      <FormSection title="Class times" icon={Copy}>
        <label className="flex min-h-11 items-center gap-2 font-medium text-sm">
          <input
            type="checkbox"
            name="copySlots"
            defaultChecked={checked("copySlots")}
            className="size-4 accent-(--primary)"
          />
          {t("Copy the weekly class times too")}
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
          {t("Times often change between semesters: fix any that did after copying.")}
        </p>
      </FormSection>
      <FormSection title="Old courses" icon={Archive}>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="archiveOld"
            defaultChecked={checked("archiveOld")}
            className="size-4 accent-(--primary)"
          />
          {t("Archive the old courses (their grades, tasks and attendance are kept)")}
        </label>
      </FormSection>
      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? t("Copying…") : t("Start new semester")}
        </Button>
        <CancelButton href="/courses" />
      </FormFooter>
    </form>
  );
}
