"use client";

import { CalendarClock, CircleSlash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { cancelOccurrence, undoChange } from "../actions";
import { RescheduleDialog, type RescheduleTarget } from "./reschedule-dialog";

/**
 * Rescheduled / Cancelled for one class, next to its attendance buttons: the
 * lecturer moved it or called it off. Neither logs a meeting, so the count
 * stays right. Both offer Undo in the toast and refresh the page, so the class
 * shows its new state everywhere (moved, waiting for a date, or struck through).
 */
export function ChangeQuick({
  target,
  compact = false,
  size = "sm",
  disabled = false,
}: {
  target: RescheduleTarget;
  /** Icon only on small screens (day lists). */
  compact?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const withUndo = (message: string, undo: () => Promise<unknown>) => {
    toast({
      message,
      action: {
        label: t("Undo"),
        onClick: async () => {
          await undo();
          router.refresh();
        },
      },
    });
    router.refresh();
  };

  const cancel = () =>
    start(async () => {
      const result = await cancelOccurrence({ key: target.key });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      withUndo(t("Cancelled: {name}. Your meeting count stays the same.", { name: target.name }), () =>
        undoChange({ key: target.key, previous: result.data.previous }),
      );
    });

  const chip = cn(
    "inline-flex shrink-0 items-center gap-1 rounded-pill border border-border bg-surface-1 font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground disabled:opacity-60",
    size === "md" ? "h-10 gap-1.5 px-3.5 text-sm [&_svg]:size-4" : "h-9 px-2.5 text-xs [&_svg]:size-3.5",
  );
  const text = (label: string) => <span className={compact ? "sr-only sm:not-sr-only" : undefined}>{label}</span>;
  const name = `${target.name}, ${target.when}`;

  return (
    <>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
        className={chip}
        aria-label={compact ? t("Rescheduled: {name}", { name }) : undefined}
      >
        <CalendarClock aria-hidden />
        {text(t("Rescheduled"))}
      </button>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={cancel}
        className={chip}
        aria-label={compact ? t("Cancelled: {name}", { name }) : undefined}
      >
        <CircleSlash aria-hidden />
        {text(t("Cancelled"))}
      </button>
      {open ? (
        <RescheduleDialog
          target={target}
          onClose={() => setOpen(false)}
          onDone={(outcome) =>
            withUndo(outcome.message, () => undoChange({ key: target.key, previous: outcome.previous }))
          }
        />
      ) : null}
    </>
  );
}
