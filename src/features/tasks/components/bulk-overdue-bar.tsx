"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/core";
import { rescheduleOverdueTasks, rescheduleOverdueTasksForm, restoreTaskDueDates } from "../actions";

const chip =
  "inline-flex min-h-9 items-center gap-1 rounded-pill border border-border bg-surface-1 px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60";

/**
 * Bulk reschedule for overdue tasks: Tomorrow or Next week (never Today, which
 * just recreates the wall of chores). Real <form>s with hidden ids so it works
 * without JavaScript; with JS it runs in place and toasts with Undo.
 */
export function BulkOverdueBar({
  ids,
  onDone,
  onUndone,
}: {
  ids: string[];
  onDone?: () => void;
  onUndone?: () => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const { t, tl } = useI18n();

  if (ids.length === 0) return null;

  const move = (target: "tomorrow" | "next-week") =>
    start(async () => {
      const result = await rescheduleOverdueTasks({ target, ids });
      if (!result.ok) {
        toast({ message: tl(result.error), tone: "error" });
        return;
      }
      const { count, previous } = result.data;
      if (count === 0) {
        onDone?.();
        return;
      }
      onDone?.();
      const message =
        target === "tomorrow"
          ? t(plural(count, "Moved 1 task to tomorrow", "Moved {n} tasks to tomorrow"), { n: count })
          : t(plural(count, "Moved 1 task to next week", "Moved {n} tasks to next week"), { n: count });
      toast({
        message,
        duration: 8000,
        action: {
          label: t("Undo"),
          onClick: async () => {
            const undone = await restoreTaskDueDates(previous);
            if (!undone.ok) toast({ message: tl(undone.error), tone: "error" });
            else onUndone?.();
          },
        },
      });
    });

  const choices: { target: "tomorrow" | "next-week"; label: "Tomorrow" | "Next week"; aria: string }[] = [
    { target: "tomorrow", label: "Tomorrow", aria: t("Move waiting tasks to tomorrow") },
    { target: "next-week", label: "Next week", aria: t("Move waiting tasks to next week") },
  ];

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {choices.map((c) => (
        <form
          key={c.target}
          action={rescheduleOverdueTasksForm}
          onSubmit={(e) => {
            e.preventDefault();
            move(c.target);
          }}
          className="inline"
        >
          <input type="hidden" name="target" value={c.target} />
          {ids.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <button type="submit" disabled={pending} aria-label={c.aria} className={chip}>
            {t(c.label)}
          </button>
        </form>
      ))}
    </span>
  );
}
