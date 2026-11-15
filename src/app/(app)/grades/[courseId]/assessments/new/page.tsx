import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { NewAssessmentScreen } from "@/features/grades/components/assessment-screens";

export const metadata: Metadata = { title: "Add assessment" };

export default function NewAssessmentPage({ params }: PageProps<"/grades/[courseId]/assessments/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <New params={params} />
      </Suspense>
    </div>
  );
}

async function New({ params }: Pick<PageProps<"/grades/[courseId]/assessments/new">, "params">) {
  const { courseId } = await params;
  return <NewAssessmentScreen courseId={courseId} variant="page" />;
}
