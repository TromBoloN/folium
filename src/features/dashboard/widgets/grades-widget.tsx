import Link from "next/link";
import { ProgressRing } from "@/components/ui/progress-ring";
import { courseResult, formatGpa, formatPercent, gpaBySemester } from "@/features/grades/logic";
import { listGradebook } from "@/features/grades/queries";
import { getSettings } from "@/features/settings/queries";
import { WidgetEmpty } from "../components/widget-frame";

/** This semester's GPA (with a ring against the top of the scale) and a bar per active course. */
export async function GradesWidget() {
  const [courses, { preferences }] = await Promise.all([listGradebook(), getSettings()]);
  const active = courses
    .filter((c) => !c.archived)
    .map((course) => ({ course, result: courseResult(course.assessments, preferences.gradeScale) }))
    .filter((r) => r.result.band !== null);

  if (active.length === 0) {
    return (
      <WidgetEmpty>
        Record assessment scores to see your grades.{" "}
        <Link href="/grades" className="text-foreground underline underline-offset-4">
          Open grades
        </Link>
      </WidgetEmpty>
    );
  }

  const { semesters } = gpaBySemester(
    active.map(({ course, result }) => ({
      semester: course.semester,
      credits: course.credits,
      points: result.band?.points ?? null,
      archived: false,
    })),
  );
  const current = semesters[0];
  const maxPoints = Math.max(...preferences.gradeScale.map((b) => b.points));
  const gpa = current?.gpa ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={gpa === null ? 0 : gpa / maxPoints}
          label={gpa === null ? "No GPA yet" : `GPA ${formatGpa(gpa)} of ${maxPoints.toFixed(2)}`}
          size={64}
        >
          <span className="font-display font-medium text-lg tabular-nums">{gpa === null ? "–" : formatGpa(gpa)}</span>
        </ProgressRing>
        <p className="flex flex-col">
          <span className="font-medium">GPA so far</span>
          <span className="text-muted-foreground text-sm">{current?.label ?? "This semester"}</span>
        </p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {active.slice(0, 5).map(({ course, result }, i) => (
          <li key={course.id}>
            <Link
              href={`/grades/${course.id}`}
              style={{ "--tint": course.color, "--i": i } as React.CSSProperties}
              className="group/grade flex flex-col gap-1 rounded-md text-sm"
            >
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate group-hover/grade:underline">{course.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatPercent(result.percent ?? 0)}%
                </span>
                <span className="w-6 text-right font-semibold">{result.band?.letter}</span>
              </span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="grow-x block h-full w-full rounded-full bg-(--tint)"
                  style={{ transform: `scaleX(${Math.min(100, result.percent ?? 0) / 100})` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
