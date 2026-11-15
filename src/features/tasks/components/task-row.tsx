import { Flag } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { CourseStripe } from "@/components/ui/course-stripe";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import type { DueState } from "../due";
import type { Task } from "../queries";
import { PRIORITY_LABELS } from "../schema";
import { DueLabel } from "./due-label";
import { TaskCheckbox } from "./task-checkbox";

type Props = { task: Task; dueLabel: string | null; dueState: DueState };

/**
 * One task: course stripe on the left, a checkbox ringed in the course colour,
 * the title, and one line of meta (course chip, due pill, priority only when high/urgent, steps progress). When it's checked off and the list re-renders
 * without it, the row collapses out and the rows below slide up (View
 * Transitions; browsers without them just drop the row).
 */
export function TaskRow({ task, dueLabel, dueState }: Props) {
  const done = task.status === "done";
  const stepsDone = task.subtasks.filter((s) => s.done).length;
  const steps = task.subtasks.length;
  return (
    <ViewTransition exit="task-out" update="task-row" default="none">
      <li
        className={cn(
          "relative flex items-start gap-1.5 py-2 pr-3 pl-2.5 transition-opacity duration-(--dur-base) sm:pl-3.5",
          // While the checkbox's form is saving, the row steps back.
          "has-[[data-pending]]:opacity-55",
        )}
      >
        {task.course ? <CourseStripe color={task.course.color} /> : null}
        <TaskCheckbox id={task.id} title={task.title} done={done} color={task.course?.color} />
        <Link
          href={`/tasks/${task.id}`}
          className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md py-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span
            className={cn(
              "font-medium text-[0.9375rem] leading-snug sm:text-base",
              done && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
            {task.course ? (
              <Pill tone="course" tint={task.course.color}>
                {task.course.code ?? task.course.name}
              </Pill>
            ) : null}
            {done ? null : <DueLabel label={dueLabel} state={dueState} />}
            {task.priority === "high" || task.priority === "urgent" ? (
              <Pill tone={task.priority === "urgent" ? "danger" : "neutral"}>
                <Flag aria-hidden />
                {PRIORITY_LABELS[task.priority]}
              </Pill>
            ) : null}
            {steps > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-1 tabular-nums">
                <span aria-hidden className="h-1.5 w-8 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full w-full origin-left rounded-full bg-(--tint) transition-transform duration-(--dur-base)"
                    style={
                      {
                        "--tint": task.course?.color ?? "var(--primary)",
                        transform: `scaleX(${stepsDone / steps})`,
                      } as React.CSSProperties
                    }
                  />
                </span>
                {stepsDone}/{steps}
                <span className="sr-only"> steps done</span>
              </span>
            ) : null}
          </span>
        </Link>
      </li>
    </ViewTransition>
  );
}
