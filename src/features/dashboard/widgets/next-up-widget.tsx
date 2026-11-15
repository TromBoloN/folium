import { io } from "next/cache";
import { isLive, liveOn } from "@/features/schedule/occurrences";
import { getSchedule } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { dueState, formatDue } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";
import { addDays, todayIn } from "@/lib/dates";
import { toHeroClass } from "./hero-class";
import { NextUpHero } from "./next-up-hero";

/** The hero: what's on now or next, with a live countdown. Falls back to tomorrow, then the next deadline. */
export async function NextUpWidget() {
  const [tasks, { preferences }] = await Promise.all([listOpenTasks(), getSettings()]);
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const tomorrow = addDays(today, 1);
  const schedule = await getSchedule({ from: today, to: tomorrow });
  const fmt = preferences.timeFormat;
  const hero = (o: (typeof schedule)[number]) => toHeroClass(o, fmt);
  // Open tasks come sorted by deadline; the first not yet overdue is the next one.
  const next = tasks.find((t) => t.dueAt && dueState(t, now, preferences.timeZone) !== "overdue");

  return (
    <NextUpHero
      initialNow={now.getTime()}
      serverToday={today}
      timeZone={preferences.timeZone}
      timeFormat={fmt}
      today={liveOn(schedule, today).map(hero)}
      tomorrow={liveOn(schedule, tomorrow).map(hero)}
      cancelled={schedule.filter((o) => o.date === today && !isLive(o) && o.status === "cancelled").map(hero)}
      deadline={
        next
          ? {
              id: next.id,
              title: next.title,
              due: formatDue(next, now, preferences.timeZone, preferences.timeFormat) ?? "",
              color: next.course?.color ?? null,
              course: next.course ? (next.course.code ?? next.course.name) : null,
            }
          : null
      }
    />
  );
}
