import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { NewSlotForCourseScreen } from "@/features/timetable/components/slot-screens";

export const metadata: Metadata = { title: "Add class time" };

export default function NewSlotPage({ params }: PageProps<"/courses/[id]/slots/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <New params={params} />
      </Suspense>
    </div>
  );
}

async function New({ params }: Pick<PageProps<"/courses/[id]/slots/new">, "params">) {
  const { id } = await params;
  return <NewSlotForCourseScreen courseId={id} variant="page" />;
}
