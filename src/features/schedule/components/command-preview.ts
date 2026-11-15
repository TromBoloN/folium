"use client";

import { useClientData } from "@/features/tasks/components/client-data-store";
import { matchCourse } from "@/features/tasks/parse";
import { formatTime } from "@/features/timetable/logic";
import { formatDate, minutesNowIn, todayIn } from "@/lib/dates";
import { parseScheduleCommand, type ScheduleCommand } from "../command";

/**
 * If the palette text is a schedule command ("cancel physics tomorrow"), what
 * it will do, in words. The server parses and resolves it again before acting.
 */
export function useScheduleCommand(text: string): { command: ScheduleCommand; summary: string } | null {
  const data = useClientData();
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
    d ? formatDate(d, { weekday: "short", day: "numeric", month: "short" }) : "next class";
  if (command.kind === "break") {
    const range =
      command.startsOn === command.endsOn ? day(command.startsOn) : `${day(command.startsOn)} – ${day(command.endsOn)}`;
    return { command, summary: `No classes ${range}` };
  }
  const course = matchCourse(command.course, courses);
  const name = course ? (course.code ?? course.name) : command.course;
  if (command.kind === "cancel") return { command, summary: `Cancel ${name} · ${day(command.date)}` };
  if (command.kind === "room") return { command, summary: `${name} · ${day(command.date)}: room → ${command.room}` };
  const to = [command.to ? day(command.to) : null, command.time ? formatTime(command.time, data.timeFormat) : null]
    .filter(Boolean)
    .join(" ");
  return { command, summary: `Move ${name}${command.from ? ` (${day(command.from)})` : ""} → ${to}` };
}
