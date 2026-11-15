import { describe, expect, it } from "vitest";
import { compareTasks, dayBounds, dueAtFrom, dueParts, dueState, dueWindowRange, formatDue } from "./due";

const MKS = "Asia/Makassar"; // UTC+8, no DST
const AMS = "Europe/Amsterdam"; // UTC+1 / +2 in summer

// Monday 16 Nov 2026, 10:00 in Makassar.
const now = new Date("2026-11-16T02:00:00Z");

describe("dueAtFrom / dueParts", () => {
  it("stores a date-only deadline as the end of that day in the user's zone", () => {
    expect(dueAtFrom("2026-11-20", null, MKS)).toBe("2026-11-20T15:59:59.999Z");
  });

  it("stores a timed deadline at that local time", () => {
    expect(dueAtFrom("2026-11-20", "14:30", MKS)).toBe("2026-11-20T06:30:00.000Z");
  });

  it("follows daylight saving in zones that have it", () => {
    expect(dueAtFrom("2026-07-01", "12:00", AMS)).toBe("2026-07-01T10:00:00.000Z");
    expect(dueAtFrom("2026-12-01", "12:00", AMS)).toBe("2026-12-01T11:00:00.000Z");
  });

  it("round-trips back to the local date and time", () => {
    expect(dueParts(dueAtFrom("2026-11-20", "14:30", MKS), true, MKS)).toEqual({ date: "2026-11-20", time: "14:30" });
    expect(dueParts(dueAtFrom("2026-11-20", null, MKS), false, MKS)).toEqual({ date: "2026-11-20", time: null });
  });

  it("gives local day bounds", () => {
    expect(dayBounds("2026-11-16", MKS)).toEqual({
      start: "2026-11-15T16:00:00.000Z",
      end: "2026-11-16T15:59:59.999Z",
    });
  });
});

describe("dueState", () => {
  const task = (date: string, time: string | null, status = "todo") => ({
    dueAt: dueAtFrom(date, time, MKS),
    dueHasTime: time !== null,
    status,
  });

  it("has no state without a deadline or once done", () => {
    expect(dueState({ dueAt: null, dueHasTime: false, status: "todo" }, now, MKS)).toBe("none");
    expect(dueState(task("2026-11-01", null, "done"), now, MKS)).toBe("none");
  });

  it("is overdue once the deadline has passed", () => {
    expect(dueState(task("2026-11-15", null), now, MKS)).toBe("overdue");
    expect(dueState(task("2026-11-16", "09:00"), now, MKS)).toBe("overdue");
  });

  it("is due today for a date-only deadline today, or a time later today", () => {
    expect(dueState(task("2026-11-16", null), now, MKS)).toBe("today");
    expect(dueState(task("2026-11-16", "23:00"), now, MKS)).toBe("today");
  });

  it("is due soon for the next two days, then later", () => {
    expect(dueState(task("2026-11-17", null), now, MKS)).toBe("soon");
    expect(dueState(task("2026-11-18", "08:00"), now, MKS)).toBe("soon");
    expect(dueState(task("2026-11-19", null), now, MKS)).toBe("later");
  });

  it("uses the user's zone for 'today', not UTC", () => {
    // 17:00 UTC on 15 Nov is already 01:00 on 16 Nov in Makassar.
    const lateUtc = new Date("2026-11-15T17:00:00Z");
    expect(dueState(task("2026-11-16", null), lateUtc, MKS)).toBe("today");
    expect(dueState(task("2026-11-15", null), lateUtc, MKS)).toBe("overdue");
  });
});

describe("dueWindowRange", () => {
  it("overdue means due before now", () => {
    expect(dueWindowRange("overdue", now, MKS, "monday")).toEqual({ before: now.toISOString() });
  });

  it("today covers the whole local day", () => {
    expect(dueWindowRange("today", now, MKS, "monday")).toEqual({
      from: "2026-11-15T16:00:00.000Z",
      to: "2026-11-16T15:59:59.999Z",
    });
  });

  it("this week runs from today to the end of the user's week", () => {
    expect(dueWindowRange("week", now, MKS, "monday").to).toBe("2026-11-22T15:59:59.999Z");
    expect(dueWindowRange("week", now, MKS, "sunday").to).toBe("2026-11-21T15:59:59.999Z");
  });
});

describe("formatDue", () => {
  const fmt = (date: string, time: string | null, format: "24h" | "12h" = "24h") =>
    formatDue({ dueAt: dueAtFrom(date, time, MKS), dueHasTime: time !== null }, now, MKS, format);

  it("uses relative names near today", () => {
    expect(fmt("2026-11-16", null)).toBe("Today");
    expect(fmt("2026-11-17", "14:30")).toBe("Tomorrow 14:30");
    expect(fmt("2026-11-15", null)).toBe("Yesterday");
  });

  it("uses the date further out, with the year only when it differs", () => {
    expect(fmt("2026-11-23", null)).toBe("Mon 23 Nov");
    expect(fmt("2027-01-03", "09:00", "12h")).toBe("3 Jan 2027 9:00 AM");
  });

  it("is null without a deadline", () => {
    expect(formatDue({ dueAt: null, dueHasTime: false }, now, MKS, "24h")).toBeNull();
  });
});

describe("compareTasks", () => {
  const t = (
    id: string,
    dueAt: string | null,
    priority: "low" | "medium" | "high" | "urgent",
    createdAt = "2026-11-01",
  ) => ({
    id,
    dueAt,
    dueHasTime: false,
    priority,
    createdAt,
  });

  it("orders by deadline, then priority, then age; no deadline last", () => {
    const tasks = [
      t("none", null, "urgent"),
      t("late-low", "2026-11-20T00:00:00Z", "low"),
      t("early", "2026-11-17T00:00:00Z", "low"),
      t("late-high", "2026-11-20T00:00:00Z", "high"),
      t("none-old", null, "urgent", "2026-10-01"),
    ];
    expect(tasks.sort(compareTasks).map((x) => x.id)).toEqual(["early", "late-high", "late-low", "none-old", "none"]);
  });
});
