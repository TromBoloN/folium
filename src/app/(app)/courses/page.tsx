import { BookOpen, CalendarRange, Plus } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { type CourseCardStats, CourseList } from "@/features/courses/components/course-list";
import { listCourses } from "@/features/courses/queries";
import { courseResult, formatPercent } from "@/features/grades/logic";
import { listGradebook } from "@/features/grades/queries";
import { ByDayView } from "@/features/schedule/components/by-day-view";
import { ViewSwitch } from "@/features/schedule/components/view-switch";
import { WeekRail } from "@/features/schedule/components/week-rail";
import { WeekToolbar } from "@/features/schedule/components/week-toolbar";
import { nextLabel, occurrenceChips } from "@/features/schedule/format";
import { buildSchedule, changesByCourse, nextOccurrence } from "@/features/schedule/occurrences";
import { getScheduleInput, listUpcomingBreaks } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { COURSES_VIEWS, type CoursesView, type Preferences } from "@/features/settings/schema";
import { listOpenTasks } from "@/features/tasks/queries";
import { WeekView } from "@/features/timetable/components/week-view";
import { buildWeek, weekRange } from "@/features/timetable/week";
import { addDays, type CivilDate, isCivilDate, minutesNowIn, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage({ searchParams }: PageProps<"/courses">) {
  return (
    <>
      <PageHeader
        title="Courses"
        description="Your courses, and when they really meet."
        action={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/courses/rollover">
                <CalendarRange aria-hidden />
                New semester
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/courses/new">
                <Plus aria-hidden />
                Add course
              </Link>
            </Button>
          </div>
        }
      />
      <Suspense fallback={<ListSkeleton label="Loading courses" />}>
        <Courses searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const isView = (v: unknown): v is CoursesView => COURSES_VIEWS.includes(v as CoursesView);

async function Courses({ searchParams }: Pick<PageProps<"/courses">, "searchParams">) {
  await requireUser();
  const [params, { preferences }, courses] = await Promise.all([searchParams, getSettings(), listCourses()]);
  const view = isView(params.view) ? params.view : preferences.coursesView;
  const weekParam = typeof params.week === "string" && isCivilDate(params.week) ? params.week : undefined;
  await io(); // "today" is per request
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const nowMinute = minutesNowIn(preferences.timeZone, now);

  const switcher = <ViewSwitch current={view} week={weekParam} />;

  if (courses.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {switcher}
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Add your courses for this semester, then give each one its weekly class times."
        >
          <Button asChild size="sm">
            <Link href="/courses/new">Add your first course</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (view === "cards") {
    const stats = await cardStats(today, nowMinute, preferences);
    return (
      <div className="flex flex-col gap-5">
        {switcher}
        <CourseList courses={courses} stats={stats} />
      </div>
    );
  }

  const anchor = weekParam ?? today;
  const range = weekRange(anchor, preferences.weekStart);
  const input = await getScheduleInput(range.from, range.to);
  const week = buildWeek(input, {
    anchor,
    today,
    weekStart: preferences.weekStart,
    timeFormat: preferences.timeFormat,
    nowMinute,
  });
  const hasAnySlots = courses.some((c) => !c.archivedAt && c.slots.length > 0);
  // The day agenda (phones) opens on the linked day (e.g. from the week strip), else today.
  const openIndex = Math.max(
    0,
    week.days.findIndex((d) => d.date === anchor),
  );

  return (
    <div className="flex flex-col gap-5">
      {switcher}
      <WeekToolbar
        view={view}
        label={week.label}
        previous={week.previous}
        next={week.next}
        containsToday={week.containsToday}
        weekStart={week.days[0].date}
      />
      {view === "day" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-8">
          <ByDayView week={week} />
          <WeekRail week={week} breaks={await listUpcomingBreaks(today)} />
        </div>
      ) : (
        <WeekView week={week} timeFormat={preferences.timeFormat} hasAnySlots={hasAnySlots} todayIndex={openIndex} />
      )}
    </div>
  );
}

/** Next class, weekdays, open tasks, grade and this week's changes for every course card. */
async function cardStats(
  today: CivilDate,
  nowMinute: number,
  preferences: Preferences,
): Promise<Record<string, CourseCardStats>> {
  const thisWeek = weekRange(today, preferences.weekStart);
  const range = { from: thisWeek.from, to: addDays(today, 13) };
  const [input, tasks, gradebook, courses] = await Promise.all([
    getScheduleInput(range.from, range.to),
    listOpenTasks(),
    listGradebook(),
    listCourses(),
  ]);
  const schedule = buildSchedule(input, range);
  const changes = changesByCourse(schedule.filter((o) => o.date <= thisWeek.to));
  const now = { date: today, minute: nowMinute };
  const stats: Record<string, CourseCardStats> = {};
  for (const course of courses) {
    const next = nextOccurrence(schedule, now, course.id);
    const book = gradebook.find((g) => g.id === course.id);
    const result = book ? courseResult(book.assessments, preferences.gradeScale) : null;
    stats[course.id] = {
      next: next
        ? {
            label: nextLabel(next, now, preferences.timeFormat),
            location: next.location,
            chips: occurrenceChips(next, preferences.timeFormat),
          }
        : null,
      weekdays: [...new Set(course.slots.filter((s) => !s.endsOn || s.endsOn >= today).map((s) => s.weekday))],
      openTasks: tasks.filter((t) => t.courseId === course.id).length,
      grade:
        result?.percent != null && result.band
          ? { letter: result.band.letter, percent: `${formatPercent(result.percent)}%` }
          : null,
      changesThisWeek: changes.get(course.id) ?? 0,
    };
  }
  return stats;
}
