import { Clock, MapPin, User } from "lucide-react";
import Link from "next/link";
import { OverlapWarning } from "@/features/timetable/components/overlap-warning";
import { cn } from "@/lib/utils";
import type { RowItem } from "../format";
import { AttendanceQuick } from "./attendance-quick";
import { ChangeChips } from "./change-chips";

/**
 * One class in a day list, time first: a course-colour stripe, the time, the
 * course, room and any change; on the right the lecturer and length, and for
 * a class that's over, Attended / Missed. Past and cancelled classes are dimmed;
 * a cancelled one is struck through. The left part opens the class sheet.
 */
export function OccurrenceRow({ item }: { item: RowItem }) {
  const cancelled = item.status === "cancelled";
  // Postponed (rescheduled, new date TBD): not held on this date either, but not struck through.
  const notHeld = cancelled || item.status === "postponed";
  const dim = notHeld || item.past;
  return (
    <div
      style={{ "--course": item.color } as React.CSSProperties}
      data-status={item.status}
      className={cn(
        "group/occ relative flex items-center gap-3 overflow-hidden rounded-xl pr-3 transition-colors",
        dim
          ? "bg-muted/60 text-muted-foreground hover:bg-muted"
          : "bg-[color-mix(in_oklab,var(--course)_11%,var(--surface-1))] hover:bg-[color-mix(in_oklab,var(--course)_19%,var(--surface-1))]",
        item.status === "extra" && "border border-(--course) border-dashed",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", dim ? "bg-border" : "bg-(--course)")} />
      <Link
        href={`/courses/class/${item.id}`}
        data-status={item.status}
        className="flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-4 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:ring-inset"
      >
        <span
          className={cn(
            "flex w-[6.75rem] shrink-0 flex-col pt-px font-medium tabular-nums",
            cancelled && "line-through",
          )}
        >
          {item.dateLabel ? <span className="font-normal text-muted-foreground text-xs">{item.dateLabel}</span> : null}
          {item.timeLabel}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cn("font-medium", !dim && "text-foreground", cancelled && "line-through")}>
              {item.courseName}
            </span>
            {item.code ? <span className="text-muted-foreground text-xs">{item.code}</span> : null}
            {item.location ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                <MapPin aria-hidden className="size-3" />
                {item.location}
              </span>
            ) : null}
          </span>
          {item.chips.length > 0 || item.note ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ChangeChips chips={item.chips} />
              {item.note ? <span className="text-muted-foreground text-xs">“{item.note}”</span> : null}
            </span>
          ) : null}
          <OverlapWarning withNames={item.overlapsWith} />
        </span>
        <span className="hidden shrink-0 flex-col items-end gap-0.5 pt-px text-muted-foreground text-xs md:flex">
          {item.lecturer ? (
            <span className="inline-flex max-w-48 items-center gap-1">
              <User aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{item.lecturer}</span>
            </span>
          ) : null}
          {item.durationLabel ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock aria-hidden className="size-3" />
              {item.durationLabel}
            </span>
          ) : null}
        </span>
        {item.past && !notHeld ? <span className="sr-only">(over)</span> : null}
      </Link>
      {item.canMark ? (
        <AttendanceQuick
          occurrenceKey={item.id}
          initial={item.attendance ?? null}
          label={`${item.courseName}, ${item.dateLabel ? `${item.dateLabel} ` : ""}${item.timeLabel}`}
          compact
        />
      ) : null}
    </div>
  );
}
