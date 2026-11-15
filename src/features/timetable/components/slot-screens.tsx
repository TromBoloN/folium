import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { getCourse, listActiveSlots, listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { commonStartTimes } from "../logic";
import { type ExistingSlot, SlotForm } from "./slot-form";

/** What the slot form needs from the rest of the timetable: other class times and the usual start times. */
export async function slotFormContext(excludeId?: string) {
  const [slots, { preferences }] = await Promise.all([listActiveSlots(), getSettings()]);
  const existing: ExistingSlot[] = slots
    .filter((s) => s.id !== excludeId)
    .map((s) => ({
      id: s.id,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      startsOn: s.startsOn,
      endsOn: s.endsOn,
      title: s.course.code ?? s.course.name,
      color: s.course.color,
    }));
  return { existing, startTimes: commonStartTimes(slots), timeFormat: preferences.timeFormat };
}

type Variant = { variant: "page" | "sheet" };

/** Add a class time to a known course (from the course page). */
export async function NewSlotForCourseScreen({ courseId, variant }: { courseId: string } & Variant) {
  await requireUser();
  const [course, context] = await Promise.all([getCourse(courseId), slotFormContext()]);
  if (!course) notFound();
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Add class time" back={<BackLink href={`/courses/${course.id}`}>{course.name}</BackLink>} />
      ) : (
        <p className="mb-4 text-muted-foreground text-sm">For {course.name}</p>
      )}
      <SlotForm courseId={course.id} credits={course.credits} defaultLocation={course.room} {...context} />
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
  const [options, context] = await Promise.all([listCourseOptions(), slotFormContext()]);
  const courses = options.filter((c) => !c.archived);
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
          }}
          returnTo={returnTo}
          {...context}
        />
      )}
    </>
  );
}
