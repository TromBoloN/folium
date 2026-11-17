import Link from "next/link";
import { ChangeChips } from "@/features/schedule/components/change-chips";
import { isoWeekday } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { Week } from "../week";
import { AddSlotOverlay } from "./add-slot-overlay";
import { OverlapWarning } from "./overlap-warning";

const HOUR_REM = 3.5;

/** Left offset (% of the column) for a lane: at most half the column is used for offsets. */
function cascadeOffset(lane: number, lanes: number) {
  return lanes > 1 ? (lane * 50) / (lanes - 1) : 0;
}

/** Desktop: the whole week as a time grid. Overlapping classes share their column. */
export async function WeekGrid({ week, timeLabels }: { week: Week; timeLabels: string[] }) {
  const { t } = await getI18n();
  const hours = week.lastHour - week.firstHour;
  const toRem = (minute: number) => ((minute - week.firstHour * 60) / 60) * HOUR_REM;

  return (
    <div data-slot="week-grid" className="tile overflow-x-auto">
      {/* pb-3 leaves room for the last hour label, which is centred on the bottom line. */}
      <div className="grid min-w-[44rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] pb-3">
        <div className="border-border-soft border-b" />
        {week.days.map((d) => (
          <div
            key={d.date}
            data-slot="week-day"
            data-today={d.isToday || undefined}
            className={cn(
              "border-border-soft border-b border-l px-2 py-2.5 text-center text-xs",
              d.isToday && "bg-accent text-accent-foreground",
            )}
          >
            <span className="block text-muted-foreground">{d.shortLabel}</span>
            <span className="font-display font-medium text-lg leading-none">{d.dayNumber}</span>
            {d.isToday ? <span className="sr-only">{t(" (today)")}</span> : null}
            {d.breakLabel ? (
              <span
                className="mt-1 block truncate text-[0.6875rem] text-muted-foreground"
                title={t("No classes · {name}", { name: d.breakLabel })}
              >
                {d.breakLabel}
              </span>
            ) : null}
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
            data-slot="week-column"
            data-today={d.isToday || undefined}
            className={cn("relative border-border-soft border-l", d.isToday && "bg-accent/40")}
            style={{
              height: `${hours * HOUR_REM}rem`,
              backgroundImage: "linear-gradient(to bottom, var(--border-soft) 1px, transparent 1px)",
              backgroundSize: `100% ${HOUR_REM}rem`,
            }}
          >
            <AddSlotOverlay
              weekday={isoWeekday(d.date)}
              firstHour={week.firstHour}
              hours={hours}
              week={week.days[0].date}
              dayLabel={d.fullLabel}
            />
            {d.ghosts.map((g) => (
              // Where a moved class used to be: faint and dashed, not interactive (the moved class says "Moved from").
              <div
                key={g.id}
                aria-hidden
                title={t("{name} moved to {when}", { name: g.title, when: g.movedToLabel })}
                style={
                  {
                    "--course": g.color,
                    top: `${toRem(g.startMinute)}rem`,
                    height: `${toRem(g.endMinute) - toRem(g.startMinute)}rem`,
                  } as React.CSSProperties
                }
                className="pointer-events-none absolute inset-x-0.5 flex flex-col overflow-hidden rounded-lg border border-(--course)/50 border-dashed px-1.5 py-1 text-muted-foreground text-xs leading-tight"
              >
                <span className="truncate">{g.title}</span>
                <span className="truncate">→ {g.movedToLabel}</span>
              </div>
            ))}
            {d.items.map((item) => {
              const cancelled = item.status === "cancelled";
              // Postponed (new date TBD) isn't held here either: dimmed, not struck through.
              const dim = cancelled || item.status === "postponed" || item.past;
              return (
                <Link
                  key={item.id}
                  href={`/courses/class/${item.id}`}
                  data-slot="class-block"
                  data-status={item.status}
                  data-past={item.past || undefined}
                  title={`${item.courseName}, ${item.timeLabel}${item.location ? `, ${item.location}` : ""}${item.chips.length ? ` · ${item.chips.map((c) => c.text).join(" · ")}` : ""}${item.note ? ` · “${item.note}”` : ""}`}
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
                  className={cn(
                    "absolute flex flex-col gap-0.5 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-xs leading-tight shadow-tile ring-1 ring-card transition-colors",
                    dim
                      ? "border-l-border bg-muted text-muted-foreground hover:bg-accent"
                      : "border-l-(--course) bg-[color-mix(in_oklab,var(--course)_18%,var(--card))] hover:bg-[color-mix(in_oklab,var(--course)_28%,var(--card))]",
                    item.status === "extra" && "border border-(--course) border-l-4 border-dashed",
                  )}
                >
                  <span className="flex items-start justify-between gap-1">
                    <span className={cn("line-clamp-2 font-medium", cancelled && "line-through")}>
                      {item.courseName}
                    </span>
                    <OverlapWarning withNames={item.overlapsWith} compact />
                  </span>
                  <span
                    className={cn(
                      "truncate tabular-nums",
                      !dim && "text-muted-foreground",
                      cancelled && "line-through",
                    )}
                  >
                    {item.timeLabel}
                    {item.code ? <span className="ml-1 opacity-80">· {item.code}</span> : null}
                  </span>
                  {item.chips.length > 0 ? (
                    <ChangeChips chips={item.chips} compact className="mt-0.5" />
                  ) : item.location ? (
                    <span className="truncate text-muted-foreground">{item.location}</span>
                  ) : null}
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
