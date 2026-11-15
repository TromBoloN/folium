import { Archive, CalendarPlus, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { CourseActions } from "@/features/courses/components/course-actions";
import { getCourse, listActiveSlots } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { SlotList } from "@/features/timetable/components/slot-list";
import { findConflicts } from "@/features/timetable/logic";
import type { TimetableSlot } from "@/features/timetable/types";

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
  const details = [
    ["Code", course.code],
    ["Lecturer", course.lecturer],
    ["Room", course.room],
    ["Semester", course.semester],
  ].filter((d): d is [string, string] => Boolean(d[1]));

  return (
    <div className="flex flex-col gap-8" style={{ "--course": course.color } as React.CSSProperties}>
      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-2 size-4 shrink-0 rounded-full bg-(--course)" />
          <h1 className="font-semibold text-2xl tracking-tight">{course.name}</h1>
        </div>
        {course.archivedAt ? (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
            <Archive aria-hidden className="size-4" />
            Archived. Its class times are hidden from your timetable.
          </p>
        ) : null}
        {details.length > 0 ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <CourseActions course={course} />
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
  );
}
