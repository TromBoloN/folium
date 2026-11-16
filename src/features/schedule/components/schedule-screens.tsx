import { io } from "next/cache";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { addDays, isCivilDate, todayIn } from "@/lib/dates";
import { Tr } from "@/lib/i18n/client";
import { BreakForm } from "./break-form";
import { ExtraSessionForm } from "./extra-form";

type Variant = { variant: "page" | "sheet" };

async function today() {
  const { preferences } = await getSettings();
  await io();
  return todayIn(preferences.timeZone);
}

export async function NewExtraSessionScreen({
  date,
  courseId,
  variant,
}: { date?: string; courseId?: string } & Variant) {
  await requireUser();
  const courses = (await listCourseOptions()).filter((c) => !c.archived);
  const day = date && isCivilDate(date) ? date : await today();
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Extra session" back={<BackLink href={`/courses?view=day&week=${day}`}>Schedule</BackLink>} />
      ) : (
        <p className="mb-4 text-muted-foreground text-sm">
          <Tr k="A makeup class, an exam or a review: one date, outside the weekly timetable." />
        </p>
      )}
      {courses.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">
            <Tr k="Add a course first." />
          </p>
          <Button asChild size="sm">
            <Link href="/courses/new">
              <Tr k="Add a course" />
            </Link>
          </Button>
        </div>
      ) : (
        <ExtraSessionForm
          courses={courses}
          prefill={{ date: day, courseId: courses.some((c) => c.id === courseId) ? courseId : undefined }}
        />
      )}
    </>
  );
}

export async function NewBreakScreen({ from, variant }: { from?: string } & Variant) {
  await requireUser();
  const start = from && isCivilDate(from) ? from : await today();
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Add a break" back={<BackLink href={`/courses?view=day&week=${start}`}>Schedule</BackLink>} />
      ) : (
        <p className="mb-4 text-muted-foreground text-sm">
          <Tr k="Holidays and exam weeks: no regular classes for a few days." />
        </p>
      )}
      <BreakForm prefill={{ startsOn: start, endsOn: addDays(start, 4) }} />
    </>
  );
}
