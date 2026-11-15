import { Archive, ChevronRight, Clock, MapPin, User } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
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
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((c, i) => (
            <CourseTile key={c.id} course={c} timeFormat={timeFormat} conflicts={conflicts} index={i} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">All your courses are archived.</p>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md text-muted-foreground text-sm hover:text-foreground">
            <Archive aria-hidden className="size-4" />
            Archived ({archived.length})
            <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((c) => (
              <CourseTile key={c.id} course={c} timeFormat={timeFormat} muted />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function CourseTile({
  course,
  timeFormat,
  conflicts,
  index,
  muted = false,
}: {
  course: CourseWithSlots;
  timeFormat: "24h" | "12h";
  conflicts?: Map<string, TimetableSlot[]>;
  index?: number;
  muted?: boolean;
}) {
  const slots = sortSlots(course.slots);
  const clashing = conflicts
    ? [...new Set(course.slots.flatMap((s) => conflicts.get(s.id) ?? []).map((o) => o.course.code ?? o.course.name))]
    : [];

  return (
    <li className={index === undefined ? undefined : "reveal"} style={{ "--i": index } as React.CSSProperties}>
      <Link
        href={`/courses/${course.id}`}
        data-spotlight
        style={{ "--tint": course.color } as React.CSSProperties}
        className={cn(
          "tile group/course flex h-full flex-col gap-3 overflow-hidden p-4 pl-5 transition-transform duration-(--dur-fast) hover:-translate-y-0.5",
          !muted && "tile-tinted",
        )}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-col gap-1">
            {course.code ? (
              <Pill tone="course" className="w-fit">
                {course.code}
              </Pill>
            ) : null}
            <span className="font-display font-medium text-xl leading-tight">{course.name}</span>
          </span>
          <ChevronRight
            aria-hidden
            className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-fast) group-hover/course:translate-x-0.5"
          />
        </span>
        {course.lecturer || course.room ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-sm">
            {course.lecturer ? (
              <span className="inline-flex items-center gap-1">
                <User aria-hidden className="size-3.5" />
                {course.lecturer}
              </span>
            ) : null}
            {course.room ? (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="size-3.5" />
                {course.room}
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="mt-auto flex flex-wrap gap-1.5">
          {slots.length > 0 ? (
            slots.map((s) => (
              <Pill key={s.id} tone="neutral" className="bg-surface-1/70 text-foreground">
                <Clock aria-hidden />
                {weekdayLabel(s.weekday, "short")} {formatTime(s.startTime, timeFormat)}
              </Pill>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">No class times yet</span>
          )}
        </span>
        <OverlapWarning withNames={clashing} />
      </Link>
    </li>
  );
}
