import { Archive, ChevronRight } from "lucide-react";
import Link from "next/link";
import { OverlapWarning } from "../../timetable/components/overlap-warning";
import { findConflicts, formatTime, sortSlots, weekdayLabel } from "../../timetable/logic";
import type { TimetableSlot } from "../../timetable/types";
import type { CourseWithSlots } from "../queries";

type Props = { courses: CourseWithSlots[]; timeFormat: "24h" | "12h" };

export function CourseList({ courses, timeFormat }: Props) {
  const active = courses.filter((c) => !c.archivedAt);
  const archived = courses.filter((c) => c.archivedAt);
  const conflicts = findConflicts(active.flatMap((c) => c.slots));

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {active.map((c) => (
            <CourseRow key={c.id} course={c} timeFormat={timeFormat} conflicts={conflicts} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">All your courses are archived.</p>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground text-sm hover:text-foreground">
            <Archive aria-hidden className="size-4" />
            Archived ({archived.length})
            <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-3 flex flex-col gap-2 opacity-80">
            {archived.map((c) => (
              <CourseRow key={c.id} course={c} timeFormat={timeFormat} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function CourseRow({
  course,
  timeFormat,
  conflicts,
}: {
  course: CourseWithSlots;
  timeFormat: "24h" | "12h";
  conflicts?: Map<string, TimetableSlot[]>;
}) {
  const meta = [course.code, course.lecturer, course.room].filter(Boolean).join(" · ");
  const schedule = sortSlots(course.slots)
    .map((s) => `${weekdayLabel(s.weekday, "short")} ${formatTime(s.startTime, timeFormat)}`)
    .join(", ");
  const clashing = conflicts
    ? [...new Set(course.slots.flatMap((s) => conflicts.get(s.id) ?? []).map((o) => o.course.code ?? o.course.name))]
    : [];

  return (
    <li>
      <Link
        href={`/courses/${course.id}`}
        style={{ "--course": course.color } as React.CSSProperties}
        className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50"
      >
        <span aria-hidden className="size-3 shrink-0 rounded-full bg-(--course)" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{course.name}</span>
          {meta ? <span className="truncate text-muted-foreground text-sm">{meta}</span> : null}
          <span className="truncate text-muted-foreground text-xs">{schedule || "No class times yet"}</span>
          <OverlapWarning withNames={clashing} />
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
