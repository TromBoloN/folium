import { Flag } from "lucide-react";
import Link from "next/link";
import { CourseStripe } from "@/components/ui/course-stripe";
import { Pill } from "@/components/ui/pill";
import { readableTextOn } from "@/lib/color";
import { Tr } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { DueState } from "../due";
import type { Task } from "../queries";
import { PRIORITY_LABELS } from "../schema";
import { DueLabel } from "./due-label";
import { TaskCheckbox } from "./task-checkbox";
import { TaskRowFrame } from "./task-row-frame";

type Props = { task: Task; dueLabel: string | null; dueState: DueState; urgent?: boolean };

/**
 * One task: course stripe on the left, a checkbox ringed in the course colour,
 * the title, and one line of meta (course chip, due pill, priority only when
 * high/urgent, steps progress). The interactive parts (checkbox, menu, swipe,
 * rename, quick reschedule) live in TaskRowFrame.
 */
export function TaskRow({ task, dueLabel, dueState, urgent }: Props) {
  const done = task.status === "done";
  const stepsDone = task.subtasks.filter((s) => s.done).length;
  const steps = task.subtasks.length;
  const color = task.course?.color;
  const checkStyle = (
    color
      ? { "--tint": color, "--check": readableTextOn(color) }
      : { "--tint": "var(--primary)", "--check": "var(--primary-foreground)" }
  ) as React.CSSProperties;

  return (
    <TaskRowFrame
      task={{
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        courseId: task.courseId,
        dueAt: task.dueAt,
      }}
      overdue={dueState === "overdue"}
      stripe={color ? <CourseStripe color={color} /> : null}
      checkbox={<TaskCheckbox task={{ id: task.id, title: task.title, status: task.status }} style={checkStyle} />}
      content={
        <Link
          href={`/tasks/${task.id}`}
          className="flex min-w-0 flex-col gap-1.5 rounded-md py-2 focus-visible:outline-2 focus-visible:outline-ring"
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
            {done ? null : <DueLabel label={dueLabel} state={dueState} urgent={urgent} />}
            {task.priority === "high" || task.priority === "urgent" ? (
              <Pill tone={task.priority === "urgent" ? "danger" : "neutral"}>
                <Flag aria-hidden />
                <Tr k={PRIORITY_LABELS[task.priority]} />
              </Pill>
            ) : null}
            {steps > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-1 tabular-nums">
                <span aria-hidden className="h-1.5 w-8 overflow-hidden rounded-pill bg-muted">
                  <span
                    className="block h-full w-full origin-left rounded-pill bg-(--tint) transition-transform duration-(--dur-base)"
                    style={
                      {
                        "--tint": color ?? "var(--primary)",
                        transform: `scaleX(${stepsDone / steps})`,
                      } as React.CSSProperties
                    }
                  />
                </span>
                {stepsDone}/{steps}
                <span className="sr-only">
                  {" "}
                  <Tr k="steps done" />
                </span>
              </span>
            ) : null}
          </span>
        </Link>
      }
    />
  );
}
