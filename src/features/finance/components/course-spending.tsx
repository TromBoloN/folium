import { Receipt } from "lucide-react";
import { formatIdr } from "../lib/format-idr";
import { courseSpending } from "../queries/planning";

/**
 * What a course has cost (books, printing, lab fees): posted expenses tagged to
 * it. A course belongs to one semester, so this is its cost for that semester.
 * Renders nothing until something is tagged.
 */
export async function CourseSpending({ courseId, courseName }: { courseId: string; courseName: string }) {
  const { count, total } = await courseSpending(courseId);
  if (count === 0) return null;
  return (
    <section aria-labelledby="course-cost-h" className="tile flex items-center gap-3 p-4">
      <Receipt aria-hidden className="size-5 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id="course-cost-h" className="font-medium text-sm">
          Spent on {courseName}
        </h2>
        <p className="text-muted-foreground text-xs">
          {count} {count === 1 ? "expense" : "expenses"} tagged to this course
        </p>
      </div>
      <span className="font-display font-medium text-lg tabular-nums">{formatIdr(total)}</span>
    </section>
  );
}
