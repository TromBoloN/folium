import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { type CourseResult, formatPercent } from "../logic";
import type { GradebookCourse } from "../queries";

export async function CourseGradeRow({ course, result }: { course: GradebookCourse; result: CourseResult }) {
  const t = await getT();
  const graded = result.totalWeight > 0 ? Math.round((result.gradedWeight / result.totalWeight) * 100) : 0;
  return (
    <li>
      <Link
        href={`/grades/${course.id}`}
        style={{ "--tint": course.color } as React.CSSProperties}
        className="relative flex items-center gap-3 py-3 pr-4 pl-5 transition-colors hover:bg-[color-mix(in_oklab,var(--tint)_8%,transparent)]"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium">{course.name}</span>
          <span aria-hidden className="h-1.5 max-w-sm overflow-hidden rounded-full bg-muted">
            <span
              className="grow-x block h-full w-full rounded-full bg-(--tint)"
              style={{ transform: `scaleX(${Math.min(100, result.percent ?? 0) / 100})` }}
            />
          </span>
          <span className="text-muted-foreground text-xs">
            {course.credits > 0 ? t("{n} SKS", { n: course.credits }) : t("Not counted (0 SKS)")}
            {result.totalWeight > 0 ? t(" · {n}% graded", { n: graded }) : t(" · No assessments")}
          </span>
        </span>
        <span className="text-right tabular-nums">
          {result.band ? (
            <>
              <span className="font-display font-medium text-xl">{result.band.letter}</span>
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
