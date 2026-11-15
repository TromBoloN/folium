import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/queries";
import { CourseTabs } from "@/features/courses/components/course-tabs";
import { listActiveSlots } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { WeekView } from "@/features/timetable/components/week-view";
import { buildWeek } from "@/features/timetable/week";
import { isCivilDate, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Timetable" };

export default function TimetablePage({ searchParams }: PageProps<"/courses/timetable">) {
  return (
    <>
      <PageHeader title="Courses" description="Your week at a glance." />
      <CourseTabs />
      <Suspense
        fallback={
          <div
            data-wide
            role="status"
            aria-label="Loading timetable"
            className="h-96 animate-pulse rounded-lg bg-muted"
          />
        }
      >
        <Timetable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Timetable({ searchParams }: Pick<PageProps<"/courses/timetable">, "searchParams">) {
  await requireUser();
  const [{ week: weekParam }, slots, { preferences }] = await Promise.all([
    searchParams,
    listActiveSlots(),
    getSettings(),
  ]);
  await io(); // "today" must be taken per request, not baked into a prerender
  const today = todayIn(preferences.timeZone);
  const anchor = isCivilDate(weekParam) ? weekParam : today;
  const week = buildWeek(slots, {
    anchor,
    today,
    weekStart: preferences.weekStart,
    timeFormat: preferences.timeFormat,
  });
  // The day agenda (mobile) opens on the day that was linked (e.g. from the week strip), else today.
  const todayIndex = Math.max(
    0,
    week.days.findIndex((d) => d.date === anchor),
  );

  return (
    <WeekView week={week} timeFormat={preferences.timeFormat} hasAnySlots={slots.length > 0} todayIndex={todayIndex} />
  );
}
