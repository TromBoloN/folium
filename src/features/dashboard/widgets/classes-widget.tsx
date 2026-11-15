import { io } from "next/cache";
import Link from "next/link";
import { listActiveSlots } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { todayIn } from "@/lib/dates";
import { WidgetEmpty } from "../components/widget-frame";
import { selectTodaysClasses } from "../today";
import { DayTimeline } from "./day-timeline";

/** Today's classes as a vertical timeline, with a live "now" line. */
export async function ClassesWidget() {
  const [slots, { preferences }] = await Promise.all([listActiveSlots(), getSettings()]);
  await io();
  const now = new Date();
  const todays = selectTodaysClasses(slots, todayIn(preferences.timeZone, now));

  if (todays.length === 0) {
    return (
      <WidgetEmpty>
        No classes today.{" "}
        <Link href="/courses/timetable" className="text-foreground underline underline-offset-4">
          See the week
        </Link>
      </WidgetEmpty>
    );
  }

  return (
    <DayTimeline
      initialNow={now.getTime()}
      timeZone={preferences.timeZone}
      timeFormat={preferences.timeFormat}
      classes={todays.map((s) => ({
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
      }))}
    />
  );
}
