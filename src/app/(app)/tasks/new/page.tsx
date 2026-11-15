import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { TaskForm } from "@/features/tasks/components/task-form";

export const metadata: Metadata = { title: "New task" };

export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <>
      <PageHeader title="New task" back={<BackLink href="/tasks">Tasks</BackLink>} />
      <Suspense fallback={<FormSkeleton />}>
        <NewTask searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewTask({ searchParams }: Pick<PageProps<"/tasks/new">, "searchParams">) {
  await requireUser();
  const [{ course }, courses, { preferences }] = await Promise.all([searchParams, listCourseOptions(), getSettings()]);
  const preset = courses.find((c) => c.id === course && !c.archived)?.id ?? "";
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
