import { MapPin } from "lucide-react";
import { io } from "next/cache";
import Link from "next/link";
import { listActiveSlots } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { formatTimeRange } from "@/features/timetable/format";
import { toMinutes } from "@/features/timetable/logic";
import { minutesNowIn, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { WidgetEmpty } from "../components/widget-frame";
import { classMoment, selectTodaysClasses } from "../today";

export async function ClassesWidget() {
  const [slots, { preferences }] = await Promise.all([listActiveSlots(), getSettings()]);
  await io();
  const now = new Date();
  const nowMinute = minutesNowIn(preferences.timeZone, now);
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

  const moment = classMoment(todays, nowMinute);
  const allOver = moment.current.length === 0 && moment.next === null;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {todays.map((slot) => {
          const isNow = moment.current.includes(slot.id);
          const isNext = moment.next === slot.id;
          const isPast = toMinutes(slot.endTime) <= nowMinute;
          const location = slot.location ?? slot.course.room;
          return (
            <li key={slot.id}>
              <Link
                href={`/courses/${slot.courseId}`}
                style={{ "--course": slot.course.color } as React.CSSProperties}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-l-(--course) border-l-4 px-3 py-2 transition-colors hover:bg-accent/50",
                  (isNow || isNext) && "bg-[color-mix(in_oklab,var(--course)_10%,var(--card))]",
                  isPast && "opacity-60",
                )}
              >
                <span className="w-24 shrink-0 text-muted-foreground text-sm tabular-nums">
                  {formatTimeRange(slot, preferences.timeFormat)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{slot.course.name}</span>
                  {location ? (
                    <span className="flex items-center gap-1 truncate text-muted-foreground text-xs">
                      <MapPin aria-hidden className="size-3" />
                      {location}
                    </span>
                  ) : null}
                </span>
                {isNow ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground text-xs">
                    Now
                  </span>
                ) : isNext ? (
                  <span className="rounded-full border border-primary px-2 py-0.5 font-medium text-primary text-xs">
                    Next
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {allOver ? <p className="text-muted-foreground text-xs">That&apos;s all your classes for today.</p> : null}
    </div>
  );
}
