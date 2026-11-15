import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { AssessmentForm } from "@/features/grades/components/assessment-form";
import { getCourseGradebook } from "@/features/grades/queries";
import { getSettings } from "@/features/settings/queries";
import { dueParts } from "@/features/tasks/due";

export const metadata: Metadata = { title: "Edit assessment" };

type Props = PageProps<"/grades/[courseId]/assessments/[assessmentId]/edit">;

export default function EditAssessmentPage({ params }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditAssessment params={params} />
    </Suspense>
  );
}

async function EditAssessment({ params }: Pick<Props, "params">) {
  await requireUser();
  const [{ courseId, assessmentId }, { preferences }] = await Promise.all([params, getSettings()]);
  const course = await getCourseGradebook(courseId);
  const assessment = course?.assessments.find((a) => a.id === assessmentId);
  if (!course || !assessment) notFound();
  return (
    <>
      <PageHeader title="Edit assessment" back={<BackLink href={`/grades/${course.id}`}>{course.name}</BackLink>} />
      <AssessmentForm
        courseId={course.id}
        id={assessment.id}
        defaults={{
          name: assessment.name,
          weight: String(assessment.weight),
          maxScore: String(assessment.maxScore),
          score: assessment.score === null ? "" : String(assessment.score),
          dueDate: assessment.dueAt ? dueParts(assessment.dueAt, false, preferences.timeZone).date : "",
        }}
      />
    </>
  );
}
