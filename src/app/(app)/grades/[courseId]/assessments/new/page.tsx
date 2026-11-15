import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { AssessmentForm } from "@/features/grades/components/assessment-form";
import { getCourseGradebook } from "@/features/grades/queries";

export const metadata: Metadata = { title: "Add assessment" };

export default function NewAssessmentPage({ params }: PageProps<"/grades/[courseId]/assessments/new">) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewAssessment params={params} />
    </Suspense>
  );
}

async function NewAssessment({ params }: Pick<PageProps<"/grades/[courseId]/assessments/new">, "params">) {
  await requireUser();
  const { courseId } = await params;
  const course = await getCourseGradebook(courseId);
  if (!course) notFound();
  return (
    <>
      <PageHeader title="Add assessment" back={<BackLink href={`/grades/${course.id}`}>{course.name}</BackLink>} />
      <AssessmentForm
        courseId={course.id}
        defaults={{ name: "", weight: "", maxScore: "100", score: "", dueDate: "" }}
      />
    </>
  );
}
