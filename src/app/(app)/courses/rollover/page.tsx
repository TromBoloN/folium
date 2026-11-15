import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { RolloverScreen } from "@/features/courses/components/course-screens";

export const metadata: Metadata = { title: "New semester" };

export default function RolloverPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <RolloverScreen variant="page" />
      </Suspense>
    </div>
  );
}
