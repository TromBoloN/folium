import { io } from "next/cache";
import { upcomingNumbers } from "@/features/schedule/meetings";
import { isLive, liveOn } from "@/features/schedule/occurrences";
import { getMeetingLog, getSchedule } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { dueState, formatDue } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";
import { addDays, todayIn } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { toHeroClass } from "./hero-class";
import { NextUpHero } from "./next-up-hero";

/** The hero: what's on now or next, with a live countdown. Falls back to tomorrow, then the next deadline. */
export async function NextUpWidget() {
  const [tasks, { preferences }, i18n] = await Promise.all([listOpenTasks(), getSettings(), getI18n()]);
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const tomorrow = addDays(today, 1);
  const [schedule, log] = await Promise.all([getSchedule({ from: today, to: tomorrow }), getMeetingLog()]);
  const fmt = preferences.timeFormat;
  // Which meeting each class is (marked) or will log (not yet): "Meeting 7 of 16".
  const numbers = upcomingNumbers(schedule.filter(isLive), log.progress, new Set(log.marks.keys()));
  const hero = (o: (typeof schedule)[number]) => {
    const mark = log.marks.get(o.key) ?? null;
    const number = mark?.number ?? numbers.get(o.key) ?? null;
    const total = log.progress.get(o.courseId)?.total ?? null;
    return { ...toHeroClass(o, fmt, i18n), mark, meeting: number === null ? null : { number, total } };
  };
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
              due: formatDue(next, now, preferences.timeZone, preferences.timeFormat, i18n) ?? "",
              color: next.course?.color ?? null,
              course: next.course ? (next.course.code ?? next.course.name) : null,
            }
          : null
      }
    />
  );
}
