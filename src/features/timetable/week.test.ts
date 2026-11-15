import { describe, expect, it } from "vitest";
import type { Course } from "../courses/schema";
import type { TimetableSlot } from "./types";
import { buildWeek } from "./week";

const course = (id: string, name: string, code: string | null = null): Course => ({
  id,
  name,
  code,
  color: "#2f9e44",
  lecturer: null,
  room: "B2.04",
  semester: null,
  archivedAt: null,
});

const calc = course("c1", "Calculus", "MAT101");
const physics = course("c2", "Physics");

function slot(
  id: string,
  c: Course,
  weekday: number,
  startTime: string,
  endTime: string,
  extra: Partial<TimetableSlot> = {},
) {
  return {
    id,
    courseId: c.id,
    course: c,
    weekday,
    startTime,
    endTime,
    location: null,
    startsOn: null,
    endsOn: null,
    ...extra,
  };
}

// Week of Mon 16 – Sun 22 Nov 2026.
const options = { anchor: "2026-11-18", today: "2026-11-18", weekStart: "monday", timeFormat: "24h" } as const;

describe("buildWeek", () => {
  it("places slots on their days and marks today", () => {
    const week = buildWeek([slot("a", calc, 1, "08:00", "09:40"), slot("b", physics, 3, "10:00", "11:40")], options);
    expect(week.days.map((d) => d.items.length)).toEqual([1, 0, 1, 0, 0, 0, 0]);
    expect(week.days[2].isToday).toBe(true);
    expect(week.containsToday).toBe(true);
    expect(week.label).toBe("16–22 Nov 2026");
    expect(week.previous).toBe("2026-11-09");
    expect(week.next).toBe("2026-11-23");
  });

  it("uses the course code as the title and falls back to the course room", () => {
    const [item] = buildWeek([slot("a", calc, 1, "08:00", "09:40")], options).days[0].items;
    expect(item).toMatchObject({ title: "MAT101", timeLabel: "08:00–09:40", location: "B2.04" });
  });

  it("skips slots outside their date range this week", () => {
    const ended = slot("a", calc, 1, "08:00", "09:40", { endsOn: "2026-11-15" });
    const notStarted = slot("b", calc, 2, "08:00", "09:40", { startsOn: "2026-11-18" });
    const week = buildWeek([ended, notStarted], options);
    expect(week.days.every((d) => d.items.length === 0)).toBe(true);
  });

  it("marks overlaps on that date only, with the other course's name", () => {
    const week = buildWeek(
      [
        slot("a", calc, 1, "08:00", "10:00"),
        slot("b", physics, 1, "09:00", "11:00"),
        slot("c", physics, 2, "09:00", "11:00"),
      ],
      options,
    );
    const monday = Object.fromEntries(week.days[0].items.map((i) => [i.id, i]));
    expect(monday.a.overlapsWith).toEqual(["Physics"]);
    expect(monday.b.overlapsWith).toEqual(["MAT101"]);
    expect(monday.a.lanes).toBe(2);
    expect(week.days[1].items[0].overlapsWith).toEqual([]);
  });

  it("does not flag an overlap when the clashing slot isn't running that week", () => {
    const week = buildWeek(
      [slot("a", calc, 1, "08:00", "10:00"), slot("b", physics, 1, "09:00", "11:00", { startsOn: "2026-12-01" })],
      options,
    );
    expect(week.days[0].items.map((i) => i.overlapsWith)).toEqual([[]]);
  });

  it("widens the visible hours to fit early and late classes", () => {
    const week = buildWeek([slot("a", calc, 1, "06:30", "07:30"), slot("b", calc, 2, "18:00", "19:15")], options);
    expect([week.firstHour, week.lastHour]).toEqual([6, 20]);
  });

  it("labels weeks that span two months or years", () => {
    expect(buildWeek([], { ...options, anchor: "2026-12-30" }).label).toBe("28 Dec 2026 – 3 Jan 2027");
    expect(buildWeek([], { ...options, anchor: "2026-11-30" }).label).toBe("30 Nov – 6 Dec 2026");
  });
});
