import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { type CourseResult, formatPercent } from "../logic";
import type { GradebookCourse } from "../queries";

export function CourseGradeRow({ course, result }: { course: GradebookCourse; result: CourseResult }) {
  const graded = result.totalWeight > 0 ? Math.round((result.gradedWeight / result.totalWeight) * 100) : 0;
  return (
    <li>
      <Link
        href={`/grades/${course.id}`}
        style={{ "--course": course.color } as React.CSSProperties}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
      >
        <span aria-hidden className="size-3 shrink-0 rounded-full bg-(--course)" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{course.name}</span>
          <span className="text-muted-foreground text-xs">
            {course.credits > 0 ? `${course.credits} SKS` : "Not counted (0 SKS)"}
            {result.totalWeight > 0 ? ` · ${graded}% graded` : " · No assessments"}
          </span>
        </span>
        <span className="text-right tabular-nums">
          {result.band ? (
            <>
              <span className="font-semibold">{result.band.letter}</span>
              <span className="block text-muted-foreground text-xs">
                {formatPercent(result.percent ?? 0)}% · {result.band.points.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">–</span>
          )}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
