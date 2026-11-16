"use client";

import { CalendarClock, CircleSlash } from "lucide-react";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { cancelOccurrence, setAttendance, undoChange } from "@/features/schedule/actions";
import { AttendanceQuick } from "@/features/schedule/components/attendance-quick";
import {
  RescheduleDialog,
  type RescheduleOutcome,
  type RescheduleTarget,
} from "@/features/schedule/components/reschedule-dialog";
import { useT } from "@/lib/i18n/client";

type Item = RescheduleTarget & { color: string };

const chip =
  "inline-flex h-9 items-center gap-1 rounded-pill border border-border bg-surface-1 px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:border-foreground/25 hover:text-foreground disabled:opacity-60";

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full bg-(--c)"
      style={{ "--c": color } as React.CSSProperties}
    />
  );
}

/**
 * One row per class that's over: Attended, Missed, Rescheduled or Cancelled.
 * A row leaves once answered, with Undo in the toast. Classes rescheduled
 * without a date wait below until a date is set or they're cancelled.
 */
export function AttendancePromptList({ items, waiting }: { items: Item[]; waiting: Item[] }) {
  const [done, setDone] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{ item: Item; waiting: boolean } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const t = useT();
  const left = items.filter((i) => !done.includes(i.key));
  const stillWaiting = waiting.filter((i) => !done.includes(i.key));

  const finished = (key: string, message: string, undo: () => Promise<unknown>) => {
    setDone((d) => [...d, key]);
    toast({
      message,
      action: {
        label: t("Undo"),
        onClick: async () => {
          await undo();
          setDone((d) => d.filter((k) => k !== key));
        },
      },
    });
  };

  const cancel = (i: Item) =>
    start(async () => {
      const result = await cancelOccurrence({ key: i.key });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      finished(i.key, t("Cancelled: {name}", { name: i.name }), () =>
        undoChange({ key: i.key, previous: result.data.previous }),
      );
    });

  const onRescheduled = (i: Item, outcome: RescheduleOutcome) => {
    const undo = () => undoChange({ key: i.key, previous: outcome.previous });
    // "Not decided yet": the refreshed page moves it into the waiting list, so don't hide it here.
    if (outcome.kind === "postponed") {
      toast({ message: outcome.message, action: { label: t("Undo"), onClick: async () => void (await undo()) } });
      return;
    }
    finished(i.key, outcome.message, undo);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {left.length === 0 && items.length > 0 ? (
        <p className="text-muted-foreground text-sm sm:pt-2">{t("All marked. Thanks!")}</p>
      ) : null}
      {left.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border-soft">
          {left.map((i) => (
            <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Dot color={i.color} />
                <span className="truncate font-medium">{i.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{i.when}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <AttendanceQuick
                  occurrenceKey={i.key}
                  initial={null}
                  label={`${i.name}, ${i.when}`}
                  onMarked={(status) => {
                    if (!status) return;
                    finished(
                      i.key,
                      t(status === "attended" ? "Attended: {name}" : "Missed: {name}", { name: i.name }),
                      () => setAttendance({ key: i.key, status: null }),
                    );
                  }}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setDialog({ item: i, waiting: false })}
                  className={chip}
                  aria-label={t("Rescheduled: {name}", { name: `${i.name}, ${i.when}` })}
                >
                  <CalendarClock aria-hidden className="size-3.5" />
                  {t("Rescheduled")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => cancel(i)}
                  className={chip}
                  aria-label={t("Cancelled: {name}", { name: `${i.name}, ${i.when}` })}
                >
                  <CircleSlash aria-hidden className="size-3.5" />
                  {t("Cancelled")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {stillWaiting.length > 0 ? (
        <section aria-labelledby="waiting-h" className="flex flex-col gap-1">
          <h3 id="waiting-h" className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
            <CalendarClock aria-hidden className="size-3.5 text-warning" />
            {t("Waiting for a new date")}
          </h3>
          <ul className="flex flex-col divide-y divide-border-soft">
            {stillWaiting.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <Dot color={i.color} />
                  <span className="truncate font-medium">{i.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {t("was {when}", { when: i.when })}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setDialog({ item: i, waiting: true })}
                    className={chip}
                    aria-label={t("Set the new date: {name}", { name: i.name })}
                  >
                    <CalendarClock aria-hidden className="size-3.5" />
                    {t("Set date")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => cancel(i)}
                    className={chip}
                    aria-label={t("It's cancelled: {name}", { name: i.name })}
                  >
                    <CircleSlash aria-hidden className="size-3.5" />
                    {t("Cancelled")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dialog ? (
        <RescheduleDialog
          target={dialog.item}
          waiting={dialog.waiting}
          onClose={() => setDialog(null)}
          onDone={(outcome) => onRescheduled(dialog.item, outcome)}
        />
      ) : null}
    </div>
  );
}
