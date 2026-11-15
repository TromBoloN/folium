import { CheckCircle2 } from "lucide-react";
import { io } from "next/cache";
import { isLive, isPast } from "@/features/schedule/occurrences";
import { getSchedule, listAttendanceMarks } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { formatTime } from "@/features/timetable/logic";
import { addDays, minutesNowIn, todayIn } from "@/lib/dates";
import { AttendancePromptList } from "./attendance-prompt-list";

/**
 * "Did you go?" after each class: today's and yesterday's classes that are over
 * and not marked yet, newest first. One tap each; it disappears when none are left.
 */
export async function AttendancePrompt() {
  const { preferences } = await getSettings();
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const clock = { date: today, minute: minutesNowIn(preferences.timeZone, now) };
  const [schedule, marks] = await Promise.all([
    getSchedule({ from: addDays(today, -1), to: today }),
    listAttendanceMarks(),
  ]);
  const pending = schedule
    .filter((o) => isLive(o) && isPast(o, clock) && !marks.has(o.key))
    .reverse()
    .slice(0, 3)
    .map((o) => ({
      key: o.key,
      color: o.course.color,
      name: o.course.name,
      when: `${o.date === today ? "Today" : "Yesterday"} ${formatTime(o.startTime, preferences.timeFormat)}`,
    }));
  if (pending.length === 0) return null;
  return (
    <section
      aria-labelledby="attendance-prompt-h"
      className="tile reveal flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5"
    >
      <h2 id="attendance-prompt-h" className="flex shrink-0 items-center gap-2 font-medium sm:w-44 sm:pt-2">
        <CheckCircle2 aria-hidden className="size-5 text-primary" />
        Did you go?
      </h2>
      <AttendancePromptList items={pending} />
    </section>
  );
}
