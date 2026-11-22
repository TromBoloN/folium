import { describe, expect, it } from "vitest";
import { durationLabel, nextLabel, occurrenceChips, placementLabel } from "./format";
import { buildSchedule, type ClassChange, type ScheduleSlot } from "./occurrences";

const COURSE = { id: "c", name: "Calculus I", code: "MAT101", color: "#1c7ed6", room: "B2.04" };
const wed: ScheduleSlot = {
  id: "s",
  courseId: "c",
  course: COURSE,
  weekday: 3,
  startTime: "07:30",
  endTime: "09:10",
  startsOn: null,
  endsOn: null,
  location: null,
};
const base: ClassChange = {
  id: "ch",
  kind: "moved",
  courseId: "c",
  slotId: "s",
  originalDate: "2026-11-18",
  newDate: null,
  startTime: null,
  endTime: null,
  location: null,
  label: null,
  note: null,
};
const week = { from: "2026-11-16", to: "2026-11-22" };
const one = (change: ClassChange) => {
  const o = buildSchedule({ slots: [wed], changes: [change], breaks: [] }, week).find((x) => x.status !== "ghost");
  if (!o) throw new Error("missing");
  return o;
};

describe("occurrenceChips", () => {
  it("cancelled is just 'Cancelled' (the note is shown on its own)", () => {
    expect(occurrenceChips(one({ ...base, kind: "cancelled", note: "Ill" }), "24h")).toEqual([
      { kind: "cancelled", text: "Cancelled" },
    ]);
  });
  it("moved names where it was; same-day moves give just the time", () => {
    expect(
      occurrenceChips(one({ ...base, newDate: "2026-11-19", startTime: "10:00", endTime: "11:40" }), "24h"),
    ).toEqual([{ kind: "moved", text: "Moved from Wed 07:30" }]);
    expect(occurrenceChips(one({ ...base, startTime: "13:00", endTime: "14:40" }), "12h")).toEqual([
      { kind: "moved", text: "Moved from 7:30 AM" },
    ]);
  });
  it("room and extra", () => {
    expect(occurrenceChips(one({ ...base, location: "B2.05" }), "24h")).toEqual([
      { kind: "room", text: "Room changed · was B2.04" },
    ]);
    const extra = buildSchedule(
      {
        slots: [],
        changes: [
          {
            ...base,
            id: "x",
            kind: "extra",
            slotId: null,
            originalDate: null,
            newDate: "2026-11-21",
            startTime: "09:00",
            endTime: "10:00",
            label: "Makeup",
            course: COURSE,
          },
        ],
        breaks: [],
      },
      week,
    )[0];
    expect(occurrenceChips(extra, "24h")).toEqual([{ kind: "extra", text: "Extra · Makeup" }]);
  });
});

describe("labels", () => {
  const now = { date: "2026-11-16", minute: 8 * 60 };
  it("nextLabel reads naturally", () => {
    expect(nextLabel({ date: "2026-11-16", startTime: "07:30", endTime: "09:10" }, now, "24h")).toBe(
      "On now, until 09:10",
    );
    expect(nextLabel({ date: "2026-11-16", startTime: "10:00", endTime: "11:00" }, now, "24h")).toBe("Today 10:00");
    expect(nextLabel({ date: "2026-11-17", startTime: "07:30", endTime: "09:10" }, now, "24h")).toBe("Tomorrow 07:30");
    expect(nextLabel({ date: "2026-11-18", startTime: "10:00", endTime: "11:00" }, now, "24h")).toBe("Wed 10:00");
    expect(nextLabel({ date: "2026-11-25", startTime: "10:00", endTime: "11:00" }, now, "24h")).toBe(
      "Wed 25 Nov 10:00",
    );
  });
  it("placementLabel", () => {
    expect(placementLabel({ date: "2026-11-20", startTime: "13:30" }, "24h")).toBe("Fri 13:30");
    expect(placementLabel({ date: "2026-11-20", startTime: "13:30" }, "24h", "2026-11-20")).toBe("13:30");
  });
});

describe("durationLabel", () => {
  it("reads naturally", () => {
    expect(durationLabel({ startTime: "07:30", endTime: "08:20" })).toBe("50 min");
    expect(durationLabel({ startTime: "07:30", endTime: "09:10" })).toBe("1 h 40 min");
    expect(durationLabel({ startTime: "08:00", endTime: "10:00" })).toBe("2 h");
  });
});
