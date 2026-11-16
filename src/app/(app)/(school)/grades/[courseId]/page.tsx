import { ClipboardList, Plus, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { AssessmentList } from "@/features/grades/components/assessment-list";
import { NeededCalculator } from "@/features/grades/components/needed-calculator";
import { courseResult, formatPercent } from "@/features/grades/logic";
import { getCourseGradebook } from "@/features/grades/queries";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: "Course grades" };

export default function CourseGradesPage({ params, searchParams }: PageProps<"/grades/[courseId]">) {
  return (
    <>
      <div className="mb-4">
        <BackLink href="/grades">Grades</BackLink>
      </div>
      <Suspense fallback={<ListSkeleton label="Loading course grades" />}>
        <CourseGrades params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CourseGrades({
  params,
  searchParams,
}: Pick<PageProps<"/grades/[courseId]">, "params" | "searchParams">) {
  await requireUser();
  const [{ courseId }, { target }, { preferences }] = await Promise.all([params, searchParams, getSettings()]);
  const course = await getCourseGradebook(courseId);
  if (!course) notFound();

  const scale = preferences.gradeScale;
  const result = courseResult(course.assessments, scale);
  const targetBand = scale.find((b) => b.letter === target) ?? scale[0];
  const weightOff = course.assessments.length > 0 && Math.abs(result.totalWeight - 100) > 0.001;

  return (
    <div
      className="grid gap-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] xl:items-start xl:gap-10"
      style={{ "--course": course.color, "--tint": course.color } as React.CSSProperties}
    >
      <div className="flex flex-col gap-6 xl:sticky xl:top-8">
        <header className="flex flex-col gap-2">
          <h1 className="flex items-center gap-3 font-display font-medium text-3xl tracking-tight">
            <span aria-hidden className="size-3 shrink-0 rounded-full bg-(--course)" />
            {course.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {course.credits > 0 ? `${course.credits} SKS` : "0 SKS (not counted in your GPA)"}
            {course.semester ? ` · ${course.semester}` : ""} ·{" "}
            <Link href={`/courses/${course.id}/edit`} className="underline underline-offset-4">
              Edit course
            </Link>
          </p>
        </header>

        <section aria-labelledby="standing" className="grid grid-cols-3 gap-3">
          <h2 id="standing" className="sr-only">
            Current standing
          </h2>
          <div className="tile p-4">
            <span className="text-muted-foreground text-xs">Grade so far</span>
            <span className="block font-display font-medium text-3xl">{result.band?.letter ?? "–"}</span>
          </div>
          <div className="tile p-4">
            <span className="text-muted-foreground text-xs">Percentage</span>
            <span className="block font-display font-medium text-3xl tabular-nums">
              {result.percent === null ? "–" : `${formatPercent(result.percent)}%`}
            </span>
          </div>
          <div className="tile p-4">
            <span className="text-muted-foreground text-xs">Graded</span>
            <span className="block font-display font-medium text-3xl tabular-nums">
              {result.totalWeight > 0 ? `${Math.round((result.gradedWeight / result.totalWeight) * 100)}%` : "–"}
            </span>
          </div>
        </section>

        {weightOff ? (
          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            Weights add up to {formatPercent(result.totalWeight, 0)}%, not 100%. Grades are scaled to the weights
            entered; add the missing assessments for an accurate picture.
          </p>
        ) : null}

        <NeededCalculator courseId={course.id} assessments={course.assessments} scale={scale} target={targetBand} />
      </div>

      <section aria-labelledby="assessments" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="assessments" className="font-medium">
            Assessments
          </h2>
          {course.assessments.length > 0 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/grades/${course.id}/assessments/new`}>
                <Plus aria-hidden />
                Add assessment
              </Link>
            </Button>
          ) : null}
        </div>
        {course.assessments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assessments yet"
            description="Add quizzes, assignments and exams with their weight. Leave the score empty until it's graded."
          >
            <Button asChild size="sm">
              <Link href={`/grades/${course.id}/assessments/new`}>Add assessment</Link>
            </Button>
          </EmptyState>
        ) : (
          <AssessmentList assessments={course.assessments} timeZone={preferences.timeZone} />
        )}
      </section>
    </div>
  );
}
