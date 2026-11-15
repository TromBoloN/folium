import { describe, expect, it } from "vitest";
import {
  addMinutes,
  appliesOn,
  commonStartTimes,
  dateRangesIntersect,
  findConflicts,
  formatTime,
  layoutDay,
  type SlotTiming,
  slotsConflict,
  sortSlots,
  suggestedDuration,
  weekDates,
} from "./logic";

let n = 0;
function slot(weekday: number, startTime: string, endTime: string, range: Partial<SlotTiming> = {}): SlotTiming {
  n += 1;
  return { id: `s${n}`, weekday, startTime, endTime, startsOn: null, endsOn: null, ...range };
}

describe("sortSlots", () => {
  it("orders by weekday, then start, then end", () => {
    const a = slot(3, "08:00", "09:00");
    const b = slot(1, "13:00", "14:00");
    const c = slot(1, "08:00", "10:00");
    const d = slot(1, "08:00", "09:00");
    expect(sortSlots([a, b, c, d]).map((s) => s.id)).toEqual([d.id, c.id, b.id, a.id]);
  });

  it("compares times numerically, not as text", () => {
    const late = slot(1, "13:00", "14:00");
    const early = slot(1, "9:00", "10:00");
    expect(sortSlots([late, early])[0]).toBe(early);
  });
});

describe("appliesOn", () => {
  // 2026-11-16 is a Monday.
  const monday = slot(1, "08:00", "09:40");

  it("matches the weekday", () => {
    expect(appliesOn(monday, "2026-11-16")).toBe(true);
    expect(appliesOn(monday, "2026-11-17")).toBe(false);
  });

  it("treats Sunday as ISO weekday 7", () => {
    expect(appliesOn(slot(7, "08:00", "09:00"), "2026-11-15")).toBe(true);
  });

  it("respects the date range, inclusive at both ends", () => {
    const ranged = slot(1, "08:00", "09:00", { startsOn: "2026-11-16", endsOn: "2026-11-30" });
    expect(appliesOn(ranged, "2026-11-09")).toBe(false);
    expect(appliesOn(ranged, "2026-11-16")).toBe(true);
    expect(appliesOn(ranged, "2026-11-30")).toBe(true);
    expect(appliesOn(ranged, "2026-12-07")).toBe(false);
  });

  it("handles open-ended ranges", () => {
    expect(appliesOn(slot(1, "08:00", "09:00", { startsOn: "2026-11-23" }), "2026-11-16")).toBe(false);
    expect(appliesOn(slot(1, "08:00", "09:00", { endsOn: "2026-11-20" }), "2026-11-16")).toBe(true);
  });
});

describe("conflicts", () => {
  it("flags partial and full overlaps on the same weekday", () => {
    expect(slotsConflict(slot(1, "08:00", "10:00"), slot(1, "09:00", "11:00"))).toBe(true);
    expect(slotsConflict(slot(1, "08:00", "12:00"), slot(1, "09:00", "10:00"))).toBe(true);
  });

  it("does not flag back-to-back classes or other weekdays", () => {
    expect(slotsConflict(slot(1, "08:00", "10:00"), slot(1, "10:00", "11:00"))).toBe(false);
    expect(slotsConflict(slot(1, "08:00", "10:00"), slot(2, "08:00", "10:00"))).toBe(false);
  });

  it("does not flag slots whose date ranges never meet", () => {
    const first = slot(1, "08:00", "10:00", { endsOn: "2026-10-31" });
    const second = slot(1, "08:00", "10:00", { startsOn: "2026-11-01" });
    expect(dateRangesIntersect(first, second)).toBe(false);
    expect(slotsConflict(first, second)).toBe(false);
  });

  it("flags open-ended ranges that do meet", () => {
    expect(slotsConflict(slot(1, "08:00", "10:00"), slot(1, "09:00", "10:00", { startsOn: "2027-01-01" }))).toBe(true);
  });

  it("never flags a slot against itself", () => {
    const a = slot(1, "08:00", "10:00");
    expect(slotsConflict(a, a)).toBe(false);
  });

  it("collects every clash for each slot", () => {
    const a = slot(1, "08:00", "10:00");
    const b = slot(1, "09:00", "11:00");
    const c = slot(1, "09:30", "09:45");
    const d = slot(1, "11:00", "12:00");
    const conflicts = findConflicts([a, b, c, d]);
    expect(
      conflicts
        .get(a.id)
        ?.map((s) => s.id)
        .sort(),
    ).toEqual([b.id, c.id].sort());
    expect(
      conflicts
        .get(c.id)
        ?.map((s) => s.id)
        .sort(),
    ).toEqual([a.id, b.id].sort());
    expect(conflicts.has(d.id)).toBe(false);
  });

  it("finds a clash even when a long slot spans past shorter ones", () => {
    const long = slot(1, "08:00", "12:00");
    const short = slot(1, "08:30", "09:00");
    const later = slot(1, "11:00", "11:30");
    expect(findConflicts([long, short, later]).get(later.id)?.[0].id).toBe(long.id);
  });
});

describe("weekDates", () => {
  it("starts the week on the chosen day", () => {
    // Wednesday 18 Nov 2026
    expect(weekDates("2026-11-18", "monday")[0]).toBe("2026-11-16");
    expect(weekDates("2026-11-18", "sunday")[0]).toBe("2026-11-15");
    expect(weekDates("2026-11-18", "saturday")[0]).toBe("2026-11-14");
  });

  it("includes the anchor day when it is the first day", () => {
    expect(weekDates("2026-11-16", "monday")).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("crosses month and year boundaries", () => {
    expect(weekDates("2026-12-31", "monday")).toContain("2027-01-03");
  });
});

describe("layoutDay", () => {
  it("gives non-overlapping slots the full width", () => {
    const placed = layoutDay([slot(1, "08:00", "09:00"), slot(1, "09:00", "10:00")]);
    expect(placed.map((p) => [p.lane, p.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("puts overlapping slots side by side and reuses free lanes", () => {
    const a = slot(1, "08:00", "10:00");
    const b = slot(1, "08:30", "09:00");
    const c = slot(1, "09:00", "09:30"); // fits in b's lane once b ends
    const placed = layoutDay([a, b, c]);
    const byId = Object.fromEntries(placed.map((p) => [p.slot.id, [p.lane, p.lanes]]));
    expect(byId[a.id]).toEqual([0, 2]);
    expect(byId[b.id]).toEqual([1, 2]);
    expect(byId[c.id]).toEqual([1, 2]);
  });
});

describe("formatTime", () => {
  it("formats 24-hour and 12-hour times", () => {
    expect(formatTime("08:05", "24h")).toBe("08:05");
    expect(formatTime("14:30:00", "24h")).toBe("14:30");
    expect(formatTime("00:15", "12h")).toBe("12:15 AM");
    expect(formatTime("12:00", "12h")).toBe("12:00 PM");
    expect(formatTime("14:30", "12h")).toBe("2:30 PM");
  });
});

describe("new class time helpers", () => {
  it("suggests 50 minutes per SKS, else 100, at most 4 hours", () => {
    expect(suggestedDuration(3)).toBe(150);
    expect(suggestedDuration(2)).toBe(100);
    expect(suggestedDuration(0)).toBe(100);
    expect(suggestedDuration(6)).toBe(240);
  });
  it("adds minutes, capped before midnight", () => {
    expect(addMinutes("07:30", 100)).toBe("09:10");
    expect(addMinutes("23:00", 120)).toBe("23:55");
  });
  it("offers the most used start times, then common ones, in time order", () => {
    const slots = ["10:00", "10:00", "08:00", "13:30"].map((startTime) => ({ startTime }));
    expect(commonStartTimes(slots)).toEqual(["07:30", "08:00", "10:00", "13:30"]);
    expect(commonStartTimes([])).toEqual(["07:30", "09:20", "13:00", "15:30"]);
  });
});
