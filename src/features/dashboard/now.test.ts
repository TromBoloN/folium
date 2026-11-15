import { describe, expect, it } from "vitest";
import { dueAtFrom } from "../tasks/due";
import {
  countdownText,
  formatDuration,
  type LoadSlot,
  loadIntensity,
  nextUp,
  nowOffset,
  timelinePosition,
  timelineRange,
  weekLoad,
} from "./now";

const slot = (id: string, startTime: string, endTime: string, weekday = 1): LoadSlot => ({
  id,
  weekday,
  startTime,
  endTime,
  startsOn: null,
  endsOn: null,
  courseId: `c-${id}`,
  course: { color: `#${id.padEnd(6, "0").slice(0, 6)}`, name: id },
});
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("nextUp", () => {
  const today = [slot("a", "08:00", "10:00"), slot("b", "10:00", "11:40"), slot("c", "13:00", "14:40")];
  const tomorrow = [slot("t2", "09:00", "10:00", 2), slot("t1", "07:30", "09:10", 2)];

  it("before the first class: next, with a countdown and the one after", () => {
    const up = nextUp(today, tomorrow, at("07:35"));
    expect(up).toMatchObject({ kind: "next", minutesUntil: 25 });
    if (up.kind === "next") {
      expect(up.slot.id).toBe("a");
      expect(up.after?.id).toBe("b");
    }
  });

  it("during a class: now, with minutes left and progress", () => {
    const up = nextUp(today, tomorrow, at("09:20"));
    expect(up).toMatchObject({ kind: "now", minutesLeft: 40, progress: 80 / 120 });
    if (up.kind === "now") expect(up.after?.id).toBe("b");
  });

  it("at a back-to-back boundary the new class is on now", () => {
    const up = nextUp(today, tomorrow, at("10:00"));
    expect(up.kind === "now" && up.slot.id).toBe("b");
  });

  it("with overlapping classes, shows the one ending first", () => {
    const overlap = [slot("long", "09:00", "12:00"), slot("short", "10:00", "11:00")];
    const up = nextUp(overlap, [], at("10:30"));
    expect(up.kind === "now" && up.slot.id).toBe("short");
  });

  it("after the last class: tomorrow's earliest class", () => {
    const up = nextUp(today, tomorrow, at("15:00"));
    expect(up.kind === "tomorrow" && up.slot.id).toBe("t1");
  });

  it("nothing today or tomorrow: none", () => {
    expect(nextUp([], [], at("12:00"))).toEqual({ kind: "none" });
  });
});

describe("countdown text", () => {
  it("formats durations", () => {
    expect(formatDuration(25)).toBe("25 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(85)).toBe("1 h 25 min");
    expect(formatDuration(-3)).toBe("0 min");
  });

  it("reads naturally before and during a class", () => {
    expect(countdownText({ kind: "next", minutesUntil: 25 })).toBe("in 25 min");
    expect(countdownText({ kind: "next", minutesUntil: 0 })).toBe("Starting now");
    expect(countdownText({ kind: "now", minutesLeft: 40 })).toBe("Now, ends in 40 min");
  });
});

describe("timeline", () => {
  const todays = [slot("a", "07:30", "09:10"), slot("b", "13:00", "15:30")];

  it("spans whole hours around the classes", () => {
    expect(timelineRange(todays)).toEqual({ start: 7 * 60, end: 16 * 60 });
    expect(timelineRange([])).toBeNull();
  });

  it("is at least three hours tall", () => {
    expect(timelineRange([slot("x", "10:00", "11:00")])).toEqual({ start: 600, end: 780 });
  });

  it("positions classes as percentages", () => {
    const range = { start: 420, end: 960 }; // 07:00–16:00, 540 minutes
    expect(timelinePosition(todays[0], range)).toEqual({ top: (30 / 540) * 100, height: (100 / 540) * 100 });
  });

  it("places the now line, or hides it outside the range", () => {
    const range = { start: 420, end: 960 };
    expect(nowOffset(at("07:00"), range)).toBe(0);
    expect(nowOffset(at("11:30"), range)).toBe(50);
    expect(nowOffset(at("16:00"), range)).toBe(100);
    expect(nowOffset(at("06:59"), range)).toBeNull();
    expect(nowOffset(at("16:01"), range)).toBeNull();
  });
});

describe("weekLoad", () => {
  const TZ = "Asia/Makassar"; // UTC+8
  const dates = ["2026-11-16", "2026-11-17", "2026-11-18"]; // Mon–Wed

  it("counts classes per weekday and open deadlines per local date", () => {
    const load = weekLoad(
      dates,
      [slot("a", "08:00", "10:00", 1), slot("b", "13:00", "14:00", 1), slot("c", "08:00", "09:00", 3)],
      [
        { dueAt: dueAtFrom("2026-11-16", "14:00", TZ), dueHasTime: true, status: "todo" },
        { dueAt: dueAtFrom("2026-11-16", null, TZ), dueHasTime: false, status: "in_progress" },
        { dueAt: dueAtFrom("2026-11-16", null, TZ), dueHasTime: false, status: "done" },
        { dueAt: null, dueHasTime: false, status: "todo" },
      ],
      TZ,
      "2026-11-17",
    );
    expect(load.map((d) => [d.classes.length, d.classMinutes, d.deadlines, d.isToday])).toEqual([
      [2, 180, 2, false],
      [0, 0, 0, true],
      [1, 60, 0, false],
    ]);
  });

  it("puts a deadline on its Makassar date, not its UTC date", () => {
    // 00:30 on Tue 17 Nov in Makassar is still Mon 16 Nov in UTC (16:30Z).
    const early = dueAtFrom("2026-11-17", "00:30", TZ);
    expect(early).toBe("2026-11-16T16:30:00.000Z");
    // A date-only deadline on Mon ends at 23:59:59.999 Makassar = 15:59:59.999Z, same UTC day.
    const dateOnly = dueAtFrom("2026-11-16", null, TZ);
    const load = weekLoad(
      dates,
      [],
      [
        { dueAt: early, dueHasTime: true, status: "todo" },
        { dueAt: dateOnly, dueHasTime: false, status: "todo" },
      ],
      TZ,
      "2026-11-16",
    );
    expect(load.map((d) => d.deadlines)).toEqual([1, 1, 0]);
  });

  it("shades by load", () => {
    expect(loadIntensity(0, 0)).toBe(0);
    expect(loadIntensity(100, 0)).toBe(1);
    expect(loadIntensity(180, 0)).toBe(2);
    expect(loadIntensity(200, 2)).toBe(3);
    expect(loadIntensity(360, 3)).toBe(4);
  });
});
