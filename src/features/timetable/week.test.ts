import { describe, expect, it } from "vitest";
import type { Course } from "../courses/schema";
import type { ClassChange } from "../schedule/occurrences";
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
  credits: 0,
  archivedAt: null,
  lecturerEmail: null,
  lecturerPhone: null,
  kind: "campus",
  classType: null,
  totalMeetings: null,
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
): TimetableSlot {
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
    online: false,
    meetingUrl: null,
    ...extra,
  };
}

const only = (slots: TimetableSlot[], changes: ClassChange[] = []) => ({ slots, changes, breaks: [] });

// Week of Mon 16 – Sun 22 Nov 2026.
const options = { anchor: "2026-11-18", today: "2026-11-18", weekStart: "monday", timeFormat: "24h" } as const;

describe("buildWeek", () => {
  it("places slots on their days and marks today", () => {
    const week = buildWeek(
      only([slot("a", calc, 1, "08:00", "09:40"), slot("b", physics, 3, "10:00", "11:40")]),
      options,
    );
    expect(week.days.map((d) => d.items.length)).toEqual([1, 0, 1, 0, 0, 0, 0]);
    expect(week.days[2].isToday).toBe(true);
    expect(week.containsToday).toBe(true);
    expect(week.label).toBe("16–22 Nov 2026");
    expect(week.previous).toBe("2026-11-09");
    expect(week.next).toBe("2026-11-23");
  });

  it("uses the course code as the title and falls back to the course room", () => {
    const [item] = buildWeek(only([slot("a", calc, 1, "08:00", "09:40")]), options).days[0].items;
    expect(item).toMatchObject({ title: "MAT101", timeLabel: "08:00–09:40", location: "B2.04" });
  });

  it("skips slots outside their date range this week", () => {
    const ended = slot("a", calc, 1, "08:00", "09:40", { endsOn: "2026-11-15" });
    const notStarted = slot("b", calc, 2, "08:00", "09:40", { startsOn: "2026-11-18" });
    const week = buildWeek(only([ended, notStarted]), options);
    expect(week.days.every((d) => d.items.length === 0)).toBe(true);
  });

  it("marks overlaps on that date only, with the other course's name", () => {
    const week = buildWeek(
      only([
        slot("a", calc, 1, "08:00", "10:00"),
        slot("b", physics, 1, "09:00", "11:00"),
        slot("c", physics, 2, "09:00", "11:00"),
      ]),
      options,
    );
    const monday = Object.fromEntries(week.days[0].items.map((i) => [i.id.split(".")[1], i]));
    expect(monday.a.overlapsWith).toEqual(["Physics"]);
    expect(monday.b.overlapsWith).toEqual(["MAT101"]);
    expect(monday.a.lanes).toBe(2);
    expect(week.days[1].items[0].overlapsWith).toEqual([]);
  });

  it("does not flag an overlap when the clashing slot isn't running that week", () => {
    const week = buildWeek(
      only([slot("a", calc, 1, "08:00", "10:00"), slot("b", physics, 1, "09:00", "11:00", { startsOn: "2026-12-01" })]),
      options,
    );
    expect(week.days[0].items.map((i) => i.overlapsWith)).toEqual([[]]);
  });

  it("widens the visible hours to fit early and late classes", () => {
    const week = buildWeek(only([slot("a", calc, 1, "06:30", "07:30"), slot("b", calc, 2, "18:00", "19:15")]), options);
    expect([week.firstHour, week.lastHour]).toEqual([6, 20]);
  });

  it("lists cancelled classes dimmed but doesn't count them or clash with them", () => {
    const cancel: ClassChange = {
      id: "ch",
      kind: "cancelled",
      courseId: calc.id,
      slotId: "a",
      originalDate: "2026-11-16",
      newDate: null,
      startTime: null,
      endTime: null,
      location: null,
      label: null,
      note: "Lecturer unwell",
    };
    const week = buildWeek(
      only([slot("a", calc, 1, "08:00", "10:00"), slot("b", physics, 1, "09:00", "11:00")], [cancel]),
      options,
    );
    const monday = week.days[0];
    expect(monday.items.map((i) => i.status)).toEqual(["cancelled", "scheduled"]);
    expect(monday.items[0]).toMatchObject({
      chips: [{ kind: "cancelled", text: "Cancelled" }],
      note: "Lecturer unwell",
    });
    expect(monday.classCount).toBe(1);
    expect(monday.items.map((i) => i.overlapsWith)).toEqual([[], []]);
  });

  it("puts a moved class on its new day and a ghost at the old spot", () => {
    const move: ClassChange = {
      id: "mv",
      kind: "moved",
      courseId: calc.id,
      slotId: "a",
      originalDate: "2026-11-16",
      newDate: "2026-11-19",
      startTime: "10:00",
      endTime: "11:40",
      location: null,
      label: null,
      note: null,
    };
    const week = buildWeek(only([slot("a", calc, 1, "08:00", "09:40")], [move]), options);
    expect(week.days[0].items).toEqual([]);
    expect(week.days[0].ghosts).toMatchObject([{ title: "MAT101", startMinute: 480, movedToLabel: "Thu 10:00" }]);
    expect(week.days[3].items).toMatchObject([
      { status: "moved", timeLabel: "10:00–11:40", chips: [{ kind: "moved", text: "Moved from Mon 08:00" }] },
    ]);
  });

  it("marks days in a break and dims past classes", () => {
    const week = buildWeek(
      {
        slots: [slot("a", calc, 1, "08:00", "09:40"), slot("b", calc, 3, "08:00", "09:40")],
        changes: [],
        breaks: [{ id: "br", label: "Holiday", startsOn: "2026-11-20", endsOn: "2026-11-20" }],
      },
      { ...options, nowMinute: 9 * 60 },
    );
    expect(week.days[4].breakLabel).toBe("Holiday");
    expect(week.days[0].items[0].past).toBe(true); // Monday, before today
    expect(week.days[2].items[0].past).toBe(false); // today, 08:00–09:40 is on now at 09:00
  });

  it("labels weeks that span two months or years", () => {
    expect(buildWeek(only([]), { ...options, anchor: "2026-12-30" }).label).toBe("28 Dec 2026 – 3 Jan 2027");
    expect(buildWeek(only([]), { ...options, anchor: "2026-11-30" }).label).toBe("30 Nov – 6 Dec 2026");
  });
});
