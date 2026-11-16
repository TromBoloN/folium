"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { ChangeChip } from "@/features/schedule/components/change-chips";
import { formatTime, layoutDay, toMinutes } from "@/features/timetable/logic";
import { useT } from "@/lib/i18n/client";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { nowOffset, timelinePosition, timelineRange } from "../now";
import { classMoment } from "../today";
import { DaySummary } from "./day-summary";
import type { HeroClass } from "./next-up-hero";

const HOUR_REM = 3;
const GUTTER = "3rem";

type Props = {
  initialNow: number;
  timeZone: string;
  timeFormat: "24h" | "12h";
  classes: HeroClass[];
  tomorrow: HeroClass[];
};

/**
 * Today's classes on a vertical time axis. A "now" line moves down it once a
 * minute (transform only); the class on now gets a pulsing dot. Past classes are muted.
 */
export function DayTimeline({ initialNow, timeZone, timeFormat, classes, tomorrow }: Props) {
  const t = useT();
  const { minute } = useNow(initialNow, timeZone);
  const range = timelineRange(classes);
  if (!range) return null;
  // Cancelled classes stay on the axis (dimmed) but are never "now" or "next".
  const live = classes.filter((c) => !c.cancelled);
  const moment = classMoment(live, minute);
  const offset = nowOffset(minute, range);
  const hours = (range.end - range.start) / 60;
  const hourMarks = Array.from({ length: hours + 1 }, (_, i) => range.start / 60 + i);
  // Once the day's classes are over, look ahead instead of showing an empty axis.
  if (moment.current.length === 0 && moment.next === null) {
    return (
      <DaySummary
        past={live}
        cancelled={classes.filter((c) => c.cancelled)}
        tomorrow={tomorrow}
        timeFormat={timeFormat}
      />
    );
  }

  return (
    // Fills its tile: on wide screens the tile spans two grid rows, and the time axis stretches to match.
    <div className="flex flex-1 flex-col gap-2">
      <div className="relative flex-1 overflow-hidden" style={{ minHeight: `${hours * HOUR_REM}rem` }}>
        {/* Hour lines and labels */}
        {hourMarks.map((h, i) => (
          <div
            key={h}
            aria-hidden
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ top: `${(i / hours) * 100}%`, transform: "translateY(-50%)" }}
          >
            <span className="w-10 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
              {i === 0 || i === hours ? "" : formatTime(`${String(h).padStart(2, "0")}:00`, timeFormat)}
            </span>
            <span className="h-px flex-1 bg-border-soft" />
          </div>
        ))}

        <ol className="absolute inset-y-0 right-0" style={{ left: GUTTER }}>
          {layoutDay(classes).map(({ slot, lane, lanes }) => {
            const pos = timelinePosition(slot, range);
            const isNow = moment.current.includes(slot.id);
            const isNext = moment.next === slot.id;
            const isPast = toMinutes(slot.endTime) <= minute;
            const dim = isPast || slot.cancelled;
            return (
              <li
                key={slot.id}
                className="absolute p-0.5"
                style={{
                  top: `${pos.top}%`,
                  height: `${pos.height}%`,
                  left: `${(lane / lanes) * 100}%`,
                  width: `${100 / lanes}%`,
                }}
              >
                <Link
                  href={`/courses/class/${slot.key}`}
                  style={{ "--tint": slot.color } as React.CSSProperties}
                  className={cn(
                    "relative flex h-full min-h-9 items-start justify-between gap-2 overflow-hidden rounded-lg py-1.5 pr-2 pl-3 text-sm transition-colors",
                    dim
                      ? "bg-muted text-muted-foreground"
                      : "bg-[color-mix(in_oklab,var(--tint)_15%,var(--surface-1))] hover:bg-[color-mix(in_oklab,var(--tint)_24%,var(--surface-1))]",
                    isNow && "ring-2 ring-(--tint)",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 w-1", dim ? "bg-border" : "bg-(--tint)")}
                  />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className={cn("truncate font-medium", slot.cancelled && "line-through")}>
                      {slot.code ?? slot.name}
                      {slot.cancelled ? <span className="sr-only">{t(" (cancelled)")}</span> : null}
                    </span>
                    <span className={cn("truncate text-xs tabular-nums", slot.cancelled && "line-through")}>
                      {formatTime(slot.startTime, timeFormat)}–{formatTime(slot.endTime, timeFormat)}
                      {slot.location ? (
                        <>
                          {" · "}
                          <MapPin aria-hidden className="inline size-3 align-[-2px]" /> {slot.location}
                        </>
                      ) : null}
                    </span>
                  </span>
                  {slot.cancelled ? (
                    <ChangeChip chip={{ kind: "cancelled", text: t("Cancelled") }} compact />
                  ) : slot.chips.length > 0 && !isNow && !isNext ? (
                    <ChangeChip chip={slot.chips[0]} compact />
                  ) : isNow ? (
                    <span className="shrink-0 rounded-pill bg-foreground px-2 py-0.5 font-medium text-background text-xs">
                      {t("Now")}
                    </span>
                  ) : isNext ? (
                    <span className="shrink-0 rounded-pill border border-foreground/40 px-2 py-0.5 font-medium text-xs">
                      {t("Next")}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>

        {offset !== null ? (
          // A full-height track moved by translateY(offset%), so the line glides with transform only.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-full transition-transform duration-(--dur-enter) ease-(--ease-out)"
            style={{ transform: `translateY(${offset}%)` }}
          >
            <div
              className="absolute inset-x-0 top-0 flex -translate-y-1/2 items-center"
              style={{ paddingLeft: "2.5rem" }}
            >
              <span className="now-dot size-2.5 shrink-0 rounded-full bg-destructive" />
              <span className="h-0.5 flex-1 bg-destructive" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
