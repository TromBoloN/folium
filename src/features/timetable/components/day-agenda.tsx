"use client";

import { CalendarX2, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { WeekDay } from "../week";
import { OverlapWarning } from "./overlap-warning";

/** Mobile: one day at a time, with a tab per day. */
export function DayAgenda({ days, initialIndex }: { days: WeekDay[]; initialIndex: number }) {
  const [index, setIndex] = useState(initialIndex);
  const day = days[index];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : 6)) % 7;
    setIndex(next);
    document.getElementById(`day-tab-${next}`)?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Day" className="grid grid-cols-7 gap-1" onKeyDown={onKeyDown}>
        {days.map((d, i) => (
          <button
            key={d.date}
            id={`day-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-controls="day-panel"
            tabIndex={i === index ? 0 : -1}
            onClick={() => setIndex(i)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs transition-colors",
              i === index ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <span>{d.shortLabel}</span>
            <span className={cn("font-display font-medium text-lg leading-tight", i !== index && "text-foreground")}>
              {d.dayNumber}
            </span>
            {d.items.length > 0 ? (
              <span
                aria-hidden
                className={cn("size-1 rounded-full", i === index ? "bg-primary-foreground" : "bg-primary")}
              />
            ) : (
              <span aria-hidden className="size-1" />
            )}
          </button>
        ))}
      </div>

      <section id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${index}`} className="flex flex-col gap-2">
        <h2 className="font-medium text-sm">
          {day.fullLabel}
          {day.isToday ? <span className="text-muted-foreground"> · Today</span> : null}
        </h2>
        {day.items.length === 0 ? (
          <p className="flex items-center gap-2 rounded-tile border border-dashed px-4 py-6 text-muted-foreground text-sm">
            <CalendarX2 aria-hidden className="size-4" />
            No classes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {day.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/courses/${item.courseId}`}
                  style={{ "--course": item.color } as React.CSSProperties}
                  className="tile flex flex-col gap-1 border-l-(--course) border-l-4 bg-[color-mix(in_oklab,var(--course)_13%,var(--card))] px-4 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--course)_20%,var(--card))]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.courseName}</span>
                    <span className="text-muted-foreground text-sm tabular-nums">{item.timeLabel}</span>
                  </span>
                  {item.location ? (
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <MapPin aria-hidden className="size-3.5" />
                      {item.location}
                    </span>
                  ) : null}
                  <OverlapWarning withNames={item.overlapsWith} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
