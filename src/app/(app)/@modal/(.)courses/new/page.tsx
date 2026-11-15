import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewCourseScreen } from "@/features/courses/components/course-screens";

export default function NewCourseSheet() {
  return (
    <Sheet title="Add course">
      <Suspense fallback={<FormSkeleton />}>
        <NewCourseScreen />
      </Suspense>
    </Sheet>
  );
}
