"use client";

import { BookOpen, CalendarRange, Hash, ListTodo, MapPin, User } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection, MoreDetails } from "@/components/form/form-section";
import { Stepper } from "@/components/form/stepper";
import { CancelButton, SheetFormBridge, useSheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { useI18n, useT } from "@/lib/i18n/client";
import { createCourse, updateCourse } from "../actions";
import type { Course } from "../schema";
import { ColorField } from "./color-field";

type Props = {
  semesters: string[];
  /** The user's class types (settings). */
  classTypes: { id: string; name: string; meetings: number }[];
} & (
  | { mode: "create"; defaultColor: string; course?: undefined; currentMeeting?: undefined }
  | {
      mode: "edit";
      course: Course;
      defaultColor?: undefined;
      /** The next meeting to log, from the meeting log. */
      currentMeeting: number;
    }
);

/**
 * Basics first (name, code, credits, colour), the rest under "More details".
 * A live preview of the course card sits on top and the sheet takes the colour.
 */
export function CourseForm(props: Props) {
  const { t, tl } = useI18n();
  const [state, action, pending] = useActionState(props.mode === "create" ? createCourse : updateCourse, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const initial: Record<string, string | null | undefined> = props.course
    ? {
        ...props.course,
        credits: String(props.course.credits),
        totalMeetings: props.course.totalMeetings === null ? "" : String(props.course.totalMeetings),
        currentMeeting: String(props.currentMeeting),
      }
    : { semester: props.semesters[0] ?? "", kind: "campus", currentMeeting: "1" };
  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const cancelHref = props.mode === "edit" ? `/courses/${props.course.id}` : "/courses";

  // Live preview state (the inputs stay uncontrolled, so the form works without JavaScript).
  const [preview, setPreview] = useState({
    name: value("name"),
    code: value("code"),
    credits: value("credits") || "0",
    room: value("room"),
    color: (state?.values?.color ?? props.course?.color ?? props.defaultColor ?? "").toLowerCase(),
  });
  // Campus-only fields hide for an external course (without JavaScript they all show; the server ignores them).
  const [kind, setKind] = useState(value("kind") || "campus");
  const campus = kind !== "external";
  // Picking a class type fills in its meeting count; typing one yourself stops that.
  const [meetings, setMeetings] = useState(value("totalMeetings"));
  const [meetingsTouched, setMeetingsTouched] = useState(props.mode === "edit");
  const sheet = useSheet();
  useEffect(() => {
    sheet?.setTint(preview.color || null);
    return () => sheet?.setTint(null);
  }, [sheet, preview.color]);

  const details = ["lecturer", "lecturerEmail", "lecturerPhone", "room", "semester"];
  const typeName = (name: string) => tl(name);
  const detailsOpen = details.some((f) => errors[f]) || (props.mode === "edit" && details.some((f) => value(f)));

  const text = (
    name: string,
    label: string,
    extra: Partial<React.ComponentProps<"input">> & { hint?: string } = {},
  ) => {
    const { hint, ...input } = extra;
    return (
      <Field id={name} label={label} optional={!input.required} error={errors[name]} hint={hint}>
        <Input
          id={name}
          name={name}
          defaultValue={value(name)}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={describedBy(name, errors[name], hint)}
          {...input}
          placeholder={input.placeholder ? tl(input.placeholder) : undefined}
        />
      </Field>
    );
  };

  return (
    <form
      action={action}
      className="flex flex-col gap-6"
      noValidate
      onInput={(e) => {
        const el = e.target as HTMLInputElement;
        if (["name", "code", "credits", "room"].includes(el.name)) setPreview((p) => ({ ...p, [el.name]: el.value }));
      }}
    >
      <SheetFormBridge state={state} message={props.mode === "create" ? t("Course added") : t("Course saved")} />
      {props.mode === "edit" ? <input type="hidden" name="id" value={props.course.id} /> : null}

      <CoursePreview {...preview} />

      <FormSection title="Basics" icon={BookOpen}>
        <ChipGroup
          name="kind"
          legend={t("Where is it?")}
          defaultValue={kind}
          error={errors.kind}
          options={[
            { value: "campus", label: t("Campus") },
            { value: "external", label: t("Outside campus") },
          ]}
          onChange={([v]) => setKind(v ?? "campus")}
        />
        {text("name", "Name", { required: true, autoFocus: true, autoComplete: "off", placeholder: "e.g. Calculus I" })}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          {text("code", "Code", { placeholder: "e.g. MAT101", autoComplete: "off" })}
          <div className={campus ? undefined : "hidden"}>
            <Field id="credits" label="Credits" optional error={errors.credits} hint="0 for things that aren't graded.">
              <Stepper
                id="credits"
                name="credits"
                unit="SKS"
                min={0}
                max={24}
                step={0.5}
                defaultValue={value("credits") || "0"}
                aria-invalid={errors.credits ? true : undefined}
                aria-describedby={describedBy("credits", errors.credits, "hint")}
              />
            </Field>
          </div>
        </div>
        <ColorField
          // Remount with the submitted colour if the server sends the form back.
          key={state?.values?.color ?? "initial"}
          defaultValue={preview.color}
          error={errors.color}
          onChange={(color) => setPreview((p) => ({ ...p, color }))}
        />
      </FormSection>

      <FormSection title="Meetings" icon={Hash}>
        {campus && props.classTypes.length > 0 ? (
          <ChipGroup
            name="classType"
            legend={t("Class type")}
            optional
            defaultValue={value("classType")}
            error={errors.classType}
            options={[
              { value: "", label: t("None") },
              ...props.classTypes.map((c) => ({
                value: c.id,
                label: t("{name} · {n}", { name: typeName(c.name), n: c.meetings }),
              })),
            ]}
            onChange={([id]) => {
              const type = props.classTypes.find((c) => c.id === id);
              if (type && !meetingsTouched) setMeetings(String(type.meetings));
            }}
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="totalMeetings"
            label="Meetings in total"
            optional
            error={errors.totalMeetings}
            hint={campus ? "Leave blank to use the class type's." : "Leave blank if it has no set end."}
          >
            <Stepper
              id="totalMeetings"
              name="totalMeetings"
              min={1}
              max={200}
              step={1}
              value={meetings}
              onChange={(e) => {
                setMeetings(e.target.value);
                setMeetingsTouched(true);
              }}
              aria-invalid={errors.totalMeetings ? true : undefined}
              aria-describedby={describedBy("totalMeetings", errors.totalMeetings, "hint")}
            />
          </Field>
          <Field
            id="currentMeeting"
            label="Next meeting is number"
            optional
            error={errors.currentMeeting}
            hint="Joining mid-way? Earlier meetings count as unknown, not attended."
          >
            <Stepper
              id="currentMeeting"
              name="currentMeeting"
              min={1}
              max={Number(meetings) || 200}
              step={1}
              defaultValue={value("currentMeeting")}
              aria-invalid={errors.currentMeeting ? true : undefined}
              aria-describedby={describedBy("currentMeeting", errors.currentMeeting, "hint")}
            />
          </Field>
        </div>
        {props.mode === "edit" ? (
          <input type="hidden" name="currentMeetingWas" value={String(props.currentMeeting)} />
        ) : null}
      </FormSection>

      <MoreDetails hint="Lecturer, contact, room and semester" open={detailsOpen}>
        <FormSection title="Lecturer and contact" icon={User}>
          {text("lecturer", "Lecturer", { placeholder: "e.g. Dr. Siti Rahma" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("lecturerEmail", "Email", { type: "email", inputMode: "email", placeholder: "name@campus.ac.id" })}
            {text("lecturerPhone", "WhatsApp", {
              type: "tel",
              inputMode: "tel",
              placeholder: "+62 812 3456 7890",
              pattern: "\\+?[0-9][0-9 ()\\-]{5,22}",
              hint: "Adds a WhatsApp button.",
            })}
          </div>
        </FormSection>
        <FormSection title="Room and semester" icon={MapPin}>
          {text("room", "Room", { placeholder: "e.g. B2.04", hint: "Used for class times without their own room." })}
          {campus
            ? text("semester", "Semester", {
                list: "semester-options",
                autoComplete: "off",
                placeholder: "e.g. 2026 Ganjil",
                hint:
                  props.semesters.length > 0
                    ? "Pick one you already use, or type a new one."
                    : "Courses with the same semester are grouped together.",
              })
            : null}
          <datalist id="semester-options">
            {props.semesters.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </FormSection>
      </MoreDetails>

      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending ? t("Saving…") : props.mode === "create" ? t("Add course") : t("Save changes")}
        </Button>
        <CancelButton href={cancelHref} />
      </FormFooter>
    </form>
  );
}

/** The course card as it will look (same tint, code chip, serif name, credits). */
function CoursePreview({ name, code, credits, room, color }: Record<string, string>) {
  const t = useT();
  return (
    <div
      aria-hidden
      style={{ "--tint": color } as React.CSSProperties}
      className="tile tile-tinted relative flex flex-col gap-2 overflow-hidden p-4 pl-5"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
      <span className="flex items-center gap-2">
        {code ? (
          <Pill tone="course">{code}</Pill>
        ) : (
          <span className="text-muted-foreground text-xs">{t("Preview")}</span>
        )}
      </span>
      <span className="font-display font-medium text-xl leading-tight">
        {name || <span className="text-muted-foreground">{t("Course name")}</span>}
      </span>
      <span className="flex flex-wrap gap-x-3 text-muted-foreground text-xs">
        <span className="inline-flex items-center gap-1">
          <CalendarRange className="size-3.5" />
          {Number(credits) > 0 ? t("{n} SKS", { n: credits }) : t("Not graded")}
        </span>
        {room ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {room}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <ListTodo className="size-3.5" />
          {t("{n} open tasks", { n: 0 })}
        </span>
      </span>
    </div>
  );
}
