import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { CourseForm } from "@/features/courses/components/course-form";
import { getCourse, listCourses } from "@/features/courses/queries";
import { semesterLabels } from "@/features/courses/schema";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Edit course") };
}

export default function EditCoursePage({ params }: PageProps<"/courses/[id]/edit">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <EditCourse params={params} />
      </Suspense>
    </div>
  );
}

async function EditCourse({ params }: Pick<PageProps<"/courses/[id]/edit">, "params">) {
  await requireUser();
  const { id } = await params;
  const [course, courses] = await Promise.all([getCourse(id), listCourses()]);
  if (!course) notFound();
  return (
    <>
      <PageHeader title="Edit course" back={<BackLink href={`/courses/${course.id}`}>{course.name}</BackLink>} />
      <CourseForm mode="edit" course={course} semesters={semesterLabels(courses)} />
    </>
  );
}
