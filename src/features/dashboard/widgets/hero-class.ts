import { occurrenceChips, type TimeFormat } from "@/features/schedule/format";
import type { Occurrence } from "@/features/schedule/occurrences";
import { EN, type I18n } from "@/lib/i18n/core";
import type { HeroClass } from "./next-up-hero";

/** An occurrence as the Today widgets take it. */
export function toHeroClass(o: Occurrence, format: TimeFormat, i18n: I18n = EN): HeroClass {
  return {
    key: o.key,
    id: o.key,
    courseId: o.courseId,
    weekday: o.weekday,
    startTime: o.startTime,
    endTime: o.endTime,
    startsOn: o.startsOn,
    endsOn: o.endsOn,
    name: o.course.name,
    code: o.course.code,
    color: o.course.color,
    location: o.location,
    cancelled: o.status === "cancelled",
    postponed: o.status === "postponed",
    // Cancelled classes are shown struck through; their red chip would repeat that.
    chips: occurrenceChips(o, format, i18n).filter((c) => c.kind !== "cancelled"),
    note: o.note,
    meetingUrl: o.meetingUrl,
  };
}
