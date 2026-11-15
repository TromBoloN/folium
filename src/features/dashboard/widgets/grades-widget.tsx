import Link from "next/link";
import { courseResult, formatGpa, formatPercent, gpaBySemester } from "@/features/grades/logic";
import { listGradebook } from "@/features/grades/queries";
import { getSettings } from "@/features/settings/queries";
import { WidgetEmpty } from "../components/widget-frame";

/** This semester's GPA and the grade so far in each active course. */
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

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline gap-2">
        <span className="font-semibold text-2xl tabular-nums">
          {current?.gpa === null ? "–" : formatGpa(current.gpa)}
        </span>
        <span className="text-muted-foreground text-sm">GPA so far{current?.label ? ` · ${current.label}` : ""}</span>
      </p>
      <ul className="flex flex-col gap-1.5">
        {active.slice(0, 5).map(({ course, result }) => (
          <li key={course.id}>
            <Link
              href={`/grades/${course.id}`}
              style={{ "--course": course.color } as React.CSSProperties}
              className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent/50"
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--course)" />
              <span className="min-w-0 flex-1 truncate">{course.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">{formatPercent(result.percent ?? 0)}%</span>
              <span className="w-7 text-right font-medium">{result.band?.letter}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
