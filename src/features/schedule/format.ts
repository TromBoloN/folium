import { addDays, type CivilDate, formatDate } from "@/lib/dates";
import { formatTime, toMinutes } from "../timetable/logic";
import type { Occurrence, Placement } from "./occurrences";

export type TimeFormat = "24h" | "12h";

/**
 * How a change is labelled. The same kinds and words appear on every screen:
 * cancelled (red), moved (amber), extra (dashed outline), room, online.
 */
export type ChipKind = "cancelled" | "moved" | "extra" | "room" | "online";
export type Chip = { kind: ChipKind; text: string };

/** "Wed 07:30", or just "07:30" when it's the same day as `sameDay`. */
export function placementLabel(p: Pick<Placement, "date" | "startTime">, format: TimeFormat, sameDay?: CivilDate) {
  const time = formatTime(p.startTime, format);
  return p.date === sameDay ? time : `${formatDate(p.date, { weekday: "short" })} ${time}`;
}

export function timeRange(o: { startTime: string; endTime: string }, format: TimeFormat) {
  return `${formatTime(o.startTime, format)}–${formatTime(o.endTime, format)}`;
}

type ChipSource = Pick<Occurrence, "status" | "date" | "from" | "room" | "label" | "online" | "breakLabel">;

export function occurrenceChips(o: ChipSource, format: TimeFormat): Chip[] {
  const chips: Chip[] = [];
  if (o.status === "cancelled") {
    chips.push({ kind: "cancelled", text: o.breakLabel ? `Cancelled · ${o.breakLabel}` : "Cancelled" });
  }
  if (o.status === "moved" && o.from)
    chips.push({ kind: "moved", text: `Moved from ${placementLabel(o.from, format, o.date)}` });
  if (o.status === "extra") chips.push({ kind: "extra", text: o.label ? `Extra · ${o.label}` : "Extra" });
  if (o.room && o.status !== "cancelled") chips.push({ kind: "room", text: `Room → ${o.room.to}` });
  if (o.online && o.status !== "cancelled") chips.push({ kind: "online", text: "Online" });
  return chips;
}

/** One sentence for screen readers and titles, e.g. "Calculus I, Wed 07:30–09:10, B2.04, cancelled: Dr. Siti unwell". */
export function describeOccurrence(o: Occurrence, format: TimeFormat): string {
  const parts = [
    o.course.name,
    `${formatDate(o.date, { weekday: "short", day: "numeric", month: "short" })} ${timeRange(o, format)}`,
  ];
  if (o.location) parts.push(o.location);
  const chips = occurrenceChips(o, format).map((c) => c.text.toLowerCase());
  let text = parts.join(", ");
  if (chips.length) text += `, ${chips.join(", ")}`;
  if (o.note && o.status !== "ghost") text += `: ${o.note}`;
  return text;
}

/** For "Next: …" lines: "On now, until 09:10", "Today 10:00", "Tomorrow 07:30", "Wed 10:00", "Wed 2 Dec 10:00". */
export function nextLabel(
  o: Pick<Occurrence, "date" | "startTime" | "endTime">,
  now: { date: CivilDate; minute: number },
  format: TimeFormat,
): string {
  const start = toMinutes(o.startTime);
  if (o.date === now.date && start <= now.minute) return `On now, until ${formatTime(o.endTime, format)}`;
  const time = formatTime(o.startTime, format);
  if (o.date === now.date) return `Today ${time}`;
  if (o.date === addDays(now.date, 1)) return `Tomorrow ${time}`;
  // Within the coming week the weekday is enough; further out, add the date.
  if (o.date <= addDays(now.date, 6)) return `${formatDate(o.date, { weekday: "short" })} ${time}`;
  return `${formatDate(o.date, { weekday: "short", day: "numeric", month: "short" })} ${time}`;
}

/** What a day-list row shows (see OccurrenceRow). The week view's items have the same fields. */
export type RowItem = {
  id: string;
  courseName: string;
  color: string;
  timeLabel: string;
  /** Shown above the time when rows span several days (e.g. a course's upcoming classes). */
  dateLabel?: string;
  location: string | null;
  status: Occurrence["status"];
  chips: Chip[];
  note: string | null;
  past: boolean;
  overlapsWith: string[];
};

export function toRowItem(o: Occurrence, format: TimeFormat, now: { date: CivilDate; minute: number }): RowItem {
  return {
    id: o.key,
    courseName: o.course.name,
    color: o.course.color,
    timeLabel: timeRange(o, format),
    dateLabel: formatDate(o.date, { weekday: "short", day: "numeric", month: "short" }),
    location: o.location,
    status: o.status,
    chips: occurrenceChips(o, format),
    note: o.note,
    past: o.date < now.date || (o.date === now.date && toMinutes(o.endTime) <= now.minute),
    overlapsWith: [],
  };
}
