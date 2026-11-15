import { addDays, type CivilDate, isCivilDate, isoWeekday } from "@/lib/dates";
import { type WeekStart, weekDates } from "../timetable/logic";
import type { TaskPriority } from "./schema";

/**
 * Plain-text quick add: "Essay outline tomorrow 5pm #ING101 !high".
 * No AI, just a small grammar. Recognised pieces are taken out of the title;
 * the first of each kind wins and anything later stays in the title.
 *
 * - Dates: today, tonight, tomorrow (tmr, tmrw), a weekday (mon … sunday: the
 *   next one after today), next <weekday> (that day next week), next week (its
 *   first day), in N days/weeks, 23 nov / nov 23 / 23/11 (day/month, this year
 *   or next if already past), 2026-11-23. "due", "on" and "by" before a date are dropped.
 * - Times: 5pm, 5:30pm, 5 pm, 17:00, noon; "at" or "@" before them is dropped.
 *   A time with no date means today, or tomorrow if that time has passed.
 * - Course: #code or #name (matched later with matchCourse).
 * - Priority: !low, !med(ium), !high, !urgent, !! (high), !!! (urgent).
 */

/** Shown next to quick-add fields. */
export const QUICK_ADD_HINT = "Try “Essay outline tomorrow 5pm #ING101 !high”";

export type QuickAddToken = { kind: "date" | "time" | "course" | "priority"; text: string };

export type ParsedQuickAdd = {
  title: string;
  dueDate: CivilDate | null;
  dueTime: string | null;
  priority: TaskPriority | null;
  course: string | null;
  tokens: QuickAddToken[];
};

export type ParseContext = { today: CivilDate; nowMinute: number; weekStart: WeekStart };

const WEEKDAY_NAMES: Record<string, number> = {
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7,
};
export const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
const PRIORITIES: Record<string, TaskPriority> = {
  "!low": "low",
  "!med": "medium",
  "!medium": "medium",
  "!high": "high",
  "!urgent": "urgent",
  "!!": "high",
  "!!!": "urgent",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The next date after `today` falling on ISO weekday `day` (1–7): never today itself. */
function nextWeekday(today: CivilDate, day: number): CivilDate {
  const diff = (day - isoWeekday(today) + 7) % 7 || 7;
  return addDays(today, diff);
}

/** A day/month with no year: this year, or next year if it has already passed. */
export function dayMonth(today: CivilDate, day: number, month: number): CivilDate | null {
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${pad(month)}-${pad(day)}`;
  if (!isCivilDate(thisYear)) return null;
  return thisYear >= today ? thisYear : `${year + 1}-${pad(month)}-${pad(day)}`;
}

/** Strip punctuation a sentence might leave around a token ("tomorrow," "(5pm)"). */
export function bare(word: string) {
  return word.toLowerCase().replace(/^[("']+|[),.;:'"]+$/g, "");
}

export type Match = { length: number; value: string };

export function matchDate(words: string[], i: number, ctx: ParseContext): Match | null {
  const w = bare(words[i] ?? "");
  const next = bare(words[i + 1] ?? "");
  if (w === "today" || w === "tonight" || w === "tod") return { length: 1, value: ctx.today };
  if (w === "tomorrow" || w === "tmr" || w === "tmrw") return { length: 1, value: addDays(ctx.today, 1) };
  if (w === "next" && next === "week") return { length: 2, value: addDays(weekDates(ctx.today, ctx.weekStart)[0], 7) };
  if (w === "next" && next in WEEKDAY_NAMES) {
    const nextWeek = weekDates(addDays(weekDates(ctx.today, ctx.weekStart)[0], 7), ctx.weekStart);
    const value = nextWeek.find((d) => isoWeekday(d) === WEEKDAY_NAMES[next]);
    return value ? { length: 2, value } : null;
  }
  if (w in WEEKDAY_NAMES) return { length: 1, value: nextWeekday(ctx.today, WEEKDAY_NAMES[w]) };
  if (w === "in" && /^\d{1,3}$/.test(next)) {
    const unit = bare(words[i + 2] ?? "");
    const n = Number(next);
    if (unit === "day" || unit === "days") return { length: 3, value: addDays(ctx.today, n) };
    if (unit === "week" || unit === "weeks") return { length: 3, value: addDays(ctx.today, n * 7) };
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(w) && isCivilDate(w)) return { length: 1, value: w };
  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(w);
  if (slash) {
    const value = dayMonth(ctx.today, Number(slash[1]), Number(slash[2]));
    return value ? { length: 1, value } : null;
  }
  if (/^\d{1,2}$/.test(w) && next in MONTH_NAMES) {
    const value = dayMonth(ctx.today, Number(w), MONTH_NAMES[next]);
    return value ? { length: 2, value } : null;
  }
  if (w in MONTH_NAMES && /^\d{1,2}(st|nd|rd|th)?$/.test(next)) {
    const value = dayMonth(ctx.today, Number.parseInt(next, 10), MONTH_NAMES[w]);
    return value ? { length: 2, value } : null;
  }
  return null;
}

export function matchTime(words: string[], i: number): Match | null {
  const w = bare(words[i] ?? "");
  const next = bare(words[i + 1] ?? "");
  if (w === "noon") return { length: 1, value: "12:00" };
  const ampm = (h: number, m: number, suffix: string) => {
    if (h < 1 || h > 12 || m > 59) return null;
    const hour = (h % 12) + (suffix === "pm" ? 12 : 0);
    return `${pad(hour)}:${pad(m)}`;
  };
  let m = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(w);
  if (m) {
    const value = ampm(Number(m[1]), Number(m[2] ?? 0), m[3]);
    return value ? { length: 1, value } : null;
  }
  m = /^(\d{1,2})(?::(\d{2}))?$/.exec(w);
  if (m && (next === "am" || next === "pm")) {
    const value = ampm(Number(m[1]), Number(m[2] ?? 0), next);
    return value ? { length: 2, value } : null;
  }
  m = /^(\d{1,2})[:.](\d{2})$/.exec(w);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return { length: 1, value: `${pad(Number(m[1]))}:${m[2]}` };
  return null;
}

export function parseQuickAdd(input: string, ctx: ParseContext): ParsedQuickAdd {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  const tokens: QuickAddToken[] = [];
  let dueDate: CivilDate | null = null;
  let dueTime: string | null = null;
  let priority: TaskPriority | null = null;
  let course: string | null = null;

  for (let i = 0; i < words.length; ) {
    const w = bare(words[i]);
    const take = (kind: QuickAddToken["kind"], from: number, length: number) => {
      tokens.push({ kind, text: words.slice(from, from + length).join(" ") });
      i = from + length;
    };

    if (!priority && w in PRIORITIES) {
      priority = PRIORITIES[w];
      take("priority", i, 1);
      continue;
    }
    const hash = /^#([\p{L}\p{N}_-]+)/u.exec(words[i]);
    if (!course && hash) {
      course = hash[1];
      take("course", i, 1);
      continue;
    }
    // A connector word ("due friday", "at 5pm") goes with the token after it.
    const lead = ["due", "on", "by"].includes(w) ? 1 : 0;
    const date: Match | null = dueDate ? null : matchDate(words, i + lead, ctx);
    if (date) {
      dueDate = date.value;
      take("date", i, lead + date.length);
      continue;
    }
    const timeLead = w === "at" || w === "@" ? 1 : 0;
    const time: Match | null = dueTime ? null : matchTime(words, i + timeLead);
    if (time) {
      dueTime = time.value;
      take("time", i, timeLead + time.length);
      continue;
    }
    kept.push(words[i]);
    i++;
  }

  const title = kept
    .join(" ")
    .replace(/[\s,;:-]+$/, "")
    .trim();
  // Nothing left to call the task: treat the whole input as its title.
  if (!title) {
    return { title: input.trim(), dueDate: null, dueTime: null, priority: null, course: null, tokens: [] };
  }
  if (dueTime && !dueDate) {
    const [h, m] = dueTime.split(":").map(Number);
    dueDate = h * 60 + m > ctx.nowMinute ? ctx.today : addDays(ctx.today, 1);
  }
  return { title, dueDate, dueTime, priority, course, tokens };
}

/**
 * The course a #token refers to: exact code or name first (case-insensitive,
 * spaces ignored), then a unique prefix. Null when nothing or several match.
 */
export function matchCourse<T extends { code: string | null; name: string }>(
  token: string,
  courses: readonly T[],
): T | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  const t = norm(token);
  if (!t) return null;
  const exact = courses.filter((c) => (c.code && norm(c.code) === t) || norm(c.name) === t);
  if (exact.length === 1) return exact[0];
  const prefix = courses.filter((c) => (c.code && norm(c.code).startsWith(t)) || norm(c.name).startsWith(t));
  return prefix.length === 1 ? prefix[0] : null;
}
