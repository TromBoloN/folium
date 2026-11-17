"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { setAttendance } from "../actions";
import type { AttendanceStatus } from "../schema";
import { ChangeQuick } from "./change-quick";
import type { RescheduleTarget } from "./reschedule-dialog";

/**
 * Attended / Missed for one class that took place. Tapping the chosen one again
 * clears it. Optimistic; reverts with a message if saving fails.
 */
export function AttendanceQuick({
  occurrenceKey,
  initial,
  label,
  compact = false,
  meeting = null,
  change,
  save,
  onMarked,
}: {
  /** The class it marks; unused when `save` is given. */
  occurrenceKey: string;
  initial: AttendanceStatus | null;
  /** "Calculus I, Mon 07:30": the buttons' accessible names. */
  label: string;
  compact?: boolean;
  /** The meeting number to log (shown on the button that logs it). */
  meeting?: number | null;
  /** Also offer Rescheduled / Cancelled while the class is unmarked (day lists). */
  change?: RescheduleTarget;
  /** Saves the mark another way (a meeting known only by its number). Null clears it. */
  save?: (status: AttendanceStatus | null) => Promise<ActionResult>;
  onMarked?: (status: AttendanceStatus | null, previous: AttendanceStatus | null) => void;
}) {
  const [status, setStatus] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const t = useT();
  const set = (next: AttendanceStatus) => {
    const value = status === next ? null : next;
    const before = status;
    setStatus(value);
    start(async () => {
      const result = save ? await save(value) : await setAttendance({ key: occurrenceKey, status: value, meeting });
      if (!result.ok) {
        setStatus(before);
        toast({ message: result.error, tone: "error" });
        return;
      }
      onMarked?.(value, before);
    });
  };
  return (
    <fieldset className="flex shrink-0 flex-wrap justify-end gap-1">
      <legend className="sr-only">{t("Attendance: {label}", { label })}</legend>
      {(
        [
          ["attended", t("Attended"), Check],
          ["missed", t("Skipped"), X],
        ] as const
      ).map(([value, text, Icon]) => {
        const on = status === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            aria-label={compact ? `${text}: ${label}` : undefined}
            disabled={pending}
            onClick={() => set(value)}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-pill border px-2.5 font-medium text-xs transition-colors disabled:opacity-60",
              on
                ? value === "attended"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-destructive bg-destructive text-destructive-foreground"
                : "border-border bg-surface-1 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            <span className={compact ? "sr-only sm:not-sr-only" : undefined}>{text}</span>
          </button>
        );
      })}
      {change && status === null ? <ChangeQuick target={change} compact={compact} disabled={pending} /> : null}
    </fieldset>
  );
}
