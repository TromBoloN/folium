import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { CourseForm } from "@/features/courses/components/course-form";
import { listCourses } from "@/features/courses/queries";
import { nextCourseColor } from "@/features/courses/schema";

export const metadata: Metadata = { title: "Add course" };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="Add course" back={<BackLink href="/courses">Courses</BackLink>} />
      <Suspense fallback={<FormSkeleton />}>
        <NewCourse />
      </Suspense>
    </>
  );
}

async function NewCourse() {
  await requireUser();
  const courses = await listCourses();
  return <CourseForm mode="create" defaultColor={nextCourseColor(courses.map((c) => c.color))} />;
}
