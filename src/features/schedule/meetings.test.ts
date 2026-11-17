import { describe, expect, it } from "vitest";
import {
  isCounted,
  type MeetingRow,
  meetingList,
  meetingProgress,
  progressByCourse,
  projectedEnd,
  skipsLeft,
  upcomingNumbers,
} from "./meetings";

const row = (number: number, status: MeetingRow["status"], date: string | null = null): MeetingRow => ({
  courseId: "c1",
  number,
  status,
  key: date ? `s.slot.${date}` : null,
  date,
});

describe("meetingProgress", () => {
  it("starts at meeting 1 with nothing logged", () => {
    expect(meetingProgress([], 16)).toMatchObject({ next: 1, total: 16, finished: false, endedOn: null });
  });

  it("is at the next unlogged number; unknown meetings count as logged but not as attended", () => {
    const rows = [
      row(1, "unknown"),
      row(2, "unknown"),
      row(3, "attended", "2026-11-02"),
      row(4, "missed", "2026-11-09"),
    ];
    expect(meetingProgress(rows, 16)).toMatchObject({ next: 5, attended: 1, missed: 1, unknown: 2 });
  });

  it("finishes after the last meeting, ending on its day", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row(i + 1, "attended", `2026-11-${String(i + 10).padStart(2, "0")}`),
    );
    expect(meetingProgress(rows, 8)).toMatchObject({ next: 9, finished: true, endedOn: "2026-11-17" });
  });

  it("never finishes when open-ended", () => {
    expect(meetingProgress([row(40, "attended", "2026-11-10")], null)).toMatchObject({ next: 41, finished: false });
  });
});

describe("skipsLeft", () => {
  const at = (attended: number, missed: number, total: number | null = 16) =>
    meetingProgress(
      [
        ...Array.from({ length: attended }, (_, i) => row(i + 1, "attended", "2026-11-01")),
        ...Array.from({ length: missed }, (_, i) => row(attended + i + 1, "missed", "2026-11-01")),
      ],
      total,
    );

  it("16 meetings at 75% allow 4 skips", () => {
    expect(skipsLeft(at(3, 0), 75)).toBe(4);
    expect(skipsLeft(at(3, 2), 75)).toBe(2);
    expect(skipsLeft(at(3, 5), 75)).toBe(-1);
  });

  it("needs a total and at least one real mark", () => {
    expect(skipsLeft(at(0, 0), 75)).toBeNull();
    expect(skipsLeft(at(2, 0, null), 75)).toBeNull();
    expect(skipsLeft(meetingProgress([row(1, "unknown")], 16), 75)).toBeNull();
  });
});

describe("upcomingNumbers", () => {
  const progress = progressByCourse(
    [row(1, "attended", "2026-11-02"), row(2, "attended", "2026-11-09")],
    [
      { id: "c1", totalMeetings: 3 },
      { id: "c2", totalMeetings: null },
    ],
  );

  it("numbers unmarked classes per course in date order, up to the total", () => {
    const classes = [
      { key: "a", courseId: "c1", date: "2026-11-16", endTime: "10:00" },
      { key: "b", courseId: "c2", date: "2026-11-16", endTime: "10:00" },
      { key: "c", courseId: "c1", date: "2026-11-17", endTime: "10:00" },
      { key: "d", courseId: "c2", date: "2026-11-17", endTime: "10:00" },
    ];
    expect(Object.fromEntries(upcomingNumbers(classes, progress, new Set()))).toEqual({ a: 3, b: 1, d: 2 });
  });

  it("skips classes already marked", () => {
    const classes = [
      { key: "a", courseId: "c2", date: "2026-11-16", endTime: "10:00" },
      { key: "b", courseId: "c2", date: "2026-11-16", endTime: "10:00" },
    ];
    expect(Object.fromEntries(upcomingNumbers(classes, progress, new Set(["a"])))).toEqual({ b: 1 });
  });
});

describe("counting start and the projected end", () => {
  const cls = (key: string, date: string, endTime = "10:00") => ({ key, courseId: "c1", date, endTime });
  // Set "next meeting is 15" on Tue 17 Nov at 05:00, after that day's 02:40-04:10 class.
  const p = meetingProgress(
    Array.from({ length: 14 }, (_, i) => row(i + 1, "unknown")),
    16,
    { date: "2026-11-17", minute: 300 },
  );
  const classes = [
    cls("nov17", "2026-11-17", "04:10"),
    cls("nov24", "2026-11-24", "04:10"),
    cls("dec1", "2026-12-01", "04:10"),
    cls("dec8", "2026-12-08", "04:10"),
  ];

  it("classes over before counting started are the backfilled meetings, not new ones", () => {
    expect(isCounted(classes[0], p.countFrom)).toBe(false);
    expect(isCounted(classes[1], p.countFrom)).toBe(true);
    expect(Object.fromEntries(upcomingNumbers(classes, new Map([["c1", p]]), new Set()))).toEqual({
      nov24: 15,
      dec1: 16,
    });
  });

  it("ends on the class that will be the last meeting", () => {
    expect(projectedEnd(classes, p, new Set())).toBe("2026-12-01");
    expect(projectedEnd(classes, { ...p, total: null }, new Set())).toBeNull();
  });
});

describe("meetingList", () => {
  it("lists meetings by number, newest first; backfilled ones have no date", () => {
    const rows = [row(1, "unknown"), row(2, "attended"), { ...row(3, "missed", "2026-11-16"), key: "s.x.2026-11-16" }];
    expect(meetingList(rows, [{ key: "s.x.2026-11-23", date: "2026-11-23" }])).toEqual([
      { number: null, status: null, key: "s.x.2026-11-23", date: "2026-11-23" },
      { number: 3, status: "missed", key: "s.x.2026-11-16", date: "2026-11-16" },
      { number: 2, status: "attended", key: null, date: null },
      { number: 1, status: "unknown", key: null, date: null },
    ]);
  });
});
