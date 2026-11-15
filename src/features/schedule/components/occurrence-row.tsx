import { MapPin } from "lucide-react";
import Link from "next/link";
import { OverlapWarning } from "@/features/timetable/components/overlap-warning";
import { cn } from "@/lib/utils";
import type { RowItem } from "../format";
import { ChangeChips } from "./change-chips";

/**
 * One class in a day list, time first: a course-colour stripe, the time, the
 * course, room and any change. Past classes and cancelled ones are dimmed;
 * a cancelled class is struck through. Opens the class sheet.
 */
export function OccurrenceRow({ item }: { item: RowItem }) {
  const cancelled = item.status === "cancelled";
  const dim = cancelled || item.past;
  return (
    <Link
      href={`/courses/class/${item.id}`}
      style={{ "--course": item.color } as React.CSSProperties}
      data-status={item.status}
      className={cn(
        "group/occ relative flex items-start gap-3 overflow-hidden rounded-xl py-2.5 pr-3 pl-4 text-sm transition-colors",
        dim
          ? "bg-muted/60 text-muted-foreground hover:bg-muted"
          : "bg-[color-mix(in_oklab,var(--course)_11%,var(--surface-1))] hover:bg-[color-mix(in_oklab,var(--course)_19%,var(--surface-1))]",
        item.status === "extra" && "border border-(--course) border-dashed",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", dim ? "bg-border" : "bg-(--course)")} />
      <span
        className={cn("flex w-[6.75rem] shrink-0 flex-col pt-px font-medium tabular-nums", cancelled && "line-through")}
      >
        {item.dateLabel ? <span className="font-normal text-muted-foreground text-xs">{item.dateLabel}</span> : null}
        {item.timeLabel}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn("font-medium", !dim && "text-foreground", cancelled && "line-through")}>
            {item.courseName}
          </span>
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
      {item.past && !cancelled ? <span className="sr-only">(over)</span> : null}
    </Link>
  );
}
