import { io } from "next/cache";
import { isListed, liveOn } from "@/features/schedule/occurrences";
import { getSchedule } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { addDays, todayIn } from "@/lib/dates";
import { DaySummary } from "./day-summary";
import { DayTimeline } from "./day-timeline";
import { toHeroClass } from "./hero-class";

/** Today's classes as a vertical timeline, with a live "now" line. Cancelled ones stay, dimmed. */
export async function ClassesWidget() {
  const { preferences } = await getSettings();
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const tomorrow = addDays(today, 1);
  const schedule = await getSchedule({ from: today, to: tomorrow });
  const fmt = preferences.timeFormat;
  const todays = schedule.filter((o) => o.date === today && isListed(o)).map((o) => toHeroClass(o, fmt));
  const next = liveOn(schedule, tomorrow).map((o) => toHeroClass(o, fmt));

  if (todays.every((c) => c.cancelled)) {
    return <DaySummary past={[]} cancelled={todays} tomorrow={next} timeFormat={fmt} />;
  }

  return (
    <DayTimeline
      initialNow={now.getTime()}
      timeZone={preferences.timeZone}
      timeFormat={fmt}
      classes={todays}
      tomorrow={next}
    />
  );
}
