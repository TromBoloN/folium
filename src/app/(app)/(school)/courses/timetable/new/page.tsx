import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { NewSlotScreen } from "@/features/timetable/components/slot-screens";

export const metadata: Metadata = { title: "Add class time" };

/** Add a class time from the timetable (any course). ?weekday=1-7&start=HH:MM prefill it. */
export default function NewTimetableSlotPage({ searchParams }: PageProps<"/courses/timetable/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function New({ searchParams }: Pick<PageProps<"/courses/timetable/new">, "searchParams">) {
  const { weekday, start, week } = await searchParams;
  return (
    <NewSlotScreen
      variant="page"
      weekday={Number(weekday) || undefined}
      start={typeof start === "string" ? start : undefined}
      returnTo={
        typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week)
          ? `/courses?view=week&week=${week}`
          : "/courses?view=week"
      }
    />
  );
}
