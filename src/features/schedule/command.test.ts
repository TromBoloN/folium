import { describe, expect, it } from "vitest";
import { parseScheduleCommand, resolveCommand } from "./command";
import { buildSchedule, type ScheduleCourse, type ScheduleSlot } from "./occurrences";

// Monday 16 Nov 2026, 08:00.
const ctx = { today: "2026-11-16", nowMinute: 8 * 60, weekStart: "monday" as const };
const now = { date: ctx.today, minute: ctx.nowMinute };

const CALC: ScheduleCourse = { id: "calc", name: "Calculus I", code: "MAT101", color: "#1c7ed6", room: "B2.04" };
const PHYS: ScheduleCourse = { id: "phys", name: "Physics I", code: "FIS101", color: "#e8590c", room: "B1.12" };
const ENG: ScheduleCourse = { id: "eng", name: "Academic English", code: "ING101", color: "#d6336c", room: null };
const COURSES = [CALC, PHYS, ENG];

const slot = (
  id: string,
  course: ScheduleCourse,
  weekday: number,
  startTime: string,
  endTime: string,
): ScheduleSlot => ({
  id,
  courseId: course.id,
  course,
  weekday,
  startTime,
  endTime,
  startsOn: null,
  endsOn: null,
  location: null,
});
const schedule = buildSchedule(
  {
    slots: [
      slot("calc-mon", CALC, 1, "07:30", "09:10"),
      slot("calc-wed", CALC, 3, "07:30", "09:10"),
      slot("phys-tue", PHYS, 2, "09:20", "11:00"),
      slot("eng-fri", ENG, 5, "13:30", "15:10"),
    ],
    changes: [],
    breaks: [],
  },
  { from: ctx.today, to: "2026-12-13" },
);

const parse = (text: string) => parseScheduleCommand(text, ctx, COURSES);

describe("parseScheduleCommand", () => {
  it("cancel, in several phrasings", () => {
    expect(parse("cancel physics tomorrow")).toEqual({ kind: "cancel", course: "physics", date: "2026-11-17" });
    expect(parse("Physics cancelled tue")).toEqual({ kind: "cancel", course: "physics", date: "2026-11-17" });
    expect(parse("no physics tomorrow")).toEqual({ kind: "cancel", course: "physics", date: "2026-11-17" });
    expect(parse("cancel FIS101")).toEqual({ kind: "cancel", course: "fis101", date: null });
  });

  it("move: one date is where it goes; from/to names both", () => {
    expect(parse("calculus moved thu 10:00")).toEqual({
      kind: "move",
      course: "calculus",
      from: null,
      to: "2026-11-19",
      time: "10:00",
    });
    expect(parse("move calculus from wed to thu 10am")).toEqual({
      kind: "move",
      course: "calculus",
      from: "2026-11-18",
      to: "2026-11-19",
      time: "10:00",
    });
    expect(parse("calculus moved to 13:00")).toEqual({
      kind: "move",
      course: "calculus",
      from: null,
      to: null,
      time: "13:00",
    });
  });

  it("room", () => {
    expect(parse("FIS101 room B1.20 fri")).toEqual({
      kind: "room",
      course: "fis101",
      date: "2026-11-20",
      room: "B1.20",
    });
    expect(parse("room to B2.05 for calculus")).toEqual({
      kind: "room",
      course: "calculus",
      date: null,
      room: "B2.05",
    });
  });

  it("no classes over a range, with an optional label", () => {
    expect(parse("no classes 23-27 nov")).toEqual({
      kind: "break",
      startsOn: "2026-11-23",
      endsOn: "2026-11-27",
      label: "No classes",
    });
    expect(parse("No classes 23 nov to 27 nov exam week")).toEqual({
      kind: "break",
      startsOn: "2026-11-23",
      endsOn: "2026-11-27",
      label: "exam week",
    });
    expect(parse("no classes tomorrow")).toEqual({
      kind: "break",
      startsOn: "2026-11-17",
      endsOn: "2026-11-17",
      label: "No classes",
    });
    expect(parse("no classes 27-23 nov")).toBeNull();
  });

  it("isn't a command unless the words name a course", () => {
    expect(parse("cancel gym membership")).toBeNull();
    expect(parse("Room booking for physics")).toBeNull(); // no digit: not a room
    expect(parse("Essay outline tomorrow 5pm #ING101 !high")).toBeNull();
    expect(parse("physics tomorrow")).toBeNull(); // no verb
    expect(parse("calculus moved")).toBeNull(); // moved where?
    expect(parse("cancel")).toBeNull();
  });
});

describe("resolveCommand", () => {
  const resolve = (text: string) => {
    const cmd = parse(text);
    if (!cmd) throw new Error(`not a command: ${text}`);
    return resolveCommand(cmd, schedule, COURSES, now);
  };

  it("without a date, means the next class that hasn't ended (one on now counts)", () => {
    const r = resolve("cancel calculus");
    expect(r.ok && r.plan.action === "cancel" && r.plan.occurrence.date).toBe("2026-11-16");
    const later = resolveCommand({ kind: "cancel", course: "calc", date: null }, schedule, COURSES, {
      date: ctx.today,
      minute: 10 * 60,
    });
    expect(later.ok && later.plan.action === "cancel" && later.plan.occurrence.date).toBe("2026-11-18");
  });

  it("with a date, that day's class", () => {
    const r = resolve("cancel physics tomorrow");
    expect(r.ok && r.plan.action === "cancel" && r.plan.occurrence.key).toBe("s.phys-tue.2026-11-17");
    expect(resolve("cancel physics wed")).toEqual({ ok: false, error: "FIS101 has no class that day." });
  });

  it("a move keeps the class length and defaults to the class's own date", () => {
    expect(resolve("calculus moved thu 10:00")).toMatchObject({
      ok: true,
      plan: { action: "move", date: "2026-11-19", startTime: "10:00", endTime: "11:40" },
    });
    expect(resolve("move calculus from wed to thu 10am")).toMatchObject({
      ok: true,
      plan: { action: "move", occurrence: { date: "2026-11-18" }, date: "2026-11-19" },
    });
    expect(resolve("calculus moved to 13:00")).toMatchObject({
      ok: true,
      plan: { action: "move", date: "2026-11-16", startTime: "13:00", endTime: "14:40" },
    });
    expect(resolve("calculus moved to 23:00")).toEqual({ ok: false, error: "That would run past midnight." });
  });

  it("room and break", () => {
    expect(resolve("FIS101 room B1.20 tue")).toMatchObject({
      ok: true,
      plan: { action: "room", room: "B1.20", occurrence: { date: "2026-11-17" } },
    });
    expect(resolve("no classes 23-27 nov")).toMatchObject({
      ok: true,
      plan: { action: "break", startsOn: "2026-11-23" },
    });
  });
});
