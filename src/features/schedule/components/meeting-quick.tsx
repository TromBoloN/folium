"use client";

import { Check, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { setAttendance } from "../actions";
import type { MeetingInfo } from "../meetings";
import type { AttendanceStatus } from "../schema";
import { ChangeQuick } from "./change-quick";
import type { RescheduleTarget } from "./reschedule-dialog";

type Mark = { status: AttendanceStatus; number: number | null };

const chip =
  "inline-flex h-10 items-center gap-1.5 rounded-pill border border-border bg-surface-1 px-3.5 font-medium text-foreground text-sm transition-colors hover:border-foreground/25 disabled:opacity-60";

/** "Meeting 7 of 16", or "Meeting 5" when the course is open-ended. */
export function useMeetingLabel() {
  const t = useT();
  return (m: { number: number; total: number | null }) =>
    m.total === null ? t("Meeting {n}", { n: m.number }) : t("Meeting {n} of {total}", { n: m.number, total: m.total });
}

/**
 * Attended / Skipped for a class that's on now, plus Rescheduled / Cancelled
 * (ChangeQuick) when the lecturer moves or drops it. Says which meeting it
 * logs, takes one answer per class (the buttons give way to the answer and an
 * Undo), and offers Undo in the toast too. A rescheduled or cancelled class
 * never takes a meeting number.
 */
export function MeetingQuick({
  target,
  meeting,
  initial,
}: {
  /** The class: key, name and placement (for the reschedule dialog). */
  target: RescheduleTarget;
  /** The meeting this class logs; null when the course is over. */
  meeting: MeetingInfo | null;
  initial: Mark | null;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const label = useMeetingLabel();
  const [mark, setMark] = useState<Mark | null>(initial);
  const [pending, start] = useTransition();
  const { key, name } = target;

  const attend = (status: AttendanceStatus) =>
    start(async () => {
      const result = await setAttendance({ key, status, meeting: meeting?.number ?? null });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      const number = result.data.number;
      const what = number === null ? name : `${name} · ${label({ number, total: meeting?.total ?? null })}`;
      setMark({ status, number });
      toast({
        message: t(status === "attended" ? "Attended: {name}" : "Skipped: {name}", { name: what }),
        action: {
          label: t("Undo"),
          onClick: async () => {
            await setAttendance({ key, status: null });
            setMark(null);
            router.refresh();
          },
        },
      });
      router.refresh();
    });

  const undo = () =>
    start(async () => {
      const result = await setAttendance({ key, status: null });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      setMark(null);
      router.refresh();
    });

  if (mark) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <span className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-foreground px-3.5 font-medium text-background">
          {mark.status === "attended" ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
          {mark.status === "attended" ? t("Attended") : t("Skipped")}
          {mark.number !== null ? ` · ${label({ number: mark.number, total: meeting?.total ?? null })}` : null}
        </span>
        <button type="button" disabled={pending} onClick={undo} className={chip}>
          <Undo2 aria-hidden className="size-4" />
          {t("Undo")}
        </button>
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
          // cn, not string joining: the base chip's background would otherwise win and leave the text unreadable.
          className={cn(
            chip,
            "border-foreground bg-foreground text-background hover:border-foreground hover:opacity-90",
          )}
        >
          <Check aria-hidden className="size-4" />
          {t("Attend")}
        </button>
        <button type="button" disabled={pending} onClick={() => attend("missed")} className={chip}>
          <X aria-hidden className="size-4" />
          {t("Skip")}
        </button>
        <ChangeQuick target={target} size="md" disabled={pending} />
      </div>
    </fieldset>
  );
}
