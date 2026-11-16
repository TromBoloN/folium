"use client";

import { CalendarClock } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { useI18n } from "@/lib/i18n/client";
import { type ChangeRow, cancelOccurrence, postponeOccurrence, updateOccurrence } from "../actions";

export type RescheduleTarget = {
  key: string;
  name: string;
  /** "Today 01:00": the class being rescheduled. */
  when: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  /** Weekly classes can wait for a date; an extra session can only be moved or cancelled. */
  canWait: boolean;
};

export type RescheduleOutcome = {
  kind: "moved" | "postponed" | "cancelled";
  previous: ChangeRow | null;
  message: string;
};

/**
 * "When is it rescheduled to?" A small modal: the agreed date and time, or
 * "Not decided yet" (the class waits in a list until a date is set). `waiting`
 * opens it for a class that's already waiting: set the date, or it's cancelled.
 */
export function RescheduleDialog({
  target,
  waiting = false,
  onClose,
  onDone,
}: {
  target: RescheduleTarget;
  waiting?: boolean;
  onClose: () => void;
  onDone: (outcome: RescheduleOutcome) => void;
}) {
  const { t, tl } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [date, setDate] = useState(waiting ? "" : target.date);
  const [startTime, setStartTime] = useState(target.startTime);
  const [endTime, setEndTime] = useState(target.endTime);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const run = (
    kind: RescheduleOutcome["kind"],
    call: () => Promise<ActionResult<{ previous: ChangeRow | null }>>,
    message: string,
  ) => {
    setError(null);
    start(async () => {
      const result = await call();
      if (!result.ok) {
        setError(tl(result.fieldErrors ? (Object.values(result.fieldErrors)[0] ?? result.error) : result.error));
        return;
      }
      onDone({ kind, previous: result.data.previous, message });
      ref.current?.close();
    });
  };

  const save = () => {
    if (!date) {
      setError(t("Pick the new date, or choose “Not decided yet”."));
      return;
    }
    run(
      "moved",
      () =>
        updateOccurrence({
          key: target.key,
          date,
          startTime,
          endTime,
          location: target.location ?? "",
          note: "",
          scope: "once",
        }),
      t("Rescheduled: {name}", { name: target.name }),
    );
  };

  const id = `reschedule-${target.key.replace(/[^a-z0-9]/gi, "")}`;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the backdrop; Escape (native) and Close cover keyboards.
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-tile border border-border-soft bg-popover p-0 text-popover-foreground shadow-raised backdrop:bg-foreground/35"
    >
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="flex items-center gap-2 font-display font-medium text-lg">
            <CalendarClock aria-hidden className="size-5 text-warning" />
            {waiting ? t("Set the new date") : t("Rescheduled to when?")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {target.name}, {waiting ? t("was {when}", { when: target.when }) : target.when}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5 sm:col-span-3">
            <Label htmlFor={`${id}-date`}>{t("New date")}</Label>
            <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-start`}>{t("Starts")}</Label>
            <Input id={`${id}-start`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-end`}>{t("Ends")}</Label>
            <Input id={`${id}-end`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? t("Saving…") : t("Save new date")}
          </Button>
          {waiting ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  "cancelled",
                  () => cancelOccurrence({ key: target.key }),
                  t("Cancelled: {name}", { name: target.name }),
                )
              }
            >
              {t("It's cancelled")}
            </Button>
          ) : target.canWait ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  "postponed",
                  () => postponeOccurrence(target.key),
                  t("Waiting for a new date: {name}", { name: target.name }),
                )
              }
            >
              {t("Not decided yet")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" disabled={pending} onClick={() => ref.current?.close()}>
            {t("Close")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
