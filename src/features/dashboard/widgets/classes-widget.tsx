import { io } from "next/cache";
import { listActiveSlots } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { addDays, todayIn } from "@/lib/dates";
import { selectTodaysClasses } from "../today";
import { DaySummary } from "./day-summary";
import { DayTimeline } from "./day-timeline";
import type { HeroClass } from "./next-up-hero";

/** Today's classes as a vertical timeline, with a live "now" line. */
export async function ClassesWidget() {
  const [slots, { preferences }] = await Promise.all([listActiveSlots(), getSettings()]);
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const toClass = (s: (typeof slots)[number]): HeroClass => ({
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
  const todays = selectTodaysClasses(slots, today).map(toClass);
  const tomorrow = selectTodaysClasses(slots, addDays(today, 1)).map(toClass);

  if (todays.length === 0) {
    return <DaySummary past={[]} tomorrow={tomorrow} timeFormat={preferences.timeFormat} />;
  }

  return (
    <DayTimeline
      initialNow={now.getTime()}
      timeZone={preferences.timeZone}
      timeFormat={preferences.timeFormat}
      classes={todays}
      tomorrow={tomorrow}
    />
  );
}
