import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { RolloverScreen } from "@/features/courses/components/course-screens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("New semester") };
}

export default function RolloverPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <RolloverScreen variant="page" />
      </Suspense>
    </div>
  );
}
