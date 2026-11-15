import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { CourseGradeRow } from "@/features/grades/components/course-grade-row";
import { GpaStat } from "@/features/grades/components/gpa-summary";
import { courseResult, formatGpa, gpaBySemester } from "@/features/grades/logic";
import { listGradebook } from "@/features/grades/queries";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: "Grades" };

export default function GradesPage() {
  return (
    <>
      <PageHeader title="Grades" description="Course grades from your assessments, and your GPA by semester." />
      <Suspense fallback={<ListSkeleton rows={4} label="Loading grades" />}>
        <Grades />
      </Suspense>
    </>
  );
}

async function Grades() {
  await requireUser();
  const [courses, { preferences }] = await Promise.all([listGradebook(), getSettings()]);

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No courses yet"
        description="Add your courses with their credits, then record assessments to see grades and your GPA."
      >
        <Button asChild size="sm">
          <Link href="/courses/new">Add a course</Link>
        </Button>
      </EmptyState>
    );
  }

  const rows = courses.map((course) => ({ course, result: courseResult(course.assessments, preferences.gradeScale) }));
  const { semesters, overall } = gpaBySemester(
    rows.map(({ course, result }) => ({
      semester: course.semester,
      credits: course.credits,
      points: result.band?.points ?? null,
      archived: course.archived,
    })),
  );
  const current = semesters[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <GpaStat
          label={current?.label ? `GPA · ${current.label}` : "GPA · this semester"}
          gpa={current?.gpa ?? null}
          credits={current?.credits ?? 0}
        />
        <GpaStat label="GPA · all semesters" gpa={overall.gpa} credits={overall.credits} />
      </div>
      <p className="text-muted-foreground text-xs">
        GPA counts courses with credits and at least one graded assessment, weighted by credits. Grades in progress use
        what&apos;s graded so far.
      </p>

      {semesters.map((s) => {
        const list = rows.filter((r) => r.course.semester === s.label);
        const id = `semester-${s.label ?? "none"}`.replace(/\s+/g, "-");
        return (
          <section key={s.label ?? "none"} aria-labelledby={id} className="flex flex-col gap-2">
            <h2 id={id} className="flex items-baseline justify-between gap-2 font-medium">
              {s.label ?? "No semester"}
              <span className="font-normal text-muted-foreground text-sm tabular-nums">
                {s.gpa === null ? "No GPA yet" : `GPA ${formatGpa(s.gpa)}`}
              </span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {list.map(({ course, result }) => (
                <CourseGradeRow key={course.id} course={course} result={result} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
