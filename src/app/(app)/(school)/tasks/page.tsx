import { ListChecks, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { requireUser } from "@/features/auth/queries";
import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskFilters } from "@/features/tasks/components/task-filters";
import { TaskList } from "@/features/tasks/components/task-list";
import { dueSummary } from "@/features/tasks/due";
import { listOpenTasks, listTasks } from "@/features/tasks/queries";
import { taskFiltersSchema } from "@/features/tasks/schema";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Tasks") };
}

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
              <Tr k="New task" />
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
  const [params, { preferences }, courses, t] = await Promise.all([
    searchParams,
    getSettings(),
    listCourseOptions(),
    getT(),
  ]);
  const filters = taskFiltersSchema.parse(params);
  await io(); // "now" must be read per request
  const now = new Date();
  const [tasks, open] = await Promise.all([
    listTasks(filters, { now, timeZone: preferences.timeZone, weekStart: preferences.weekStart }),
    listOpenTasks(),
  ]);
  const summary = dueSummary(open, now, preferences.timeZone, preferences.weekStart);
  const course = courses.find((c) => c.id === filters.course);
  const filtered = filters.status !== "open" || filters.due !== "any" || filters.course;

  return (
    // Wide screens: the list on the left, summary and filters in a rail on the right.
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-8">
      <aside
        aria-label={t("Summary and filters")}
        className="flex flex-col gap-5 xl:sticky xl:top-8 xl:col-start-2 xl:row-span-2 xl:row-start-1"
      >
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Overdue" value={summary.overdue} href="/tasks?due=overdue" tone="danger" reveal={0} />
          <StatTile label="Due today" value={summary.today} href="/tasks?due=today" tone="warning" reveal={1} />
          <StatTile label="This week" value={summary.week} href="/tasks?due=week" reveal={2} />
        </div>
        <TaskFilters current={filters} courses={courses} />
      </aside>
      <div className="xl:col-start-1 xl:row-start-1">
        <QuickAdd courseId={course?.id} courseName={course?.name} />
      </div>
      <div className="min-w-0 xl:col-start-1 xl:row-start-2">
        {tasks.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title="Nothing here" description="No tasks match these filters.">
              <Button asChild size="sm" variant="outline">
                <Link href="/tasks">{t("Show all open tasks")}</Link>
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
    </div>
  );
}
