import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { getCourse } from "@/features/courses/queries";
import { SlotForm } from "@/features/timetable/components/slot-form";

export const metadata: Metadata = { title: "Add class time" };

export default function NewSlotPage({ params }: PageProps<"/courses/[id]/slots/new">) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewSlot params={params} />
    </Suspense>
  );
}

async function NewSlot({ params }: Pick<PageProps<"/courses/[id]/slots/new">, "params">) {
  await requireUser();
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();
  return (
    <>
      <PageHeader title="Add class time" back={<BackLink href={`/courses/${course.id}`}>{course.name}</BackLink>} />
      <SlotForm courseId={course.id} defaultLocation={course.room} />
    </>
  );
}
