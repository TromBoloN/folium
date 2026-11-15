"use client";

import {
  CalendarArrowUp,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  ExternalLink,
  Flag,
  MoreHorizontal,
  Pencil,
  Sun,
  Sunrise,
  Tag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { todayIn } from "@/lib/dates";
import { PRIORITIES, PRIORITY_LABELS, type TaskPriority } from "../schema";
import { useClientData } from "./client-data-store";
import { useTaskOps } from "./task-ops";

export type MenuTask = {
  id: string;
  title: string;
  priority: TaskPriority;
  courseId: string | null;
  dueAt: string | null;
};

/** The "⋯" menu on a task row: reschedule, priority, course, rename, open, delete. Every change can be undone. */
export function TaskMenu({ task, onRename }: { task: MenuTask; onRename: () => void }) {
  const ops = useTaskOps();
  const [picking, setPicking] = useState(false);
  const data = useClientData();
  const courses = data?.courses.filter((c) => !c.archived || c.id === task.courseId) ?? [];
  const courseName = (id: string | null) => {
    const c = courses.find((x) => x.id === id);
    return c ? (c.code ?? c.name) : "no course";
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground"
            aria-label={`Actions for “${task.title}”`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-muted-foreground text-xs">Reschedule</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => ops.patch({ id: task.id, reschedule: "today" }, `Moved to today: ${task.title}`)}
          >
            <Sun aria-hidden /> Today
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => ops.patch({ id: task.id, reschedule: "tomorrow" }, `Moved to tomorrow: ${task.title}`)}
          >
            <Sunrise aria-hidden /> Tomorrow
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => ops.patch({ id: task.id, reschedule: "next-week" }, `Moved to next week: ${task.title}`)}
          >
            <CalendarArrowUp aria-hidden /> Next week
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPicking(true)}>
            <CalendarDays aria-hidden /> Pick a date…
          </DropdownMenuItem>
          {task.dueAt ? (
            <DropdownMenuItem
              onSelect={() => ops.patch({ id: task.id, dueDate: null }, `Deadline removed: ${task.title}`)}
            >
              <CalendarOff aria-hidden /> Remove date
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Flag aria-hidden /> Priority
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={task.priority}
                onValueChange={(value) =>
                  ops.patch(
                    { id: task.id, priority: value as TaskPriority },
                    `Priority ${PRIORITY_LABELS[value as TaskPriority].toLowerCase()}: ${task.title}`,
                  )
                }
              >
                {PRIORITIES.map((p) => (
                  <DropdownMenuRadioItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {courses.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag aria-hidden /> Course
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                <DropdownMenuRadioGroup
                  value={task.courseId ?? ""}
                  onValueChange={(value) =>
                    ops.patch({ id: task.id, courseId: value || null }, `Course set to ${courseName(value || null)}`)
                  }
                >
                  <DropdownMenuRadioItem value="">No course</DropdownMenuRadioItem>
                  {courses.map((c) => (
                    <DropdownMenuRadioItem key={c.id} value={c.id}>
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full bg-(--tint)"
                        style={{ "--tint": c.color } as React.CSSProperties}
                      />
                      {c.code ?? c.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuItem onSelect={onRename}>
            <Pencil aria-hidden /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/tasks/${task.id}`}>
              <ExternalLink aria-hidden /> Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => ops.remove(task)}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {picking ? <DatePicker task={task} onClose={() => setPicking(false)} /> : null}
    </>
  );
}

/** A small native dialog with a date field. Keeps the time of day when it can (see movedDue). */
function DatePicker({ task, onClose }: { task: MenuTask; onClose: () => void }) {
  const ops = useTaskOps();
  const ref = useRef<HTMLDialogElement>(null);
  const zone = useClientData()?.timeZone ?? "UTC";
  const initial = todayIn(zone, task.dueAt ? new Date(task.dueAt) : new Date());
  return (
    <dialog
      ref={(el) => {
        ref.current = el;
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      aria-labelledby={`pick-${task.id}`}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-tile border border-border-soft bg-popover p-5 text-popover-foreground shadow-raised backdrop:bg-foreground/30"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          const date = new FormData(event.currentTarget).get("date");
          if (typeof date === "string" && date) ops.patch({ id: task.id, dueDate: date }, `Moved: ${task.title}`);
        }}
      >
        <h2 id={`pick-${task.id}`} className="flex items-center gap-2 font-medium">
          <CalendarPlus aria-hidden className="size-4" /> New date for “{task.title}”
        </h2>
        <Input type="date" name="date" defaultValue={initial} aria-label="Date" required autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button type="submit">Move</Button>
        </div>
      </form>
    </dialog>
  );
}
