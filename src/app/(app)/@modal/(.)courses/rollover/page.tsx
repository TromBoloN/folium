import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { RolloverScreen } from "@/features/courses/components/course-screens";

export default function RolloverSheet() {
  return (
    <Sheet title="New semester">
      <Suspense fallback={<FormSkeleton />}>
        <RolloverScreen variant="sheet" />
      </Suspense>
    </Sheet>
  );
}
