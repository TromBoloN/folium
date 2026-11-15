import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { EditAssessmentScreen } from "@/features/grades/components/assessment-screens";

type Props = PageProps<"/grades/[courseId]/assessments/[assessmentId]/edit">;

export default function EditAssessmentSheet({ params }: Props) {
  return (
    <Sheet title="Edit assessment">
      <Suspense fallback={<FormSkeleton />}>
        <Edit params={params} />
      </Suspense>
    </Sheet>
  );
}

async function Edit({ params }: Pick<Props, "params">) {
  const { courseId, assessmentId } = await params;
  return <EditAssessmentScreen courseId={courseId} assessmentId={assessmentId} variant="sheet" />;
}
