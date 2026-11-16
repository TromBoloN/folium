"use client";

import { useClientData } from "@/features/tasks/components/client-data-store";
import { matchCourse } from "@/features/tasks/parse";
import { formatTime } from "@/features/timetable/logic";
import { formatDate, minutesNowIn, todayIn } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";
import { parseScheduleCommand, type ScheduleCommand } from "../command";

/**
 * If the palette text is a schedule command ("cancel physics tomorrow"), what
 * it will do, in words. The server parses and resolves it again before acting.
 */
export function useScheduleCommand(text: string): { command: ScheduleCommand; summary: string } | null {
  const data = useClientData();
  const { t, intl } = useI18n();
  if (!data || text.trim().length < 6) return null;
  const now = new Date();
  const courses = data.courses.filter((c) => !c.archived);
  const command = parseScheduleCommand(
    text,
    { today: todayIn(data.timeZone, now), nowMinute: minutesNowIn(data.timeZone, now), weekStart: data.weekStart },
    courses,
  );
  if (!command) return null;
  const day = (d: string | null) =>
    d ? formatDate(d, { weekday: "short", day: "numeric", month: "short" }, intl) : t("next class");
  if (command.kind === "break") {
    const range =
      command.startsOn === command.endsOn ? day(command.startsOn) : `${day(command.startsOn)} – ${day(command.endsOn)}`;
    return { command, summary: t("No classes {range}", { range }) };
  }
  const course = matchCourse(command.course, courses);
  const name = course ? (course.code ?? course.name) : command.course;
  if (command.kind === "cancel")
    return { command, summary: t("Cancel {name} · {day}", { name, day: day(command.date) }) };
  if (command.kind === "room")
    return {
      command,
      summary: t("{name} · {day}: room → {room}", { name, day: day(command.date), room: command.room }),
    };
  const to = [command.to ? day(command.to) : null, command.time ? formatTime(command.time, data.timeFormat) : null]
    .filter(Boolean)
    .join(" ");
  return {
    command,
    summary: t("Move {name} → {to}", { name: `${name}${command.from ? ` (${day(command.from)})` : ""}`, to }),
  };
}
