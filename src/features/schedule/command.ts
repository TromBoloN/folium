import type { CivilDate } from "@/lib/dates";
import { bare, dayMonth, MONTH_NAMES, matchCourse, matchDate, matchTime, type ParseContext } from "../tasks/parse";
import { toMinutes } from "../timetable/logic";
import { isLive, isPast, type Occurrence } from "./occurrences";

/**
 * Typed schedule changes for the Ctrl/⌘K box. A small grammar, no AI:
 *
 *   cancel physics tomorrow        physics cancelled fri          no physics today
 *   calculus moved thu 10:00       move calculus from wed to thu 10:00
 *   FIS101 room B1.20 fri          room B1.20 for physics
 *   no classes 23-27 nov           no classes 23 nov to 27 nov exam week
 *
 * Dates and times use the task quick-add grammar. Without a date, the change
 * applies to the course's next class. A move keeps the class's length. The
 * course words must match one course (code or name, a unique prefix is fine),
 * otherwise it isn't a command and the text is added as a task instead.
 */

export type ScheduleCommand =
  | { kind: "cancel"; course: string; date: CivilDate | null }
  | { kind: "move"; course: string; from: CivilDate | null; to: CivilDate | null; time: string | null }
  | { kind: "room"; course: string; date: CivilDate | null; room: string }
  | { kind: "break"; startsOn: CivilDate; endsOn: CivilDate; label: string };

const FILLER = new Set([
  "for",
  "the",
  "class",
  "lecture",
  "on",
  "is",
  "to",
  "from",
  "at",
  "my",
  "has",
  "been",
  "was",
  "will",
  "be",
  "today's",
  "s",
]);
const CANCEL = new Set(["cancel", "cancelled", "canceled", "cancels", "off"]);
const MOVE = new Set(["move", "moved", "moves", "moving", "rescheduled", "reschedule", "→", "->"]);

/** "23-27 nov", "23–27 nov", "23 nov - 27 nov", "23 nov to 27 nov", "23/11-27/11". */
function matchRange(
  words: string[],
  i: number,
  ctx: ParseContext,
): { length: number; from: CivilDate; to: CivilDate } | null {
  const w = bare(words[i] ?? "");
  const next = bare(words[i + 1] ?? "");
  const compact = /^(\d{1,2})[-–](\d{1,2})$/.exec(w);
  if (compact && next in MONTH_NAMES) {
    const from = dayMonth(ctx.today, Number(compact[1]), MONTH_NAMES[next]);
    const to = dayMonth(ctx.today, Number(compact[2]), MONTH_NAMES[next]);
    return from && to ? { length: 2, from, to } : null;
  }
  const slashes = /^(\d{1,2}\/\d{1,2})[-–](\d{1,2}\/\d{1,2})$/.exec(w);
  if (slashes) {
    const a = matchDate([slashes[1]], 0, ctx);
    const b = matchDate([slashes[2]], 0, ctx);
    return a && b ? { length: 1, from: a.value, to: b.value } : null;
  }
  const first = matchDate(words, i, ctx);
  if (!first) return null;
  let j = i + first.length;
  const sep = bare(words[j] ?? "");
  if (sep === "-" || sep === "–" || sep === "to" || sep === "until" || sep === "till") j++;
  const second = matchDate(words, j, ctx);
  if (second && j > i + first.length) return { length: j + second.length - i, from: first.value, to: second.value };
  return { length: first.length, from: first.value, to: first.value };
}

/** A command, or null if the text isn't one (it's then a task). `courses` decides what counts as a course. */
export function parseScheduleCommand<T extends { code: string | null; name: string }>(
  input: string,
  ctx: ParseContext,
  courses: readonly T[],
): ScheduleCommand | null {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const lower = words.map(bare);

  // no classes <range> [label]
  if (lower[0] === "no" && (lower[1] === "classes" || lower[1] === "class" || lower[1] === "lectures")) {
    const range = matchRange(words, 2, ctx);
    if (!range || range.to < range.from) return null;
    const label = words
      .slice(2 + range.length)
      .join(" ")
      .trim();
    return { kind: "break", startsOn: range.from, endsOn: range.to, label: label || "No classes" };
  }

  let kind: "cancel" | "move" | "room" | null = null;
  let room: string | null = null;
  const dates: { value: CivilDate; afterFrom: boolean; afterTo: boolean }[] = [];
  let time: string | null = null;
  const rest: string[] = [];

  for (let i = 0; i < words.length; ) {
    const w = lower[i];
    if (i === 0 && w === "no") {
      kind ??= "cancel";
      i++;
      continue;
    }
    if (CANCEL.has(w)) {
      kind ??= "cancel";
      i++;
      continue;
    }
    if (MOVE.has(w)) {
      kind ??= "move";
      i++;
      continue;
    }
    if (w === "room" || w === "rm") {
      let j = i + 1;
      if (["to", "→", "->", "is", "now"].includes(lower[j] ?? "")) j++;
      const value = words[j];
      // A room has a digit in it (B1.20, 2.04, Lab 3), which keeps "room booking for physics" a task.
      if (!value || !/\d/.test(value)) return null;
      kind = "room";
      room = value.replace(/[,;]$/, "");
      i = j + 1;
      continue;
    }
    const date = matchDate(words, i, ctx);
    if (date) {
      dates.push({ value: date.value, afterFrom: lower[i - 1] === "from", afterTo: lower[i - 1] === "to" });
      i += date.length;
      continue;
    }
    const t = matchTime(words, i);
    if (t && !time) {
      time = t.value;
      i += t.length;
      continue;
    }
    rest.push(w);
    i++;
  }
  if (!kind) return null;

  const courseText = rest.filter((w) => !FILLER.has(w) && w !== "@").join(" ");
  if (!courseText || !matchCourse(courseText, courses)) return null;

  if (kind === "cancel") return { kind, course: courseText, date: dates[0]?.value ?? null };
  if (kind === "room") return room ? { kind, course: courseText, date: dates[0]?.value ?? null, room } : null;

  // move: "from X to Y", or a single date = where it goes.
  const from = dates.find((d) => d.afterFrom)?.value ?? (dates.length >= 2 ? dates[0].value : null);
  const to = dates.find((d) => d.afterTo)?.value ?? (dates.length >= 2 ? dates[1].value : (dates[0]?.value ?? null));
  if (!to && !time) return null;
  return { kind, course: courseText, from: from === to ? null : from, to, time };
}

// --- Resolving a command against the schedule --------------------------------

export type CommandPlan =
  | { action: "cancel"; occurrence: Occurrence }
  | { action: "move"; occurrence: Occurrence; date: CivilDate; startTime: string; endTime: string }
  | { action: "room"; occurrence: Occurrence; room: string }
  | { action: "break"; startsOn: CivilDate; endsOn: CivilDate; label: string };

const pad = (n: number) => String(n).padStart(2, "0");
function plusMinutes(time: string, minutes: number): string | null {
  const total = toMinutes(time) + minutes;
  if (total >= 24 * 60) return null;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/**
 * Which class a command means, in a schedule built from today onward:
 * the course's class on the given date, else its next class that hasn't ended.
 */
export function resolveCommand<T extends { id: string; code: string | null; name: string }>(
  command: ScheduleCommand,
  occurrences: readonly Occurrence[],
  courses: readonly T[],
  now: { date: CivilDate; minute: number },
): { ok: true; plan: CommandPlan } | { ok: false; error: string } {
  if (command.kind === "break") {
    return {
      ok: true,
      plan: { action: "break", startsOn: command.startsOn, endsOn: command.endsOn, label: command.label },
    };
  }
  const course = matchCourse(command.course, courses);
  if (!course) return { ok: false, error: `No course matches “${command.course}”.` };
  const date = command.kind === "move" ? command.from : command.date;
  const mine = occurrences.filter((o) => o.courseId === course.id && isLive(o));
  const occurrence = date ? mine.find((o) => o.date === date) : mine.find((o) => !isPast(o, now));
  const name = course.code ?? course.name;
  if (!occurrence)
    return { ok: false, error: date ? `${name} has no class that day.` : `${name} has no upcoming class.` };

  if (command.kind === "cancel") return { ok: true, plan: { action: "cancel", occurrence } };
  if (command.kind === "room") return { ok: true, plan: { action: "room", occurrence, room: command.room } };

  const startTime = command.time ?? occurrence.startTime;
  const endTime = plusMinutes(startTime, toMinutes(occurrence.endTime) - toMinutes(occurrence.startTime));
  if (!endTime) return { ok: false, error: "That would run past midnight." };
  return { ok: true, plan: { action: "move", occurrence, date: command.to ?? occurrence.date, startTime, endTime } };
}
