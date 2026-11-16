"use client";

import { ArrowRightLeft, type Check, CircleSlash, MapPin, RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { useSheet } from "@/components/sheet";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { toMinutes } from "../../timetable/logic";
import {
  type ChangeRow,
  cancelOccurrence,
  restoreOccurrence,
  scheduleConflicts,
  undoChange,
  updateOccurrence,
} from "../actions";
import type { OccurrenceStatus } from "../occurrences";
import type { AttendanceStatus, Scope } from "../schema";
import { AttendanceQuick } from "./attendance-quick";

type Props = {
  occurrenceKey: string;
  status: OccurrenceStatus;
  weekly: boolean;
  changed: boolean;
  breakLabel: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  usualRoom: string | null;
  note: string | null;
  canMark: boolean;
  attendance: AttendanceStatus | null;
  backHref: string;
  /** "FIS101, Wed 07:30", for toasts. */
  label: string;
};

type Step = "menu" | "move" | "room";

const pad = (n: number) => String(n).padStart(2, "0");
function shift(time: string, minutes: number) {
  const total = Math.min(Math.max(toMinutes(time) + minutes, 0), 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** "Changed?" for one class: cancel (one tap), move, room only; restore; attendance. Everything can be undone. */
export function ClassActions(props: Props) {
  const [step, setStep] = useState<Step>("menu");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const sheet = useSheet();
  const router = useRouter();

  const done = (message: string, previous: ChangeRow | null | undefined, canUndo = true) => {
    toast({
      message,
      action: canUndo
        ? {
            label: "Undo",
            onClick: async () => void (await undoChange({ key: props.occurrenceKey, previous: previous ?? null })),
          }
        : undefined,
    });
    if (sheet) sheet.close({ refresh: true });
    else router.push(props.backHref);
  };

  const run = (work: () => Promise<void>) => {
    setError(null);
    start(work);
  };

  const cancel = () =>
    run(async () => {
      const result = await cancelOccurrence({ key: props.occurrenceKey });
      if (!result.ok) return setError(result.error);
      // An extra session is deleted: Undo puts the row back.
      done(`Cancelled ${props.label}`, result.data.previous);
    });

  const restore = () =>
    run(async () => {
      const result = await restoreOccurrence(props.occurrenceKey);
      if (!result.ok) return setError(result.error);
      done(`${props.label} is back to its usual time`, result.data.previous);
    });

  if (step === "move" || step === "room") {
    return (
      <ChangeForm
        {...props}
        mode={step}
        onBack={() => setStep("menu")}
        onSaved={(message, previous, scope) => done(message, previous, scope === "once")}
      />
    );
  }

  const cancelled = props.status === "cancelled";
  const extra = props.status === "extra";

  const changed = cancelled ? (
    <section className="flex flex-col gap-2">
      <p className="text-sm">
        {props.breakLabel && !props.changed
          ? `No class: it falls in “${props.breakLabel}”. Remove the break on the schedule to bring classes back.`
          : "This class is cancelled."}
      </p>
      {props.changed ? (
        <Button variant="outline" size="sm" className="w-fit" onClick={restore} disabled={pending}>
          <RotateCcw aria-hidden />
          It's on after all
        </Button>
      ) : null}
      {props.changed && !extra ? <NoteField {...props} /> : null}
    </section>
  ) : (
    <section aria-labelledby="changed-h" className="flex flex-col gap-2">
      <h3 id="changed-h" className="font-medium text-sm">
        {props.canMark ? "Something changed?" : "Changed?"}
      </h3>
      {props.status === "postponed" ? (
        <p className="text-sm">
          Rescheduled; the new date isn't decided yet. Choose <strong>Moved</strong> to set it, or{" "}
          <strong>Cancelled</strong> if it won't happen.
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <ChoiceButton icon={CircleSlash} tone="danger" onClick={cancel} disabled={pending}>
          {extra ? "Delete" : "Cancelled"}
        </ChoiceButton>
        <ChoiceButton icon={ArrowRightLeft} tone="warning" onClick={() => setStep("move")} disabled={pending}>
          Moved
        </ChoiceButton>
        <ChoiceButton icon={MapPin} onClick={() => setStep("room")} disabled={pending}>
          Room only
        </ChoiceButton>
      </div>
      {props.changed && props.weekly ? (
        <Button variant="ghost" size="sm" className="w-fit" onClick={restore} disabled={pending}>
          <RotateCcw aria-hidden />
          Back to the usual time and room
        </Button>
      ) : null}
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      {props.canMark ? (
        // Over: the useful question is whether you went. Changes are still possible, folded away.
        <>
          <section aria-labelledby="attendance-h" className="flex flex-col gap-2">
            <h3 id="attendance-h" className="font-medium text-sm">
              Did you attend?
            </h3>
            <AttendanceQuick occurrenceKey={props.occurrenceKey} initial={props.attendance} label={props.label} />
          </section>
          <details className="group rounded-xl border border-border-soft">
            <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-muted-foreground text-sm hover:bg-accent/50">
              Something changed? Cancelled, moved or another room
            </summary>
            <div className="px-4 pb-4">{changed}</div>
          </details>
        </>
      ) : (
        changed
      )}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceButton({
  icon: Icon,
  tone,
  children,
  ...rest
}: React.ComponentProps<"button"> & { icon: typeof Check; tone?: "danger" | "warning" }) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border border-border-soft bg-surface-1 px-2 py-3 font-medium text-sm transition-colors hover:bg-accent disabled:opacity-50",
        tone === "danger" && "hover:border-destructive/50",
        tone === "warning" && "hover:border-warning/60",
      )}
      {...rest}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-5",
          tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-muted-foreground",
        )}
      />
      {children}
    </button>
  );
}

/** A cancelled class's note ("Dr. Siti unwell"). Saved on blur or Enter. */
function NoteField({ occurrenceKey, note }: Props) {
  const [value, setValue] = useState(note ?? "");
  const [saved, setSaved] = useState(note ?? "");
  const [pending, start] = useTransition();
  const id = useId();
  const save = () => {
    if (value.trim() === saved.trim()) return;
    start(async () => {
      const result = await cancelOccurrence({ key: occurrenceKey, note: value });
      if (result.ok) setSaved(value);
    });
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Note (optional)</Label>
      <Input
        id={id}
        value={value}
        maxLength={200}
        placeholder="e.g. Lecturer unwell"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {pending ? "Saving…" : value.trim() !== saved.trim() ? "Press Enter to save" : saved ? "Saved" : ""}
      </p>
    </div>
  );
}

/** Moved (date, time, room) or Room only, with This week only / Every week from now on. */
function ChangeForm(
  props: Props & {
    mode: "move" | "room";
    onBack: () => void;
    onSaved: (message: string, previous: ChangeRow | null, scope: Scope) => void;
  },
) {
  const duration = toMinutes(props.endTime) - toMinutes(props.startTime);
  const [date, setDate] = useState(props.date);
  const [startTime, setStartTime] = useState(props.startTime);
  const [endTime, setEndTime] = useState(props.endTime);
  const [endEdited, setEndEdited] = useState(false);
  const [room, setRoom] = useState(props.location ?? "");
  const [scope, setScope] = useState<Scope>("once");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const ids = { date: useId(), start: useId(), end: useId(), room: useId() };
  const move = props.mode === "move";

  // Overlap warning, right in the sheet (debounced; stale answers are dropped).
  useEffect(() => {
    if (!move || !/^\d{4}-\d{2}-\d{2}$/.test(date) || endTime <= startTime) {
      setClashes([]);
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const result = await scheduleConflicts({ date, startTime, endTime, excludeKey: props.occurrenceKey });
      if (current && result.ok) setClashes(result.data);
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [move, date, startTime, endTime, props.occurrenceKey]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await updateOccurrence({
        key: props.occurrenceKey,
        date,
        startTime,
        endTime,
        location: room,
        note: props.note ?? "",
        scope,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(result.fieldErrors ? null : result.error);
        return;
      }
      const what = move ? "Moved" : "Room changed for";
      props.onSaved(
        scope === "forward" ? `Updated the weekly time for ${props.label.split(",")[0]}` : `${what} ${props.label}`,
        result.data.previous,
        scope,
      );
    });
  };

  const chip = (label: string, value: string) => (
    <button
      type="button"
      onClick={() => setDate(value)}
      aria-pressed={date === value}
      className={cn(
        "rounded-full border border-border-soft px-3 py-1 text-xs transition-colors",
        date === value ? "bg-foreground text-background" : "hover:bg-accent",
      )}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <h3 className="font-medium text-sm">{move ? "Moved to" : "Room for this class"}</h3>
      {move ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.date}>Date</Label>
            <Input
              id={ids.date}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={errors.date ? true : undefined}
              className="w-fit"
            />
            <div className="flex flex-wrap gap-1.5">
              {chip("Same day", props.date)}
              {chip("Day after", addDays(props.date, 1))}
              {chip("Next week", addDays(props.date, 7))}
            </div>
            {errors.date ? <p className="text-destructive text-xs">{errors.date}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-fit">
            <div className="grid gap-1.5">
              <Label htmlFor={ids.start}>Starts</Label>
              <Input
                id={ids.start}
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  // The end follows the class's length until it's set by hand.
                  if (!endEdited && /^\d{2}:\d{2}$/.test(e.target.value)) setEndTime(shift(e.target.value, duration));
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.end}>Ends</Label>
              <Input
                id={ids.end}
                type="time"
                value={endTime}
                aria-invalid={errors.endTime ? true : undefined}
                aria-describedby={errors.endTime ? `${ids.end}-error` : undefined}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setEndEdited(true);
                }}
              />
            </div>
          </div>
          {errors.endTime ? (
            <p id={`${ids.end}-error`} className="text-destructive text-xs">
              {errors.endTime}
            </p>
          ) : null}
          {clashes.length > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-warning" role="status">
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              Overlaps with {clashes.join(", ")}
            </p>
          ) : null}
        </>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={ids.room}>{move ? "Room (optional)" : "Room"}</Label>
        <Input
          id={ids.room}
          value={room}
          maxLength={80}
          placeholder={props.usualRoom ?? "B2.05"}
          onChange={(e) => setRoom(e.target.value)}
          autoFocus={!move}
          className="sm:w-64"
        />
        {props.usualRoom && room !== props.usualRoom ? (
          <p className="text-muted-foreground text-xs">Usually {props.usualRoom}</p>
        ) : null}
      </div>

      {props.weekly ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 font-medium text-sm">Applies to</legend>
          {(
            [
              ["once", "This week only"],
              ["forward", "Every week from now on"],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
                className="size-4 accent-(--primary)"
              />
              {text}
            </label>
          ))}
          {scope === "forward" ? (
            <p className="text-muted-foreground text-xs">
              Changes the weekly class time from this date. Earlier weeks stay as they were.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={props.onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}
