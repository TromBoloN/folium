import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/queries";
import { getSettings } from "@/features/settings/queries";
import { Tr } from "@/lib/i18n/client";
import { listCourses } from "../queries";
import { nextCourseColor, nextSemesterName, semesterLabels } from "../schema";
import { CourseForm } from "./course-form";
import { RolloverForm } from "./rollover-form";

/** New course form, shared by the page and the sheet. Suggests a colour no other course uses. */
export async function NewCourseScreen() {
  await requireUser();
  const [courses, { preferences }] = await Promise.all([listCourses(), getSettings()]);
  return (
    <CourseForm
      mode="create"
      classTypes={preferences.classTypes}
      defaultColor={nextCourseColor(courses.map((c) => c.color))}
      semesters={semesterLabels(courses)}
    />
  );
}

/** Semester rollover: pick last semester, name the new one. */
export async function RolloverScreen({ variant }: { variant: "page" | "sheet" }) {
  await requireUser();
  const courses = await listCourses();
  const counts = new Map<string | null, number>();
  for (const c of courses) counts.set(c.semester, (counts.get(c.semester) ?? 0) + 1);
  // Most courses first: usually the current semester, the one to copy.
  const semesters = [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const latest = semesters[0]?.label ?? "";
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="New semester" back={<BackLink href="/courses">Courses</BackLink>} />
      ) : (
        <p className="mb-4 text-muted-foreground text-sm">
          <Tr k="Copy your courses into a new semester instead of typing them again." />
        </p>
      )}
      {courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          <Tr k="Add some courses first." />
        </p>
      ) : (
        <RolloverForm semesters={semesters} suggestion={nextSemesterName(latest)} />
      )}
    </>
  );
}
