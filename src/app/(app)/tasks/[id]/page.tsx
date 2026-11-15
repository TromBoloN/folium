import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ListSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { getSettings } from "@/features/settings/queries";
import { DueLabel } from "@/features/tasks/components/due-label";
import { SubtaskList } from "@/features/tasks/components/subtask-list";
import { TaskActions } from "@/features/tasks/components/task-actions";
import { dueState, formatDue } from "@/features/tasks/due";
import { getTask } from "@/features/tasks/queries";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/features/tasks/schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Task" };

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <>
      <div className="mb-4">
        <BackLink href="/tasks">Tasks</BackLink>
      </div>
      <Suspense fallback={<ListSkeleton label="Loading task" />}>
        <TaskDetail params={params} />
      </Suspense>
    </>
  );
}

async function TaskDetail({ params }: Pick<PageProps<"/tasks/[id]">, "params">) {
  await requireUser();
  const { id } = await params;
  const [task, { preferences }] = await Promise.all([getTask(id), getSettings()]);
  if (!task) notFound();
  await io();
  const now = new Date();
  const done = task.status === "done";
  const due = formatDue(task, now, preferences.timeZone, preferences.timeFormat);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className={cn("font-semibold text-2xl tracking-tight", done && "text-muted-foreground line-through")}>
          {task.title}
        </h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd>{STATUS_LABELS[task.status]}</dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd>{due ? <DueLabel label={due} state={dueState(task, now, preferences.timeZone)} /> : "No deadline"}</dd>
          <dt className="text-muted-foreground">Priority</dt>
          <dd>{PRIORITY_LABELS[task.priority]}</dd>
          {task.course ? (
            <>
              <dt className="text-muted-foreground">Course</dt>
              <dd>
                <Link
                  href={`/courses/${task.course.id}`}
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                  style={{ "--course": task.course.color } as React.CSSProperties}
                >
                  <span aria-hidden className="size-2 rounded-full bg-(--course)" />
                  {task.course.name}
                </Link>
              </dd>
            </>
          ) : null}
        </dl>
        <TaskActions task={task} />
      </header>

      {task.notes ? (
        <section aria-labelledby="notes" className="flex flex-col gap-2">
          <h2 id="notes" className="font-medium">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.notes}</p>
        </section>
      ) : null}

      <SubtaskList taskId={task.id} subtasks={task.subtasks} />
    </div>
  );
}
