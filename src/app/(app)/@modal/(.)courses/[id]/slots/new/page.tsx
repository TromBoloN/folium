import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewSlotForCourseScreen } from "@/features/timetable/components/slot-screens";

export default function NewSlotSheet({ params }: PageProps<"/courses/[id]/slots/new">) {
  return (
    <Sheet title="Add class time">
      <Suspense fallback={<FormSkeleton />}>
        <New params={params} />
      </Suspense>
    </Sheet>
  );
}

async function New({ params }: Pick<PageProps<"/courses/[id]/slots/new">, "params">) {
  const { id } = await params;
  return <NewSlotForCourseScreen courseId={id} variant="sheet" />;
}
