import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { getCourse } from "@/features/courses/queries";
import { SlotForm } from "@/features/timetable/components/slot-form";
import { slotFormContext } from "@/features/timetable/components/slot-screens";

export const metadata: Metadata = { title: "Edit class time" };

export default function EditSlotPage({ params }: PageProps<"/courses/[id]/slots/[slotId]/edit">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <EditSlot params={params} />
      </Suspense>
    </div>
  );
}

async function EditSlot({ params }: Pick<PageProps<"/courses/[id]/slots/[slotId]/edit">, "params">) {
  await requireUser();
  const { id, slotId } = await params;
  const [course, context] = await Promise.all([getCourse(id), slotFormContext(slotId)]);
  const slot = course?.slots.find((s) => s.id === slotId);
  if (!course || !slot) notFound();
  return (
    <>
      <PageHeader title="Edit class time" back={<BackLink href={`/courses/${course.id}`}>{course.name}</BackLink>} />
      <SlotForm courseId={course.id} credits={course.credits} slot={slot} defaultLocation={course.room} {...context} />
    </>
  );
}
