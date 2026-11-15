import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { TaskForm } from "@/features/tasks/components/task-form";
import { dueParts } from "@/features/tasks/due";
import { getTask } from "@/features/tasks/queries";

export const metadata: Metadata = { title: "Edit task" };

export default function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditTask params={params} />
    </Suspense>
  );
}

async function EditTask({ params }: Pick<PageProps<"/tasks/[id]/edit">, "params">) {
  await requireUser();
  const { id } = await params;
  const [task, courses, { preferences }] = await Promise.all([getTask(id), listCourseOptions(), getSettings()]);
  if (!task) notFound();
  const due = task.dueAt ? dueParts(task.dueAt, task.dueHasTime, preferences.timeZone) : null;
  return (
    <>
      <PageHeader title="Edit task" back={<BackLink href={`/tasks/${task.id}`}>{task.title}</BackLink>} />
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
