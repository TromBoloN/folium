import { describe, expect, it } from "vitest";
import { attendanceStats, meetingStats } from "./attendance";
import { meetingProgress } from "./meetings";
import { buildSchedule, type ClassChange, occurrenceKey, type ScheduleSlot } from "./occurrences";

const COURSE = { id: "c", name: "Physics I", code: "FIS101", color: "#e8590c", room: null };
const mon: ScheduleSlot = {
  id: "s",
  courseId: "c",
  course: COURSE,
  weekday: 1,
  startTime: "09:00",
  endTime: "10:40",
  startsOn: "2026-11-02",
  endsOn: "2026-12-28",
  location: null,
};
// Mondays 2, 9, 16, 23, 30 Nov and 7, 14, 21, 28 Dec: 9 classes.
const cancel9: ClassChange = {
  id: "x",
  kind: "cancelled",
  courseId: "c",
  slotId: "s",
  originalDate: "2026-11-09",
  newDate: null,
  startTime: null,
  endTime: null,
  location: null,
  label: null,
  note: null,
};
const term = buildSchedule({ slots: [mon], changes: [cancel9], breaks: [] }, { from: "2026-11-02", to: "2026-12-28" });
const now = { date: "2026-11-16", minute: 12 * 60 }; // after the 16 Nov class
const k = (d: string) => occurrenceKey("s", d);

describe("attendanceStats", () => {
  it("counts held classes only, and never cancelled ones", () => {
    const stats = attendanceStats(term, new Map(), now, 75, true);
    expect(stats).toMatchObject({ held: 2, attended: 0, missed: 0, unmarked: 2, percent: null, planned: 8 });
  });

  it("percent is attended over marked", () => {
    const marks = new Map([
      [k("2026-11-02"), "attended" as const],
      [k("2026-11-16"), "missed" as const],
    ]);
    expect(attendanceStats(term, marks, now, 75, true)).toMatchObject({
      attended: 1,
      missed: 1,
      unmarked: 0,
      percent: 50,
      belowTarget: true,
    });
  });

  it("knows how many more can be missed against the target", () => {
    // 8 classes, 75% target: 2 misses allowed.
    const marks = new Map([[k("2026-11-16"), "missed" as const]]);
    expect(attendanceStats(term, marks, now, 75, true).canMiss).toBe(1);
    expect(attendanceStats(term, new Map(), now, 75, true).canMiss).toBe(2);
    expect(attendanceStats(term, new Map(), now, 75, false)).toMatchObject({ planned: null, canMiss: null });
  });

  it("counts a planned absence ahead of time", () => {
    const marks = new Map([
      [k("2026-11-02"), "attended" as const],
      [k("2026-12-07"), "missed" as const],
    ]);
    const stats = attendanceStats(term, marks, now, 75, true);
    expect(stats).toMatchObject({ missed: 1, canMiss: 1 });
  });

  it("flags falling below the target by too many misses", () => {
    const marks = new Map(["2026-11-02", "2026-11-16", "2026-11-23"].map((d) => [k(d), "missed" as const] as const));
    const stats = attendanceStats(term, marks, { date: "2026-11-30", minute: 0 }, 75, true);
    expect(stats).toMatchObject({ canMiss: -1, belowTarget: true, percent: 0 });
  });

  it("a class on now isn't held yet", () => {
    const during = attendanceStats(term, new Map(), { date: "2026-11-16", minute: 9 * 60 + 30 }, 75, true);
    expect(during.held).toBe(1);
  });
});

describe("meetingStats", () => {
  it("computes held from logged rows plus unmarked, even with out-of-order meeting numbers", () => {
    const rows = [
      ...Array.from({ length: 14 }, (_, i) => ({
        courseId: "c",
        number: i + 1,
        status: "unknown" as const,
        key: null,
        date: null,
      })),
      { courseId: "c", number: 16, status: "attended" as const, key: k("2026-11-23"), date: "2026-11-23" },
    ];
    const progress = meetingProgress(rows, 16);
    expect(meetingStats(progress, 1, 75, null)).toMatchObject({
      held: 16,
      attended: 1,
      missed: 0,
      unknown: 14,
      unmarked: 1,
      planned: 16,
    });
  });
});
