import { Archive, CalendarPlus, Clock, Mail, MessageCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { CourseActions } from "@/features/courses/components/course-actions";
import { type CourseWithSlots, getCourse, listActiveSlots } from "@/features/courses/queries";
import { mailtoLink, whatsappLink } from "@/features/courses/schema";
import { attendanceStats } from "@/features/schedule/attendance";
import { AttendancePanel } from "@/features/schedule/components/attendance-panel";
import { OccurrenceRow } from "@/features/schedule/components/occurrence-row";
import { placementLabel, toRowItem } from "@/features/schedule/format";
import { buildSchedule, isListed, isLive, isPast } from "@/features/schedule/occurrences";
import { getScheduleInput, listAttendanceMarks } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import type { Preferences } from "@/features/settings/schema";
import { SlotList } from "@/features/timetable/components/slot-list";
import { findConflicts } from "@/features/timetable/logic";
import type { TimetableSlot } from "@/features/timetable/types";
import { addDays, formatDate, minutesNowIn, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Course" };

export default function CoursePage({ params }: PageProps<"/courses/[id]">) {
  return (
    <>
      <div className="mb-4">
        <BackLink href="/courses">Courses</BackLink>
      </div>
      <Suspense fallback={<ListSkeleton label="Loading course" />}>
        <CourseDetail params={params} />
      </Suspense>
    </>
  );
}

async function CourseDetail({ params }: Pick<PageProps<"/courses/[id]">, "params">) {
  await requireUser();
  const { id } = await params;
  const [course, activeSlots, { preferences }] = await Promise.all([getCourse(id), listActiveSlots(), getSettings()]);
  if (!course) notFound();

  // Archived courses aren't in the timetable, so they can't clash with anything.
  const conflicts = course.archivedAt ? new Map<string, TimetableSlot[]>() : findConflicts(activeSlots);
  // Only well-formed contacts become links (rows can be written outside the app's forms).
  const whatsapp = whatsappLink(course.lecturerPhone);
  const mailto = mailtoLink(course.lecturerEmail);
  const details = [
    ["Lecturer", course.lecturer],
    ["Room", course.room],
    ["Semester", course.semester],
    ["Credits", course.credits > 0 ? `${course.credits} SKS` : null],
  ].filter((d): d is [string, string] => Boolean(d[1]));

  return (
    <div
      className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start xl:gap-10"
      style={{ "--course": course.color, "--tint": course.color } as React.CSSProperties}
    >
      <div className="flex flex-col gap-6">
        <header className="tile tile-tinted flex flex-col gap-4 overflow-hidden p-5">
          <span
            aria-hidden
            className="leaf-veins pointer-events-none absolute -right-8 -bottom-10 size-52 opacity-15"
          />
          <div className="relative flex flex-col gap-1">
            {course.code ? <span className="font-medium text-muted-foreground text-sm">{course.code}</span> : null}
            <h1 className="font-display font-medium text-3xl leading-tight tracking-tight">{course.name}</h1>
          </div>
          {course.archivedAt ? (
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
              <Archive aria-hidden className="size-4" />
              Archived. Its class times are hidden from your timetable.
            </p>
          ) : null}
          {details.length > 0 ? (
            <dl className="relative grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {whatsapp || mailto ? (
            <div className="relative flex flex-wrap gap-2">
              {whatsapp ? (
                <Button asChild size="sm" variant="outline">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden />
                    WhatsApp
                  </a>
                </Button>
              ) : null}
              {mailto ? (
                <Button asChild size="sm" variant="outline">
                  <a href={mailto}>
                    <Mail aria-hidden />
                    Email
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="relative">
            <CourseActions course={course} />
          </div>
        </header>
        <section className="flex flex-col gap-3" aria-labelledby="class-times">
          <div className="flex items-center justify-between gap-3">
            <h2 id="class-times" className="font-medium">
              Class times
            </h2>
            {course.slots.length > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/courses/${course.id}/slots/new`}>
                  <CalendarPlus aria-hidden />
                  Add class time
                </Link>
              </Button>
            ) : null}
          </div>
          {course.slots.length === 0 ? (
            <EmptyState icon={Clock} title="No class times yet" description="Add when this course meets each week.">
              <Button asChild size="sm">
                <Link href={`/courses/${course.id}/slots/new`}>Add class time</Link>
              </Button>
            </EmptyState>
          ) : (
            <SlotList
              slots={course.slots}
              conflicts={conflicts}
              courseRoom={course.room}
              timeFormat={preferences.timeFormat}
            />
          )}
        </section>
      </div>

      <div className="flex flex-col gap-8">
        {course.archivedAt ? null : <CourseSchedule course={course} preferences={preferences} />}
      </div>
    </div>
  );
}

/** Coming up (with this course's changes) and attendance over the term. */
async function CourseSchedule({ course, preferences }: { course: CourseWithSlots; preferences: Preferences }) {
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const clock = { date: today, minute: minutesNowIn(preferences.timeZone, now) };
  // The term: from the first class time's start (at most ~6 months back) to the last one's end, if every slot has one.
  const starts = course.slots.map((s) => s.startsOn).filter((d): d is string => d !== null);
  const ends = course.slots.map((s) => s.endsOn);
  const termKnown = course.slots.length > 0 && ends.every((d) => d !== null);
  const earliest = addDays(today, -180);
  const from =
    starts.length === course.slots.length && starts.length > 0 ? [...starts].sort()[0] : addDays(today, -120);
  const termEnd = termKnown ? ([...ends].sort().at(-1) as string) : today;
  // "YYYY-MM-DD" strings sort as dates.
  const range = { from: [from, earliest].sort()[1], to: [termEnd, addDays(today, 21)].sort()[1] };

  const [input, marks] = await Promise.all([getScheduleInput(range.from, range.to), listAttendanceMarks(course.id)]);
  const mine = buildSchedule(input, range).filter((o) => o.courseId === course.id);
  const upcoming = mine.filter((o) => isListed(o) && !isPast(o, clock) && o.date <= addDays(today, 21)).slice(0, 6);
  const term = mine.filter((o) => o.date <= termEnd);
  const stats = attendanceStats(term, marks, clock, preferences.attendanceTarget, termKnown);
  const recent = term
    .filter((o) => isLive(o) && isPast(o, clock))
    .slice(-5)
    .reverse()
    .map((o) => ({
      key: o.key,
      label: `${formatDate(o.date, { weekday: "short", day: "numeric", month: "short" })} · ${placementLabel(o, preferences.timeFormat, o.date)}`,
      status: marks.get(o.key) ?? null,
    }));

  return (
    <>
      <section className="flex flex-col gap-3" aria-labelledby="coming-up">
        <div className="flex items-center justify-between gap-3">
          <h2 id="coming-up" className="font-medium">
            Coming up
          </h2>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/courses/extra/new?course=${course.id}&date=${today}`}>
              <Sparkles aria-hidden />
              Extra session
            </Link>
          </Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No classes in the next three weeks.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {upcoming.map((o) => (
              <li key={o.key}>
                <OccurrenceRow item={toRowItem(o, preferences.timeFormat, clock)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {stats.held > 0 || stats.missed > 0 ? (
        <AttendancePanel courseId={course.id} stats={stats} target={preferences.attendanceTarget} recent={recent} />
      ) : null}
    </>
  );
}
