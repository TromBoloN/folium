import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import type { Week } from "@/features/timetable/week";
import { formatDate, isoWeekday } from "@/lib/dates";
import { plural, type T } from "@/lib/i18n/core";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { BreakBanner } from "./break-banner";
import { OccurrenceRow } from "./occurrence-row";

function countLabel(t: T, classes: number, cancelled: number) {
  const parts = [t(plural(classes, "{n} class", "{n} classes"), { n: classes })];
  if (cancelled) parts.push(t("{n} cancelled", { n: cancelled }));
  return parts.join(" · ");
}

/**
 * The week as a time-first list, one section per day. Days without classes
 * collapse to one line ("Free day", or the break's name).
 */
export async function ByDayView({ week }: { week: Week }) {
  const { t, intl } = await getI18n();
  return (
    <ol className="flex flex-col gap-2">
      {week.days.map((d) => {
        const heading = formatDate(d.date, { weekday: "short", day: "numeric", month: "short" }, intl);
        if (d.items.length === 0) {
          return (
            <li
              key={d.date}
              id={`day-${d.date}`}
              className={cn(
                "flex scroll-mt-24 items-center justify-between gap-3 border-border-soft border-b px-1 py-2.5 text-sm",
                d.isToday && "rounded-xl border-transparent bg-accent px-3",
              )}
            >
              <h3 className="font-medium">
                {heading}
                {d.isToday ? <span className="text-muted-foreground">{t(" · Today")}</span> : null}
              </h3>
              <span className="text-muted-foreground">
                {d.breakLabel ? t("No classes · {name}", { name: d.breakLabel }) : t("Free day")}
              </span>
            </li>
          );
        }
        return (
          <li key={d.date} id={`day-${d.date}`} className="scroll-mt-24 py-2">
            <section aria-labelledby={`day-${d.date}-h`} className="flex flex-col gap-2">
              <header
                className={cn(
                  "flex items-baseline justify-between gap-3 px-1",
                  d.isToday && "rounded-xl bg-accent px-3 py-1.5",
                )}
              >
                <h3 id={`day-${d.date}-h`} className="font-display font-medium text-lg">
                  {heading}
                  {d.isToday ? (
                    <span className="font-sans font-normal text-muted-foreground text-sm">{t(" · Today")}</span>
                  ) : null}
                </h3>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {countLabel(t, d.classCount, d.cancelledCount)}
                </span>
              </header>
              {d.breakId && d.breakLabel ? <BreakBanner id={d.breakId} label={d.breakLabel} /> : null}
              <ul className="flex flex-col gap-1.5">
                {d.items.map((item) => (
                  <li key={item.id}>
                    <OccurrenceRow item={item} />
                  </li>
                ))}
              </ul>
            </section>
          </li>
        );
      })}
      <li className="pt-2">
        <Link
          href={`/courses/timetable/new?weekday=${isoWeekday(week.days[0].date)}&week=${week.days[0].date}`}
          className="inline-flex items-center gap-1.5 rounded-md py-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <CalendarPlus aria-hidden className="size-4" />
          {t("Add a weekly class time")}
        </Link>
      </li>
    </ol>
  );
}
