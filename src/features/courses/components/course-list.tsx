import { Archive, ArrowRightLeft, BookCheck, ChevronRight, ListTodo, MapPin, User } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { type I18n, plural } from "@/lib/i18n/core";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { ChangeChips } from "../../schedule/components/change-chips";
import type { Chip } from "../../schedule/format";
import { OverlapWarning } from "../../timetable/components/overlap-warning";
import { findConflicts, WEEKDAYS, weekdayLabel } from "../../timetable/logic";
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
  /** From the meeting log: the next meeting to log, of how many. */
  meeting: { next: number; total: number | null; finished: boolean } | null;
  /** Campus courses with a total and at least one mark: skips left before the attendance target. */
  skipsLeft: number | null;
  /** The class type's name, already translated; null for none. */
  typeName: string | null;
};

type Props = {
  courses: CourseWithSlots[];
  stats: Record<string, CourseCardStats>;
};

export async function CourseList({ courses, stats }: Props) {
  const i18n = await getI18n();
  const { t } = i18n;
  const active = courses.filter((c) => !c.archivedAt);
  const archived = courses.filter((c) => c.archivedAt);
  // Clashes in the weekly pattern (a property of the timetable itself, not of one week).
  const conflicts = findConflicts(active.flatMap((c) => c.slots));

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((c, i) => (
            <CourseCard key={c.id} course={c} stats={stats[c.id]} conflicts={conflicts} index={i} i18n={i18n} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("All your courses are archived.")}</p>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md text-muted-foreground text-sm hover:text-foreground">
            <Archive aria-hidden className="size-4" />
            {t("Archived ({n})", { n: archived.length })}
            <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((c) => (
              <CourseCard key={c.id} course={c} stats={stats[c.id]} muted i18n={i18n} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function CourseCard({
  course,
  stats,
  conflicts,
  index,
  muted = false,
  i18n,
}: {
  course: CourseWithSlots;
  stats: CourseCardStats | undefined;
  conflicts?: Map<string, TimetableSlot[]>;
  index?: number;
  muted?: boolean;
  i18n: I18n;
}) {
  const { t, intl } = i18n;
  const clashing = conflicts
    ? [...new Set(course.slots.flatMap((s) => conflicts.get(s.id) ?? []).map((o) => o.course.code ?? o.course.name))]
    : [];
  const days = new Set(stats?.weekdays ?? []);
  const facts = [
    course.credits > 0 ? t("{n} SKS", { n: course.credits }) : null,
    stats ? t(plural(stats.openTasks, "{n} open task", "{n} open tasks"), { n: stats.openTasks }) : null,
  ].filter(Boolean);

  return (
    <li className={cn("h-full", index !== undefined && "reveal")} style={{ "--i": index } as React.CSSProperties}>
      <Link
        href={`/courses/${course.id}`}
        data-spotlight
        data-slot="course-card"
        style={{ "--tint": course.color } as React.CSSProperties}
        className={cn(
          "tile group/course flex h-full flex-col gap-3 overflow-hidden p-4 pl-5 transition-transform duration-(--dur-fast) hover:-translate-y-0.5",
          !muted && "tile-tinted",
        )}
      >
        <span aria-hidden data-slot="course-rail" className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-1.5">
              {course.code ? <Pill tone="course">{course.code}</Pill> : null}
              {course.kind === "external" ? <Pill>{t("Outside campus")}</Pill> : null}
              {stats?.typeName ? <Pill>{stats.typeName}</Pill> : null}
              {stats && stats.changesThisWeek > 0 ? (
                <Pill tone="warning">
                  <ArrowRightLeft aria-hidden />
                  {t(plural(stats.changesThisWeek, "{n} change this week", "{n} changes this week"), {
                    n: stats.changesThisWeek,
                  })}
                </Pill>
              ) : null}
            </span>
            <span data-slot="course-name" className="font-display font-medium text-xl leading-tight">
              {course.name}
            </span>
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
                    <span className="text-muted-foreground">{t("Next:")} </span>
                    <span className="font-medium tabular-nums">{stats.next.label}</span>
                    {stats.next.location ? (
                      <span className="text-muted-foreground"> · {stats.next.location}</span>
                    ) : null}
                  </span>
                  <ChangeChips chips={stats.next.chips} />
                </>
              ) : (
                <span className="text-muted-foreground">
                  {course.slots.length > 0 ? t("No classes in the next two weeks") : t("No class times yet")}
                </span>
              )}
            </span>
            <span className="flex gap-1" role="img" aria-label={weekdayText(days, i18n)}>
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
                  {weekdayLabel(d.value, "short", intl)[0]}
                </span>
              ))}
            </span>
          </span>
        )}

        {stats?.meeting && !muted ? (
          <MeetingProgressLine meeting={stats.meeting} skipsLeft={stats.skipsLeft} i18n={i18n} />
        ) : null}

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

function weekdayText(days: Set<number>, { t, intl }: I18n) {
  if (days.size === 0) return t("No weekly classes");
  return t("Meets on {days}", {
    days: WEEKDAYS.filter((d) => days.has(d.value))
      .map((d) => weekdayLabel(d.value, "label", intl))
      .join(", "),
  });
}

/** "Meeting 5 of 16" with a bar, or "Meeting 5" when open-ended; then "2 skips left" once there's a mark. */
function MeetingProgressLine({
  meeting,
  skipsLeft,
  i18n,
}: {
  meeting: NonNullable<CourseCardStats["meeting"]>;
  skipsLeft: number | null;
  i18n: I18n;
}) {
  const { t } = i18n;
  const { next, total, finished } = meeting;
  const text = finished
    ? t("All {total} meetings done", { total: total ?? 0 })
    : total === null
      ? t("Meeting {n}", { n: next })
      : t("Meeting {n} of {total}", { n: next, total });
  return (
    <span className="flex flex-col gap-1.5 text-sm">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="tabular-nums">{text}</span>
        {skipsLeft !== null ? (
          <span
            className={cn(
              "font-medium text-xs tabular-nums",
              skipsLeft < 0 ? "text-destructive" : skipsLeft <= 1 ? "text-warning" : "text-muted-foreground",
            )}
          >
            {skipsLeft < 0
              ? t(plural(-skipsLeft, "{n} skip over the limit", "{n} skips over the limit"), { n: -skipsLeft })
              : t(plural(skipsLeft, "{n} skip left", "{n} skips left"), { n: skipsLeft })}
          </span>
        ) : null}
      </span>
      {total !== null ? (
        <ProgressBar value={(next - 1) / total} className="bg-[color-mix(in_oklab,var(--tint)_18%,transparent)]" />
      ) : null}
    </span>
  );
}
