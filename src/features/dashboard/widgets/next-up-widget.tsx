import { io } from "next/cache";
import { listActiveSlots } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { dueState, formatDue } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";
import { addDays, todayIn } from "@/lib/dates";
import { selectTodaysClasses } from "../today";
import { type HeroClass, NextUpHero } from "./next-up-hero";

/** The hero: what's on now or next, with a live countdown. Falls back to tomorrow, then the next deadline. */
export async function NextUpWidget() {
  const [slots, tasks, { preferences }] = await Promise.all([listActiveSlots(), listOpenTasks(), getSettings()]);
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const toHero = (s: (typeof slots)[number]): HeroClass => ({
    id: s.id,
    courseId: s.courseId,
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    startsOn: s.startsOn,
    endsOn: s.endsOn,
    name: s.course.name,
    code: s.course.code,
    color: s.course.color,
    location: s.location ?? s.course.room,
  });
  // Open tasks come sorted by deadline; the first not yet overdue is the next one.
  const next = tasks.find((t) => t.dueAt && dueState(t, now, preferences.timeZone) !== "overdue");

  return (
    <NextUpHero
      initialNow={now.getTime()}
      serverToday={today}
      timeZone={preferences.timeZone}
      timeFormat={preferences.timeFormat}
      today={selectTodaysClasses(slots, today).map(toHero)}
      tomorrow={selectTodaysClasses(slots, addDays(today, 1)).map(toHero)}
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
