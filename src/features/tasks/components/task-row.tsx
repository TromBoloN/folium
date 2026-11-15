import { Flag, ListChecks } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DueState } from "../due";
import type { Task } from "../queries";
import { PRIORITY_LABELS, STATUS_LABELS } from "../schema";
import { DueLabel } from "./due-label";
import { TaskCheckbox } from "./task-checkbox";

type Props = { task: Task; dueLabel: string | null; dueState: DueState };

export function TaskRow({ task, dueLabel, dueState }: Props) {
  const done = task.status === "done";
  const stepsDone = task.subtasks.filter((s) => s.done).length;
  return (
    <li className="flex items-start gap-2 px-2 py-2.5 sm:px-3">
      <TaskCheckbox id={task.id} title={task.title} done={done} />
      <Link href={`/tasks/${task.id}`} className="flex min-w-0 flex-1 flex-col gap-1 py-1">
        <span className={cn("font-medium leading-snug", done && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
          {task.course ? (
            <span
              className="inline-flex items-center gap-1.5"
              style={{ "--course": task.course.color } as React.CSSProperties}
            >
              <span aria-hidden className="size-2 rounded-full bg-(--course)" />
              {task.course.code ?? task.course.name}
            </span>
          ) : null}
          {done ? null : <DueLabel label={dueLabel} state={dueState} />}
          {task.priority === "high" || task.priority === "urgent" ? (
            <span className={cn("inline-flex items-center gap-1", task.priority === "urgent" && "text-destructive")}>
              <Flag aria-hidden className="size-3.5" />
              {PRIORITY_LABELS[task.priority]}
            </span>
          ) : null}
          {task.status === "in_progress" ? (
            <span className="rounded-sm bg-accent px-1.5 py-0.5 text-accent-foreground">
              {STATUS_LABELS.in_progress}
            </span>
          ) : null}
          {task.subtasks.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ListChecks aria-hidden className="size-3.5" />
              {stepsDone}/{task.subtasks.length}
              <span className="sr-only"> steps done</span>
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
