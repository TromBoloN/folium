"use client";

import { Check, CircleSlash, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";
import { cancelOccurrence, setAttendance, undoChange } from "../actions";
import type { MeetingInfo } from "../meetings";
import type { AttendanceStatus } from "../schema";

type Mark = { status: AttendanceStatus | "cancelled"; number: number | null };

const chip =
  "inline-flex h-10 items-center gap-1.5 rounded-pill border border-border bg-surface-1 px-3.5 font-medium text-sm transition-colors hover:border-foreground/25 disabled:opacity-60";

/** "Meeting 7 of 16", or "Meeting 5" when the course is open-ended. */
export function useMeetingLabel() {
  const t = useT();
  return (m: { number: number; total: number | null }) =>
    m.total === null ? t("Meeting {n}", { n: m.number }) : t("Meeting {n} of {total}", { n: m.number, total: m.total });
}

/**
 * Attended / Skipped / Cancelled for a class that's on now. Says which meeting
 * it logs, takes one answer per class (the buttons give way to the answer and
 * an Undo), and offers Undo in the toast too. Cancelled cancels the class in
 * the schedule, so it never takes a meeting number.
 */
export function MeetingQuick({
  occurrenceKey,
  name,
  meeting,
  initial,
}: {
  occurrenceKey: string;
  name: string;
  /** The meeting this class logs; null when the course isn't counting (shouldn't happen) or is over. */
  meeting: MeetingInfo | null;
  initial: { status: AttendanceStatus; number: number | null } | null;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const label = useMeetingLabel();
  const [mark, setMark] = useState<Mark | null>(initial);
  const [pending, start] = useTransition();
  const [undoCancel, setUndoCancel] = useState<null | (() => Promise<ActionResult>)>(null);

  const done = (next: Mark, message: string, undo: () => Promise<unknown>) => {
    setMark(next);
    toast({
      message,
      action: {
        label: t("Undo"),
        onClick: async () => {
          await undo();
          setMark(null);
          router.refresh();
        },
      },
    });
    router.refresh();
  };

  const attend = (status: AttendanceStatus) =>
    start(async () => {
      const result = await setAttendance({ key: occurrenceKey, status, meeting: meeting?.number ?? null });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      const number = result.data.number;
      const what = number === null ? name : `${name} · ${label({ number, total: meeting?.total ?? null })}`;
      done({ status, number }, t(status === "attended" ? "Attended: {name}" : "Skipped: {name}", { name: what }), () =>
        setAttendance({ key: occurrenceKey, status: null }),
      );
    });

  const cancel = () =>
    start(async () => {
      const result = await cancelOccurrence({ key: occurrenceKey });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      const undo = () => undoChange({ key: occurrenceKey, previous: result.data.previous });
      setUndoCancel(() => undo);
      done(
        { status: "cancelled", number: null },
        t("Cancelled: {name}. Your meeting count stays the same.", { name }),
        undo,
      );
    });

  const undo = () =>
    start(async () => {
      const result =
        mark?.status === "cancelled" && undoCancel
          ? await undoCancel()
          : await setAttendance({ key: occurrenceKey, status: null });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      setMark(null);
      router.refresh();
    });

  if (mark) {
    const text =
      mark.status === "cancelled"
        ? t("Cancelled · count unchanged")
        : mark.status === "attended"
          ? t("Attended")
          : t("Skipped");
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <span className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-(--tint) px-3.5 font-medium text-background">
          {mark.status === "attended" ? <Check aria-hidden className="size-4" /> : null}
          {mark.status === "missed" ? <X aria-hidden className="size-4" /> : null}
          {mark.status === "cancelled" ? <CircleSlash aria-hidden className="size-4" /> : null}
          {text}
          {mark.number !== null ? ` · ${label({ number: mark.number, total: meeting?.total ?? null })}` : null}
        </span>
        {/* An answer from an earlier visit can still be cleared; a cancellation is undone from the class sheet. */}
        {mark.status !== "cancelled" || undoCancel ? (
          <button type="button" disabled={pending} onClick={undo} className={chip}>
            <Undo2 aria-hidden className="size-4" />
            {t("Undo")}
          </button>
        ) : null}
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">
        {meeting ? t("Log {meeting}", { meeting: label(meeting) }) : t("Log this class")}
      </legend>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => attend("attended")}
          className={`${chip} border-transparent bg-foreground text-background hover:opacity-90`}
        >
          <Check aria-hidden className="size-4" />
          {t("Attend")}
        </button>
        <button type="button" disabled={pending} onClick={() => attend("missed")} className={chip}>
          <X aria-hidden className="size-4" />
          {t("Skip")}
        </button>
        <button type="button" disabled={pending} onClick={cancel} className={chip}>
          <CircleSlash aria-hidden className="size-4" />
          {t("Cancelled")}
        </button>
      </div>
    </fieldset>
  );
}
