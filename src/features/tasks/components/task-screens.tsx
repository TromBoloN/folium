import { io } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/queries";
import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { getI18n } from "@/lib/i18n/server";
import { dueParts, dueState, formatDue } from "../due";
import { getTask } from "../queries";
import { PRIORITY_LABELS, STATUS_LABELS } from "../schema";
import { DueLabel } from "./due-label";
import { EditableTitle } from "./editable-title";
import { SubtaskList } from "./subtask-list";
import { TaskDetailActions } from "./task-detail-actions";
import { TaskForm } from "./task-form";

/**
 * Task screens shared by the full pages and the sheets (intercepted routes).
 * `variant="page"` adds the page header; a sheet has its own title bar.
 */
type Variant = { variant: "page" | "sheet" };

export async function NewTaskScreen({ courseId }: { courseId?: string }) {
  await requireUser();
  const [courses, { preferences }] = await Promise.all([listCourseOptions(), getSettings()]);
  const preset = courses.find((c) => c.id === courseId && !c.archived)?.id ?? "";
  return (
    <TaskForm
      courses={courses}
      timeZone={preferences.timeZone}
      defaults={{
        title: "",
        notes: "",
        courseId: preset,
        dueDate: "",
        dueTime: "",
        priority: "medium",
        status: "todo",
      }}
    />
  );
}

export async function EditTaskScreen({ id, variant }: { id: string } & Variant) {
  await requireUser();
  const [task, courses, { preferences }] = await Promise.all([getTask(id), listCourseOptions(), getSettings()]);
  if (!task) notFound();
  const due = task.dueAt ? dueParts(task.dueAt, task.dueHasTime, preferences.timeZone) : null;
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Edit task" back={<BackLink href={`/tasks/${task.id}`}>{task.title}</BackLink>} />
      ) : null}
      <TaskForm
        id={task.id}
        courses={courses}
        timeZone={preferences.timeZone}
        defaults={{
          title: task.title,
          notes: task.notes ?? "",
          courseId: task.courseId ?? "",
          dueDate: due?.date ?? "",
          dueTime: due?.time ?? "",
          priority: task.priority,
          status: task.status,
        }}
      />
    </>
  );
}

export async function TaskDetailScreen({ id }: { id: string }) {
  await requireUser();
  const [task, { preferences }] = await Promise.all([getTask(id), getSettings()]);
  if (!task) notFound();
  await io();
  const now = new Date();
  const done = task.status === "done";
  const i18n = await getI18n();
  const { t } = i18n;
  const due = formatDue(task, now, preferences.timeZone, preferences.timeFormat, i18n);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <EditableTitle id={task.id} title={task.title} done={done} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("Status")}</dt>
          <dd>{t(STATUS_LABELS[task.status])}</dd>
          <dt className="text-muted-foreground">{t("Due")}</dt>
          <dd>{due ? <DueLabel label={due} state={dueState(task, now, preferences.timeZone)} /> : t("No deadline")}</dd>
          <dt className="text-muted-foreground">{t("Priority")}</dt>
          <dd>{t(PRIORITY_LABELS[task.priority])}</dd>
          {task.course ? (
            <>
              <dt className="text-muted-foreground">{t("Course")}</dt>
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
        <TaskDetailActions task={{ id: task.id, title: task.title, status: task.status }} />
      </header>

      {task.notes ? (
        <section aria-labelledby="notes" className="flex flex-col gap-2">
          <h2 id="notes" className="font-medium">
            {t("Notes")}
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.notes}</p>
        </section>
      ) : null}

      <SubtaskList taskId={task.id} subtasks={task.subtasks} />
    </div>
  );
}
