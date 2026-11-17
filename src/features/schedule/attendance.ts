import type { CivilDate } from "@/lib/dates";
import { isLive, isPast, type Occurrence } from "./occurrences";
import type { AttendanceStatus } from "./schema";

export type AttendanceStats = {
  /** Classes that took place and are over (cancelled ones never count). */
  held: number;
  attended: number;
  missed: number;
  unmarked: number;
  /** attended / (attended + missed), 0–100; null until something is marked. */
  percent: number | null;
  /** All classes in the term (held + still to come), when the term's end is known. */
  planned: number | null;
  /** How many more classes can be missed and still meet the target; null without a known term. */
  canMiss: number | null;
  belowTarget: boolean;
};

/**
 * Attendance for one course. `occurrences` is the course's schedule for the
 * whole term (from buildSchedule), `marks` are keyed by occurrence key.
 * The target is a minimum share of ALL classes in the term, as campuses
 * usually define it; unmarked past classes are not assumed either way.
 */
export function attendanceStats(
  occurrences: readonly Occurrence[],
  marks: ReadonlyMap<string, AttendanceStatus>,
  now: { date: CivilDate; minute: number },
  targetPercent: number,
  termKnown: boolean,
  /** The course's meeting count, when set: the term is that many meetings, whatever the dates say. */
  totalMeetings: number | null = null,
): AttendanceStats {
  const live = occurrences.filter(isLive);
  const held = live.filter((o) => isPast(o, now));
  let attended = 0;
  let missed = 0;
  for (const o of held) {
    const mark = marks.get(o.key);
    if (mark === "attended") attended++;
    else if (mark === "missed") missed++;
  }
  // Marks on classes still to come (e.g. "I'll miss Friday") count too.
  for (const o of live) {
    if (!isPast(o, now) && marks.get(o.key) === "missed") missed++;
  }
  const marked = attended + missed;
  const percent = marked > 0 ? (attended / marked) * 100 : null;
  const planned = totalMeetings ?? (termKnown ? live.length : null);
  const allowedMisses = planned === null ? null : Math.floor(planned * (1 - targetPercent / 100) + 1e-9);
  const canMiss = allowedMisses === null ? null : allowedMisses - missed;
  return {
    held: held.length,
    attended,
    missed,
    unmarked: held.length - held.filter((o) => marks.has(o.key)).length,
    percent,
    planned,
    canMiss,
    belowTarget: (percent !== null && percent < targetPercent) || (canMiss !== null && canMiss < 0),
  };
}
