import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewSlotScreen } from "@/features/timetable/components/slot-screens";

export default function NewTimetableSlotSheet({ searchParams }: PageProps<"/courses/timetable/new">) {
  return (
    <Sheet title="Add class time">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </Sheet>
  );
}

async function New({ searchParams }: Pick<PageProps<"/courses/timetable/new">, "searchParams">) {
  const { weekday, start } = await searchParams;
  return (
    <NewSlotScreen
      variant="sheet"
      weekday={Number(weekday) || undefined}
      start={typeof start === "string" ? start : undefined}
      returnTo="/courses/timetable"
    />
  );
}
