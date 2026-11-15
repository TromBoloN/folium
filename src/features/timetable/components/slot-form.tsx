"use client";

import { CalendarRange, Clock, MapPin, TriangleAlert, Video } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormFooter } from "@/components/form/form-footer";
import { FormSection, MoreDetails } from "@/components/form/form-section";
import { CancelButton, SheetFormBridge } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { createSlot, updateSlot } from "../actions";
import { addMinutes, formatTime, slotsConflict, suggestedDuration, toMinutes, WEEKDAYS } from "../logic";
import type { TimetableSlot } from "../types";

/** Another class time already in the timetable, for the preview and the overlap warning. */
export type ExistingSlot = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  startsOn: string | null;
  endsOn: string | null;
  title: string;
  color: string;
};

type Props = {
  /** The course the class time belongs to; omit to let the user pick one from `courses`. */
  courseId?: string;
  courses?: { id: string; name: string; code: string | null; credits: number }[];
  /** Credits of the fixed course (for the suggested length). */
  credits?: number;
  slot?: TimetableSlot;
  defaultLocation?: string | null;
  /** Prefill for a new class time (e.g. the timetable cell that was clicked). */
  prefill?: { weekday?: number; startTime?: string; endTime?: string };
  /** Where to go after saving on a full page (validated by the action); default: the course. */
  returnTo?: string;
  existing: ExistingSlot[];
  /** One-tap start times (the ones used most). */
  startTimes: string[];
  timeFormat: "24h" | "12h";
};

export function SlotForm(props: Props) {
  const { courseId, courses, slot, defaultLocation, prefill, returnTo, existing, startTimes, timeFormat } = props;
  const [state, action, pending] = useActionState(slot ? updateSlot : createSlot, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const creditsOf = (id: string) => courses?.find((c) => c.id === id)?.credits ?? props.credits ?? 0;
  const firstCourse = courseId ?? courses?.[0]?.id ?? "";
  const defaultStart = prefill?.startTime ?? "08:00";
  const initial: Record<string, string> = slot
    ? {
        weekday: String(slot.weekday),
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: slot.location ?? "",
        startsOn: slot.startsOn ?? "",
        endsOn: slot.endsOn ?? "",
        online: slot.online ? "on" : "",
        meetingUrl: slot.meetingUrl ?? "",
      }
    : {
        weekday: String(prefill?.weekday ?? 1),
        startTime: defaultStart,
        endTime: prefill?.endTime ?? addMinutes(defaultStart, suggestedDuration(creditsOf(firstCourse))),
        courseId: firstCourse,
      };
  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const field = (name: string, hint?: string) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name], hint),
  });

  // Live state for the preview and the end-follows-start behaviour. Inputs stay
  // uncontrolled (refs), so the form submits the same way without JavaScript.
  const [live, setLive] = useState({
    weekdays: value("weekday").split(",").filter(Boolean).map(Number),
    start: value("startTime"),
    end: value("endTime"),
    course: value("courseId") || firstCourse,
    startsOn: value("startsOn"),
    endsOn: value("endsOn"),
  });
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const endTouched = useRef(Boolean(slot));
  const lengthFor = (course: string) =>
    endTouched.current ? toMinutes(live.end) - toMinutes(live.start) : suggestedDuration(creditsOf(course));

  const setStart = (start: string, length = lengthFor(live.course)) => {
    if (!/^\d{2}:\d{2}$/.test(start)) return;
    const end = length > 0 ? addMinutes(start, length) : live.end;
    if (startRef.current) startRef.current.value = start;
    if (endRef.current) endRef.current.value = end;
    setLive((l) => ({ ...l, start, end }));
  };

  const locationHint = defaultLocation ? `Leave blank to use the course room (${defaultLocation}).` : undefined;
  const moreOpen = Boolean(
    errors.startsOn ||
      errors.endsOn ||
      errors.meetingUrl ||
      value("startsOn") ||
      value("endsOn") ||
      value("meetingUrl"),
  );
  const credits = creditsOf(live.course);

  return (
    // key: remount so selects and chips pick up values the server sends back after an error.
    <form
      key={JSON.stringify(state?.values ?? {})}
      action={action}
      className="flex flex-col gap-6"
      noValidate
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.name === "courseId") {
          setLive((l) => ({ ...l, course: el.value }));
          if (!endTouched.current) setStart(live.start, suggestedDuration(creditsOf(el.value)));
        }
        if (el.name === "startsOn" || el.name === "endsOn") setLive((l) => ({ ...l, [el.name]: el.value }));
      }}
    >
      <SheetFormBridge state={state} message={slot ? "Class time saved" : "Class time added"} />
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {slot ? <input type="hidden" name="id" value={slot.id} /> : null}

      <FormSection title="When" icon={Clock}>
        {courseId ? null : (
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

        <ChipGroup
          name="weekday"
          legend={slot ? "Day" : "Days"}
          type={slot ? "radio" : "checkbox"}
          compact
          options={WEEKDAYS.map((d) => ({
            value: String(d.value),
            label: d.short.slice(0, slot ? 3 : 1),
            title: d.label,
          }))}
          defaultValue={value("weekday").split(",")}
          hint={slot ? undefined : "Pick every day it meets at this time: each becomes its own class time."}
          error={errors.weekday}
          onChange={(days) => setLive((l) => ({ ...l, weekdays: days.map(Number) }))}
        />

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-4 sm:w-fit">
            <Field id="startTime" label="Starts" error={errors.startTime}>
              <Input
                ref={startRef}
                type="time"
                step={300}
                required
                {...field("startTime")}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field id="endTime" label="Ends" error={errors.endTime}>
              <Input
                ref={endRef}
                type="time"
                step={300}
                required
                {...field("endTime")}
                onChange={(e) => {
                  endTouched.current = true;
                  setLive((l) => ({ ...l, end: e.target.value }));
                }}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="sr-only">Common start times:</span>
            {startTimes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStart(t)}
                aria-pressed={live.start === t}
                aria-label={`Start at ${formatTime(t, timeFormat)}`}
                className={cn(
                  "h-9 rounded-full border border-border px-3 text-sm tabular-nums transition-colors hover:border-foreground/25",
                  live.start === t && "border-primary bg-accent text-accent-foreground",
                )}
              >
                {formatTime(t, timeFormat)}
              </button>
            ))}
            <span className="text-muted-foreground text-xs">
              {endTouched.current
                ? "The end keeps the class length."
                : credits > 0
                  ? `Ends after ${suggestedDuration(credits)} min (${credits} SKS × 50).`
                  : "Ends after 100 min."}
            </span>
          </div>
        </div>

        <WeekPreview live={live} existing={existing} timeFormat={timeFormat} />
      </FormSection>

      <FormSection title="Where" icon={MapPin}>
        <Field id="location" label="Room" optional error={errors.location} hint={locationHint}>
          <Input
            placeholder={defaultLocation ? `e.g. ${defaultLocation}` : "e.g. B2.04"}
            {...field("location", locationHint)}
          />
        </Field>
      </FormSection>

      <MoreDetails hint="Online link, and a date range if it doesn't run all semester" open={moreOpen}>
        <FormSection title="Online" icon={Video}>
          <label className="flex min-h-11 items-center gap-2 font-medium text-sm">
            <input
              type="checkbox"
              name="online"
              defaultChecked={value("online") === "on"}
              className="size-4 accent-(--primary)"
            />
            Online class
          </label>
          <Field
            id="meetingUrl"
            label="Meeting link"
            optional
            error={errors.meetingUrl}
            hint="Zoom, Meet or Teams. Shows an “Open link” button when the class is on."
          >
            <Input
              type="url"
              inputMode="url"
              placeholder="https://meet.google.com/…"
              {...field("meetingUrl", "hint")}
            />
          </Field>
        </FormSection>
        <FormSection title="Date range" icon={CalendarRange} description="Leave blank if it runs all semester.">
          <div className="grid grid-cols-2 gap-4">
            <Field id="startsOn" label="First class" optional error={errors.startsOn}>
              <Input type="date" {...field("startsOn")} />
            </Field>
            <Field id="endsOn" label="Last class" optional error={errors.endsOn}>
              <Input type="date" {...field("endsOn")} />
            </Field>
          </div>
        </FormSection>
      </MoreDetails>

      <FormFooter error={state && !state.ok && !state.fieldErrors ? state.error : null}>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : slot
              ? "Save changes"
              : live.weekdays.length > 1
                ? `Add ${live.weekdays.length} class times`
                : "Add class time"}
        </Button>
        <CancelButton href={returnTo ?? (courseId ? `/courses/${courseId}` : "/courses")} />
      </FormFooter>
    </form>
  );
}

/**
 * A mini week: the days picked, how full each already is, and where this class
 * lands, with an overlap warning before saving (overlaps are allowed).
 */
function WeekPreview({
  live,
  existing,
  timeFormat,
}: {
  live: { weekdays: number[]; start: string; end: string; startsOn: string; endsOn: string };
  existing: ExistingSlot[];
  timeFormat: "24h" | "12h";
}) {
  const valid = /^\d{2}:\d{2}$/.test(live.start) && /^\d{2}:\d{2}$/.test(live.end) && live.end > live.start;
  const probe = (weekday: number) => ({
    id: "new",
    weekday,
    startTime: live.start,
    endTime: live.end,
    startsOn: live.startsOn || null,
    endsOn: live.endsOn || null,
  });
  const clashes = valid ? existing.filter((e) => live.weekdays.some((d) => slotsConflict(probe(d), e))) : [];
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => {
          const picked = live.weekdays.includes(d.value);
          const day = existing.filter((e) => e.weekday === d.value);
          return (
            <div
              key={d.value}
              className={cn(
                "flex min-h-16 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-[0.6875rem] transition-colors",
                picked ? "bg-accent ring-1 ring-primary" : "bg-muted/60",
              )}
            >
              <span className={cn("font-medium", picked ? "text-accent-foreground" : "text-muted-foreground")}>
                {d.short}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {day.slice(0, 4).map((e) => (
                  <span
                    key={e.id}
                    className="size-1.5 rounded-full bg-(--c)"
                    style={{ "--c": e.color } as React.CSSProperties}
                  />
                ))}
              </span>
              {picked && valid ? (
                <span className="mt-auto rounded bg-primary px-1 text-primary-foreground tabular-nums">
                  {formatTime(live.start, timeFormat).replace(/ ?[AP]M$/, "")}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {clashes.length > 0 ? (
        <p className="flex items-start gap-1.5 text-sm text-warning" role="status">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Overlaps with{" "}
            {clashes
              .map(
                (c) =>
                  `${c.title} (${WEEKDAYS[c.weekday - 1].short} ${formatTime(c.startTime, timeFormat)}–${formatTime(c.endTime, timeFormat)})`,
              )
              .join(", ")}
            . You can still save it.
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground text-xs" role="status">
          {live.weekdays.length === 0 ? "Pick at least one day." : valid ? "No overlaps." : "Set a start and an end."}
        </p>
      )}
    </div>
  );
}
