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
import { SemesterSwitch } from "@/features/courses/components/semester-switch";
import { listCourses } from "@/features/courses/queries";
import { semesterLabels } from "@/features/courses/schema";
import { ByDayView } from "@/features/schedule/components/by-day-view";
import { ViewSwitch } from "@/features/schedule/components/view-switch";
import { WeekRail } from "@/features/schedule/components/week-rail";
import { WeekToolbar } from "@/features/schedule/components/week-toolbar";
import { nextLabel, occurrenceChips } from "@/features/schedule/format";
import { skipsLeft } from "@/features/schedule/meetings";
import { buildSchedule, changesByCourse, nextOccurrence } from "@/features/schedule/occurrences";
import { getMeetingLog, getScheduleInput, listAttendanceMarks, listUpcomingBreaks } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { COURSES_VIEWS, type CoursesView, type Preferences } from "@/features/settings/schema";
import { WeekView } from "@/features/timetable/components/week-view";
import { buildWeek, weekRange } from "@/features/timetable/week";
import { addDays, type CivilDate, isCivilDate, minutesNowIn, todayIn } from "@/lib/dates";
import { Tr } from "@/lib/i18n/client";
import { getI18n, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Courses") };
}

export default function CoursesPage({ searchParams }: PageProps<"/courses">) {
  return (
    <>
      <PageHeader
        title="Courses"
        action={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/courses/rollover">
                <CalendarRange aria-hidden />
                <Tr k="New semester" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/courses/new">
                <Plus aria-hidden />
                <Tr k="Add course" />
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
            <Link href="/courses/new">
              <Tr k="Add your first course" />
            </Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (view === "cards") {
    // Semester: ?semester=, else the one most active courses are in.
    const semesters = semesterLabels(courses);
    const fallback = semesterLabels(courses.filter((c) => !c.archivedAt))[0] ?? "all";
    const wanted = typeof params.semester === "string" ? params.semester : fallback;
    const semester = wanted === "all" || semesters.includes(wanted) ? wanted : fallback;
    const shown = semester === "all" ? courses : courses.filter((c) => c.semester === semester);
    const stats = await cardStats(today, nowMinute, preferences);
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {switcher}
          {semesters.length > 0 ? <SemesterSwitch semesters={semesters} current={semester} /> : null}
        </div>
        {shown.length > 0 ? (
          <CourseList courses={shown} stats={stats} />
        ) : (
          <p className="text-muted-foreground text-sm">
            <Tr k="No courses in {semester}." vars={{ semester }} />
          </p>
        )}
      </div>
    );
  }

  const anchor = weekParam ?? today;
  const range = weekRange(anchor, preferences.weekStart);
  const [input, marks] = await Promise.all([getScheduleInput(range.from, range.to), listAttendanceMarks()]);
  const week = buildWeek(input, {
    marks,
    anchor,
    today,
    weekStart: preferences.weekStart,
    timeFormat: preferences.timeFormat,
    nowMinute,
    i18n: await getI18n(),
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
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-8">
          <ByDayView week={week} />
          <WeekRail week={week} breaks={await listUpcomingBreaks(today)} />
        </div>
      ) : (
        <WeekView week={week} timeFormat={preferences.timeFormat} hasAnySlots={hasAnySlots} todayIndex={openIndex} />
      )}
    </div>
  );
}

/** Next class, meeting progress and this week's changes for every course card. */
async function cardStats(
  today: CivilDate,
  nowMinute: number,
  preferences: Preferences,
): Promise<Record<string, CourseCardStats>> {
  const i18n = await getI18n();
  const thisWeek = weekRange(today, preferences.weekStart);
  const range = { from: thisWeek.from, to: addDays(today, 13) };
  const [input, courses, log] = await Promise.all([
    getScheduleInput(range.from, range.to),
    listCourses(),
    getMeetingLog(),
  ]);
  const schedule = buildSchedule(input, range);
  const changes = changesByCourse(schedule.filter((o) => o.date <= thisWeek.to));
  const now = { date: today, minute: nowMinute };
  const stats: Record<string, CourseCardStats> = {};
  for (const course of courses) {
    const next = nextOccurrence(schedule, now, course.id);
    const progress = log.progress.get(course.id) ?? null;
    stats[course.id] = {
      next: next
        ? {
            label: nextLabel(next, now, preferences.timeFormat, i18n),
            location: next.location,
            chips: occurrenceChips(next, preferences.timeFormat, i18n),
          }
        : null,
      changesThisWeek: changes.get(course.id) ?? 0,
      meeting: progress ? { next: progress.next, total: progress.total, finished: progress.finished } : null,
      skipsLeft: progress && course.kind === "campus" ? skipsLeft(progress, preferences.attendanceTarget) : null,
    };
  }
  return stats;
}
