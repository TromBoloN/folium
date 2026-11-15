import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewAssessmentScreen } from "@/features/grades/components/assessment-screens";

export default function NewAssessmentSheet({ params }: PageProps<"/grades/[courseId]/assessments/new">) {
  return (
    <Sheet title="Add assessment">
      <Suspense fallback={<FormSkeleton />}>
        <New params={params} />
      </Suspense>
    </Sheet>
  );
}

async function New({ params }: Pick<PageProps<"/grades/[courseId]/assessments/new">, "params">) {
  const { courseId } = await params;
  return <NewAssessmentScreen courseId={courseId} variant="sheet" />;
}
