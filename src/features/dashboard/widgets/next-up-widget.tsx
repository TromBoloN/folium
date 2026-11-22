import { io } from "next/cache";
import { upcomingNumbers } from "@/features/schedule/meetings";
import { isLive, liveOn } from "@/features/schedule/occurrences";
import { getMeetingLog, getSchedule } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { addDays, todayIn } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { toHeroClass } from "./hero-class";
import { NextUpHero } from "./next-up-hero";

/** The hero: only the class on now or next (or tomorrow when today has none); otherwise "Done for today". */
export async function NextUpWidget() {
  const [{ preferences }, i18n] = await Promise.all([getSettings(), getI18n()]);
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

  return (
    <NextUpHero
      initialNow={now.getTime()}
      serverToday={today}
      timeZone={preferences.timeZone}
      timeFormat={fmt}
      today={liveOn(schedule, today).map(hero)}
      tomorrow={liveOn(schedule, tomorrow).map(hero)}
    />
  );
}
