"use client";

import { CalendarPlus, CalendarX2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OccurrenceRow } from "@/features/schedule/components/occurrence-row";
import { isoWeekday } from "@/lib/dates";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { cn } from "@/lib/utils";
import type { WeekDay } from "../week";

/** Mobile: one day at a time, with a tab per day. */
export function DayAgenda({ days, initialIndex }: { days: WeekDay[]; initialIndex: number }) {
  const t = useT();
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
      <div role="tablist" aria-label={t("Day")} className="grid grid-cols-7 gap-1" onKeyDown={onKeyDown}>
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
            {d.classCount > 0 ? (
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
          {day.isToday ? <span className="text-muted-foreground">{t(" · Today")}</span> : null}
        </h2>
        {day.breakLabel ? (
          <p className="rounded-xl border border-border-soft border-dashed px-3 py-2 text-muted-foreground text-sm">
            {rich(t("No classes · {name}"), { name: <span className="text-foreground">{day.breakLabel}</span> })}
          </p>
        ) : null}
        {day.items.length === 0 ? (
          <p className="flex items-center gap-2 rounded-tile border border-dashed px-4 py-6 text-muted-foreground text-sm">
            <CalendarX2 aria-hidden className="size-4" />
            {day.breakLabel ? t("Nothing scheduled.") : t("No classes.")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {day.items.map((item) => (
              <li key={item.id}>
                <OccurrenceRow item={item} />
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/courses/timetable/new?weekday=${isoWeekday(day.date)}&week=${days[0].date}`}
          className="inline-flex w-fit items-center gap-1.5 rounded-md py-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <CalendarPlus aria-hidden className="size-4" />
          {t("Add a class on {day}", { day: day.shortLabel })}
        </Link>
      </section>
    </div>
  );
}
