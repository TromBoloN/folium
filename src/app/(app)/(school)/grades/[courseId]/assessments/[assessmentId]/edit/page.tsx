import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { EditAssessmentScreen } from "@/features/grades/components/assessment-screens";

export const metadata: Metadata = { title: "Edit assessment" };

type Props = PageProps<"/grades/[courseId]/assessments/[assessmentId]/edit">;

export default function EditAssessmentPage({ params }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: Pick<Props, "params">) {
  const { courseId, assessmentId } = await params;
  return <EditAssessmentScreen courseId={courseId} assessmentId={assessmentId} variant="page" />;
}
