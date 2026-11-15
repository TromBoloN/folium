import { io } from "next/cache";
import Link from "next/link";
import { listActiveSlots } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { listOpenTasks } from "@/features/tasks/queries";
import { weekDates } from "@/features/timetable/logic";
import { formatDate, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { type DayLoad, weekLoad } from "../now";

const MAX_DOTS = 5;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** This week as seven columns: class dots in course colours, deadline bars, and shading by how full the day is. */
export async function WeekWidget() {
  const [slots, tasks, { preferences }] = await Promise.all([listActiveSlots(), listOpenTasks(), getSettings()]);
  await io();
  const today = todayIn(preferences.timeZone, new Date());
  const days = weekLoad(weekDates(today, preferences.weekStart), slots, tasks, preferences.timeZone, today);
  const totalClasses = days.reduce((n, d) => n + d.classes.length, 0);
  const totalDeadlines = days.reduce((n, d) => n + d.deadlines, 0);
  const busiest = days
    .filter((d) => d.date >= today)
    .reduce<DayLoad | null>((top, d) => (d.intensity > (top?.intensity ?? 0) ? d : top), null);

  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          // Past days stay plain: the shading is for what's still ahead.
          const past = d.date < today;
          // Read as e.g. "Mon 16 November (today): 3 classes, 2 deadlines"; the visible day and number are part of it.
          const details = ` ${formatDate(d.date, { month: "long" })}${d.isToday ? " (today)" : ""}: ${plural(d.classes.length, "class", "classes")}, ${plural(d.deadlines, "deadline", "deadlines")}`;
          return (
            <li key={d.date} className="reveal" style={{ "--i": i + 2 } as React.CSSProperties}>
              <Link
                href={`/courses/timetable?week=${d.date}`}
                aria-current={d.isToday ? "date" : undefined}
                className={cn(
                  "flex h-full min-h-32 flex-col items-center gap-2 rounded-xl px-1 pt-2 pb-2.5 transition-transform duration-(--dur-fast) hover:-translate-y-0.5",
                  past && "text-muted-foreground",
                  d.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-(--surface-1)",
                )}
                style={{ background: past || d.intensity === 0 ? "var(--muted)" : `var(--load-${d.intensity})` }}
              >
                <span className="font-medium text-xs">
                  {formatDate(d.date, { weekday: "narrow" })}
                  <span className="hidden @xl:inline">{formatDate(d.date, { weekday: "short" }).slice(1)}</span>
                </span>
                <span className="font-display font-medium text-xl tabular-nums leading-none">
                  {formatDate(d.date, { day: "numeric" })}
                </span>
                <span className="sr-only">{details}</span>
                <span aria-hidden className="flex max-w-full flex-wrap justify-center gap-1">
                  {d.classes.slice(0, MAX_DOTS).map((c) => (
                    <span
                      key={c.id}
                      className="size-2 rounded-full bg-(--tint) ring-1 ring-(--surface-1)"
                      style={{ "--tint": c.color } as React.CSSProperties}
                    />
                  ))}
                  {d.classes.length > MAX_DOTS ? (
                    <span className="text-[0.625rem] leading-2">+{d.classes.length - MAX_DOTS}</span>
                  ) : null}
                </span>
                <span aria-hidden className="mt-auto flex h-5 items-end gap-0.5">
                  {Array.from({ length: Math.min(d.deadlines, 4) }, (_, k) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: identical bars
                      key={k}
                      className="grow-y w-1.5 rounded-full bg-current"
                      style={{ height: `${10 + k * 3}px`, "--i": i } as React.CSSProperties}
                    />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          {plural(totalClasses, "class", "classes")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-1.5 rounded-full bg-foreground" />
          {plural(totalDeadlines, "deadline", "deadlines")}
        </span>
        {busiest ? (
          <span>
            Busiest ahead: <span className="text-foreground">{formatDate(busiest.date, { weekday: "long" })}</span>
          </span>
        ) : null}
      </p>
    </div>
  );
}
