import type { MeetingProgress } from "./meetings";

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
  /** Meetings from before counting started (status unknown): in no percentage. */
  unknown?: number;
};

/**
 * Attendance from the meeting log: marks (dated or by number) and how many
 * counted classes are over but not marked. Meetings from before counting
 * started are `unknown`, in no percentage. `plannedFallback` is the term's
 * class count when the course has no meeting total (from slot dates), if known.
 */
export function meetingStats(
  progress: MeetingProgress,
  unmarked: number,
  targetPercent: number,
  plannedFallback: number | null,
): AttendanceStats {
  const { attended, missed, unknown } = progress;
  const marked = attended + missed;
  const percent = marked > 0 ? (attended / marked) * 100 : null;
  const planned = progress.total ?? plannedFallback;
  const canMiss = planned === null ? null : Math.floor(planned * (1 - targetPercent / 100) + 1e-9) - missed;
  return {
    held: attended + missed + unknown + unmarked,
    attended,
    missed,
    unmarked,
    percent,
    planned,
    canMiss,
    belowTarget: (percent !== null && percent < targetPercent) || (canMiss !== null && canMiss < 0),
    unknown,
  };
}
