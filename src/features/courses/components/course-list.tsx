import { Archive, ArrowRightLeft, BookCheck, ChevronRight, ListTodo, MapPin, User } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { ChangeChips } from "../../schedule/components/change-chips";
import type { Chip } from "../../schedule/format";
import { OverlapWarning } from "../../timetable/components/overlap-warning";
import { findConflicts, WEEKDAYS } from "../../timetable/logic";
import type { TimetableSlot } from "../../timetable/types";
import type { CourseWithSlots } from "../queries";

/** What a course card shows besides the course itself; worked out on the page from the schedule. */
export type CourseCardStats = {
  /** "Wed 10:00", "On now, until 09:10"; null when nothing is coming up. */
  next: { label: string; location: string | null; chips: Chip[] } | null;
  /** ISO weekdays the course meets on, from its current weekly slots. */
  weekdays: number[];
  openTasks: number;
  grade: { letter: string; percent: string } | null;
  changesThisWeek: number;
};

type Props = {
  courses: CourseWithSlots[];
  stats: Record<string, CourseCardStats>;
};

export function CourseList({ courses, stats }: Props) {
  const active = courses.filter((c) => !c.archivedAt);
  const archived = courses.filter((c) => c.archivedAt);
  // Clashes in the weekly pattern (a property of the timetable itself, not of one week).
  const conflicts = findConflicts(active.flatMap((c) => c.slots));

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((c, i) => (
            <CourseCard key={c.id} course={c} stats={stats[c.id]} conflicts={conflicts} index={i} />
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
              <CourseCard key={c.id} course={c} stats={stats[c.id]} muted />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function CourseCard({
  course,
  stats,
  conflicts,
  index,
  muted = false,
}: {
  course: CourseWithSlots;
  stats: CourseCardStats | undefined;
  conflicts?: Map<string, TimetableSlot[]>;
  index?: number;
  muted?: boolean;
}) {
  const clashing = conflicts
    ? [...new Set(course.slots.flatMap((s) => conflicts.get(s.id) ?? []).map((o) => o.course.code ?? o.course.name))]
    : [];
  const days = new Set(stats?.weekdays ?? []);
  const facts = [
    course.credits > 0 ? `${course.credits} SKS` : null,
    stats ? plural(stats.openTasks, "open task", "open tasks") : null,
  ].filter(Boolean);

  return (
    <li className={cn("h-full", index !== undefined && "reveal")} style={{ "--i": index } as React.CSSProperties}>
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
            <span className="flex flex-wrap items-center gap-1.5">
              {course.code ? <Pill tone="course">{course.code}</Pill> : null}
              {stats && stats.changesThisWeek > 0 ? (
                <Pill tone="warning">
                  <ArrowRightLeft aria-hidden />
                  {plural(stats.changesThisWeek, "change", "changes")} this week
                </Pill>
              ) : null}
            </span>
            <span className="font-display font-medium text-xl leading-tight">{course.name}</span>
          </span>
          <ChevronRight
            aria-hidden
            className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-fast) group-hover/course:translate-x-0.5"
          />
        </span>

        {course.lecturer || course.room ? (
          <span className="flex min-w-0 gap-x-3 text-muted-foreground text-sm">
            {course.lecturer ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <User aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{course.lecturer}</span>
              </span>
            ) : null}
            {course.room ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <MapPin aria-hidden className="size-3.5" />
                {course.room}
              </span>
            ) : null}
          </span>
        ) : null}

        {muted ? null : (
          <span className="flex flex-col gap-2">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {stats?.next ? (
                <>
                  <span>
                    <span className="text-muted-foreground">Next: </span>
                    <span className="font-medium tabular-nums">{stats.next.label}</span>
                    {stats.next.location ? (
                      <span className="text-muted-foreground"> · {stats.next.location}</span>
                    ) : null}
                  </span>
                  <ChangeChips chips={stats.next.chips} />
                </>
              ) : (
                <span className="text-muted-foreground">
                  {course.slots.length > 0 ? "No classes in the next two weeks" : "No class times yet"}
                </span>
              )}
            </span>
            <span className="flex gap-1" role="img" aria-label={weekdayText(days)}>
              {WEEKDAYS.map((d) => (
                <span
                  key={d.value}
                  aria-hidden
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full font-medium text-[0.6875rem]",
                    days.has(d.value)
                      ? "bg-[color-mix(in_oklab,var(--tint)_45%,var(--surface-1))] font-semibold text-foreground ring-1 ring-(--tint)"
                      : "bg-surface-1/70 text-muted-foreground",
                  )}
                >
                  {d.short[0]}
                </span>
              ))}
            </span>
          </span>
        )}

        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-border-soft border-t pt-3 text-muted-foreground text-xs">
          {facts.map((f, i) => (
            <span key={f} className="inline-flex items-center gap-1">
              {i === 1 ? <ListTodo aria-hidden className="size-3.5" /> : null}
              {f}
            </span>
          ))}
          {stats?.grade ? (
            <span className="ml-auto inline-flex items-center gap-1 text-foreground">
              <BookCheck aria-hidden className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{stats.grade.letter}</span>
              <span className="text-muted-foreground tabular-nums">{stats.grade.percent}</span>
            </span>
          ) : null}
        </span>
        <OverlapWarning withNames={clashing} />
      </Link>
    </li>
  );
}

function weekdayText(days: Set<number>) {
  if (days.size === 0) return "No weekly classes";
  return `Meets on ${WEEKDAYS.filter((d) => days.has(d.value))
    .map((d) => d.label)
    .join(", ")}`;
}
