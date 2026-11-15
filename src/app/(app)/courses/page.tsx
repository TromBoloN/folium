import { BookOpen, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { CourseList } from "@/features/courses/components/course-list";
import { CourseTabs } from "@/features/courses/components/course-tabs";
import { listCourses } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return (
    <>
      <PageHeader
        title="Courses"
        description="Your courses and their weekly class times."
        action={
          <Button asChild size="sm">
            <Link href="/courses/new">
              <Plus aria-hidden />
              Add course
            </Link>
          </Button>
        }
      />
      <CourseTabs />
      <Suspense fallback={<ListSkeleton label="Loading courses" />}>
        <Courses />
      </Suspense>
    </>
  );
}

async function Courses() {
  await requireUser();
  const [courses, { preferences }] = await Promise.all([listCourses(), getSettings()]);
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No courses yet"
        description="Add your courses for this semester, then give each one its weekly class times."
      >
        <Button asChild size="sm">
          <Link href="/courses/new">Add your first course</Link>
        </Button>
      </EmptyState>
    );
  }
  return <CourseList courses={courses} timeFormat={preferences.timeFormat} />;
}
