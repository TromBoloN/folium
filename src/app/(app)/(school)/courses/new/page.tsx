import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { NewCourseScreen } from "@/features/courses/components/course-screens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Add course") };
}

export default function NewCoursePage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Add course" back={<BackLink href="/courses">Courses</BackLink>} />
      <Suspense fallback={<FormSkeleton />}>
        <NewCourseScreen />
      </Suspense>
    </div>
  );
}
