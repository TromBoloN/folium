import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { getCourse, listCourseOptions } from "@/features/courses/queries";
import { toMinutes } from "../logic";
import { SlotForm } from "./slot-form";

type Variant = { variant: "page" | "sheet" };

/** "HH:MM" plus minutes, capped at 23:55. */
function plusMinutes(time: string, minutes: number) {
  const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 55);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Add a class time to a known course (from the course page). */
export async function NewSlotForCourseScreen({ courseId, variant }: { courseId: string } & Variant) {
  await requireUser();
  const course = await getCourse(courseId);
  if (!course) notFound();
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Add class time" back={<BackLink href={`/courses/${course.id}`}>{course.name}</BackLink>} />
      ) : (
        <p className="mb-4 text-muted-foreground text-sm">For {course.name}</p>
      )}
      <SlotForm courseId={course.id} defaultLocation={course.room} />
    </>
  );
}

/**
 * Add a class time from the timetable: pick the course here. `weekday`/`start`
 * come from the empty cell that was clicked; the class defaults to 100 minutes.
 */
export async function NewSlotScreen({
  weekday,
  start,
  returnTo,
  variant,
}: { weekday?: number; start?: string; returnTo: string } & Variant) {
  await requireUser();
  const courses = (await listCourseOptions()).filter((c) => !c.archived);
  const valid = start && /^([01]\d|2[0-3]):[0-5]\d$/.test(start) ? start : undefined;
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Add class time" back={<BackLink href="/courses?view=week">Timetable</BackLink>} />
      ) : null}
      {courses.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">Add a course first, then give it class times.</p>
          <Button asChild size="sm">
            <Link href="/courses/new">Add a course</Link>
          </Button>
        </div>
      ) : (
        <SlotForm
          courses={courses}
          prefill={{
            weekday: weekday && weekday >= 1 && weekday <= 7 ? weekday : undefined,
            startTime: valid,
            endTime: valid ? plusMinutes(valid, 100) : undefined,
          }}
          returnTo={returnTo}
        />
      )}
    </>
  );
}
