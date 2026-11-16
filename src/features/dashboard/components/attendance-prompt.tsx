import { CheckCircle2 } from "lucide-react";
import { io } from "next/cache";
import { isLive, isPast, type Occurrence } from "@/features/schedule/occurrences";
import { getSchedule, listAttendanceMarks, listPostponed } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { formatTime } from "@/features/timetable/logic";
import { addDays, type CivilDate, formatDate, minutesNowIn, todayIn } from "@/lib/dates";
import { AttendancePromptList } from "./attendance-prompt-list";

/**
 * "Did you go?" after each class: today's and yesterday's classes that are over
 * and not answered yet, newest first: attended, missed, rescheduled (to a date,
 * or "not decided yet") or cancelled. Below, classes still waiting for a new
 * date. It disappears when there's nothing to answer.
 */
export async function AttendancePrompt() {
  const { preferences } = await getSettings();
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const clock = { date: today, minute: minutesNowIn(preferences.timeZone, now) };
  const [schedule, marks, postponed] = await Promise.all([
    getSchedule({ from: addDays(today, -1), to: today }),
    listAttendanceMarks(),
    listPostponed(),
  ]);
  const dayLabel = (date: CivilDate) =>
    date === today
      ? "Today"
      : date === addDays(today, -1)
        ? "Yesterday"
        : formatDate(date, { weekday: "short", day: "numeric", month: "short" });
  const toItem = (o: Occurrence) => ({
    key: o.key,
    color: o.course.color,
    name: o.course.name,
    when: `${dayLabel(o.date)} ${formatTime(o.startTime, preferences.timeFormat)}`,
    date: o.date,
    startTime: o.startTime,
    endTime: o.endTime,
    location: o.location,
    canWait: o.slotId !== null,
  });
  const pending = schedule
    .filter((o) => isLive(o) && isPast(o, clock) && !marks.has(o.key))
    .reverse()
    .slice(0, 3)
    .map(toItem);
  const waiting = postponed.map(toItem);
  if (pending.length === 0 && waiting.length === 0) return null;
  return (
    <section
      aria-labelledby="attendance-prompt-h"
      className="tile reveal flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5"
    >
      <h2 id="attendance-prompt-h" className="flex shrink-0 items-center gap-2 font-medium sm:w-44 sm:pt-2">
        <CheckCircle2 aria-hidden className="size-5 text-primary" />
        {pending.length > 0 ? "Did you go?" : "Classes to reschedule"}
      </h2>
      <AttendancePromptList items={pending} waiting={waiting} />
    </section>
  );
}
