"use client";

import { Check, Sunrise } from "lucide-react";
import { useRef, useState, ViewTransition } from "react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "../schema";
import { type MenuTask, TaskMenu } from "./task-menu";
import { useTaskOps } from "./task-ops";

type Props = {
  task: MenuTask & { status: TaskStatus };
  overdue: boolean;
  checkbox: React.ReactNode;
  /** Title + meta, usually a link to the task (server-rendered). */
  content: React.ReactNode;
  stripe: React.ReactNode;
};

/** How far a row must be swiped (px) to act. */
const SWIPE = 88;

/**
 * The interactive shell of a task row. It hides the row the moment a change
 * starts (it collapses out via a view transition), offers one-tap "Today" /
 * "Tomorrow" on overdue tasks, renames in place, and on touch screens takes a
 * swipe right to complete and a swipe left to move to tomorrow. Every one of
 * these also exists as a button or menu item.
 */
export function TaskRowFrame({ task, overdue, checkbox, content, stripe }: Props) {
  const ops = useTaskOps();
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [dx, setDx] = useState(0);
  const swipe = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const swallowClick = useRef(false);

  if (ops.isHidden(task.id)) return null;

  const done = task.status === "done";
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || renaming) return;
    swipe.current = { x: e.clientX, y: e.clientY, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const x = e.clientX - s.x;
    const y = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(y) > 10) {
        swipe.current = null; // a scroll, not a swipe
        return;
      }
      if (Math.abs(x) < 12) return;
      s.active = true;
    }
    setDx(Math.max(-140, Math.min(140, x)));
  };
  const onPointerEnd = () => {
    const s = swipe.current;
    swipe.current = null;
    if (!s?.active) return;
    if (dx > SWIPE && !done) ops.setStatus(task, "done");
    else if (dx < -SWIPE)
      ops.patch({ id: task.id, reschedule: "tomorrow" }, t("Moved to tomorrow: {title}", { title: task.title }));
    setDx(0);
    // Swallow the click that follows the swipe, so it doesn't open the task.
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 0);
  };

  return (
    <ViewTransition exit="task-out" update="task-row" default="none">
      <li className="relative overflow-hidden">
        {/* What a swipe will do, revealed under the row. */}
        {dx !== 0 ? (
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 flex items-center px-5 font-medium text-sm",
              dx > 0 ? "justify-start bg-accent text-accent-foreground" : "justify-end bg-muted text-foreground",
            )}
          >
            {dx > 0 ? (
              <span className={cn("flex items-center gap-2", dx < SWIPE && "opacity-60")}>
                <Check className="size-4" /> {done ? t("Already done") : t("Done")}
              </span>
            ) : (
              <span className={cn("flex items-center gap-2", -dx < SWIPE && "opacity-60")}>
                {t("Tomorrow")} <Sunrise className="size-4" />
              </span>
            )}
          </div>
        ) : null}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={() => {
            swipe.current = null;
            setDx(0);
          }}
          onClickCapture={(e) => {
            if (swallowClick.current) e.preventDefault();
          }}
          className={cn(
            "relative flex touch-pan-y items-start gap-1.5 bg-card py-2 pr-2 pl-2.5 transition-opacity duration-(--dur-base) sm:pl-3.5",
            dx === 0 && "transition-transform duration-(--dur-base) ease-(--ease-out)",
            "has-[[data-pending]]:opacity-55",
          )}
          style={dx !== 0 ? { transform: `translateX(${dx}px)` } : undefined}
        >
          {stripe}
          {checkbox}
          <div className="flex min-w-0 flex-1 flex-col">
            {renaming ? <RenameField task={task} onDone={() => setRenaming(false)} /> : content}
            {overdue && !done && !renaming ? (
              <div className="flex gap-1.5 pb-2">
                <QuickMove label={t("Today")} task={task} choice="today" />
                <QuickMove label={t("Tomorrow")} task={task} choice="tomorrow" />
              </div>
            ) : null}
          </div>
          <TaskMenu task={task} onRename={() => setRenaming(true)} />
        </div>
      </li>
    </ViewTransition>
  );
}

function QuickMove({ label, task, choice }: { label: string; task: MenuTask; choice: "today" | "tomorrow" }) {
  const ops = useTaskOps();
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={t("Move “{title}” to {day}", { title: task.title, day: label.toLowerCase() })}
      onClick={() => {
        setBusy(true);
        ops
          .patch(
            { id: task.id, reschedule: choice },
            t("Moved to {day}: {title}", { day: label.toLowerCase(), title: task.title }),
          )
          .finally(() => setBusy(false));
      }}
      className="rounded-pill border border-border-soft bg-surface-1 px-2.5 py-1 font-medium text-xs transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function RenameField({ task, onDone }: { task: MenuTask; onDone: () => void }) {
  const ops = useTaskOps();
  const t = useT();
  const save = (value: string) => {
    const title = value.trim();
    onDone();
    if (title && title !== task.title) ops.patch({ id: task.id, title }, t("Renamed to “{title}”", { title }));
  };
  return (
    <div className="py-1.5">
      <Input
        defaultValue={task.title}
        aria-label={t("Rename “{title}”", { title: task.title })}
        autoFocus
        maxLength={200}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") save(e.currentTarget.value);
          if (e.key === "Escape") onDone();
        }}
        onBlur={(e) => save(e.currentTarget.value)}
      />
    </div>
  );
}
