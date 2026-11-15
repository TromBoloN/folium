import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Week } from "../week";
import { OverlapWarning } from "./overlap-warning";

const HOUR_REM = 3.5;

/** Left offset (% of the column) for a lane: at most half the column is used for offsets. */
function cascadeOffset(lane: number, lanes: number) {
  return lanes > 1 ? (lane * 50) / (lanes - 1) : 0;
}

/** Desktop: the whole week as a time grid. Overlapping classes share their column. */
export function WeekGrid({ week, timeLabels }: { week: Week; timeLabels: string[] }) {
  const hours = week.lastHour - week.firstHour;
  const toRem = (minute: number) => ((minute - week.firstHour * 60) / 60) * HOUR_REM;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      {/* pb-3 leaves room for the last hour label, which is centred on the bottom line. */}
      <div className="grid min-w-[44rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] pb-3">
        <div className="border-b" />
        {week.days.map((d) => (
          <div
            key={d.date}
            className={cn(
              "border-b border-l px-2 py-2 text-center text-xs",
              d.isToday && "bg-accent text-accent-foreground",
            )}
          >
            <span className="block text-muted-foreground">{d.shortLabel}</span>
            <span className="font-semibold text-sm">{d.dayNumber}</span>
            {d.isToday ? <span className="sr-only"> (today)</span> : null}
          </div>
        ))}

        <div className="relative" style={{ height: `${hours * HOUR_REM}rem` }} aria-hidden>
          {timeLabels.map((label, i) => (
            <span
              key={label}
              className="absolute right-2 -translate-y-1/2 text-muted-foreground text-xs tabular-nums"
              style={{ top: `${i * HOUR_REM}rem` }}
            >
              {i === 0 ? null : label}
            </span>
          ))}
        </div>

        {week.days.map((d) => (
          <section
            key={d.date}
            aria-label={d.fullLabel}
            className={cn("relative border-l", d.isToday && "bg-accent/30")}
            style={{
              height: `${hours * HOUR_REM}rem`,
              backgroundImage: "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: `100% ${HOUR_REM}rem`,
            }}
          >
            {d.items.map((item) => (
              <Link
                key={item.id}
                href={`/courses/${item.courseId}`}
                title={`${item.courseName}, ${item.timeLabel}${item.location ? `, ${item.location}` : ""}`}
                style={
                  {
                    "--course": item.color,
                    top: `${toRem(item.startMinute)}rem`,
                    height: `${toRem(item.endMinute) - toRem(item.startMinute)}rem`,
                    // Overlaps cascade like a calendar app: each later lane is offset and drawn on top,
                    // so every block keeps most of the column's width and earlier titles stay visible.
                    left: `calc(${cascadeOffset(item.lane, item.lanes)}% + 2px)`,
                    width: `calc(${100 - cascadeOffset(item.lane, item.lanes)}% - 4px)`,
                    zIndex: item.lane + 1,
                  } as React.CSSProperties
                }
                className="absolute flex flex-col gap-0.5 overflow-hidden rounded-md border-l-(--course) border-l-4 ring-1 ring-card bg-[color-mix(in_oklab,var(--course)_16%,var(--card))] px-1.5 py-1 text-xs leading-tight transition-colors hover:bg-[color-mix(in_oklab,var(--course)_26%,var(--card))]"
              >
                <span className="flex items-start justify-between gap-1">
                  <span className="truncate font-medium">{item.title}</span>
                  <OverlapWarning withNames={item.overlapsWith} compact />
                </span>
                <span className="truncate text-muted-foreground tabular-nums">{item.timeLabel}</span>
                {item.location ? <span className="truncate text-muted-foreground">{item.location}</span> : null}
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
