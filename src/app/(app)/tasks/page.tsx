import { ListChecks, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskFilters } from "@/features/tasks/components/task-filters";
import { TaskList } from "@/features/tasks/components/task-list";
import { listTasks } from "@/features/tasks/queries";
import { taskFiltersSchema } from "@/features/tasks/schema";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Assignments and deadlines, by course or due date."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/tasks/new">
              <Plus aria-hidden />
              New task
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton rows={4} label="Loading tasks" />}>
        <Tasks searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Tasks({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  await requireUser();
  const [params, { preferences }, courses] = await Promise.all([searchParams, getSettings(), listCourseOptions()]);
  const filters = taskFiltersSchema.parse(params);
  await io(); // "now" must be read per request
  const now = new Date();
  const tasks = await listTasks(filters, { now, timeZone: preferences.timeZone, weekStart: preferences.weekStart });
  const course = courses.find((c) => c.id === filters.course);
  const filtered = filters.status !== "open" || filters.due !== "any" || filters.course;

  return (
    <div className="flex flex-col gap-5">
      <QuickAdd courseId={course?.id} courseName={course?.name} />
      <TaskFilters current={filters} courses={courses} />
      {tasks.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX} title="Nothing here" description="No tasks match these filters.">
            <Button asChild size="sm" variant="outline">
              <Link href="/tasks">Show all open tasks</Link>
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No open tasks"
            description="Type a task above and press Enter. Add a due date and course later if you need them."
          />
        )
      ) : (
        <TaskList
          tasks={tasks}
          now={now}
          timeZone={preferences.timeZone}
          timeFormat={preferences.timeFormat}
          grouped={filters.status === "open"}
        />
      )}
    </div>
  );
}
