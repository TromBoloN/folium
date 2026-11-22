import { describe, expect, it } from "vitest";
import { findConflicts, layoutDay } from "../timetable/logic";
import {
  buildSchedule,
  type ClassBreak,
  type ClassChange,
  isChanged,
  isListed,
  isLive,
  isPast,
  liveOn,
  nextOccurrence,
  occurrenceKey,
  parseOccurrenceKey,
  type ScheduleCourse,
  type ScheduleSlot,
} from "./occurrences";

// 2026-11-16 is a Monday.
const MON = "2026-11-16";
const TUE = "2026-11-17";
const WED = "2026-11-18";
const THU = "2026-11-19";
const FRI = "2026-11-20";
const SUN = "2026-11-22";
const NEXT_MON = "2026-11-23";
const WEEK = { from: MON, to: SUN };

const CALC: ScheduleCourse = { id: "c-calc", name: "Calculus I", code: "MAT101", color: "#1c7ed6", room: "B2.04" };
const PHYS: ScheduleCourse = { id: "c-phys", name: "Physics I", code: "FIS101", color: "#e8590c", room: "B1.12" };
const ENG: ScheduleCourse = { id: "c-eng", name: "Academic English", code: "ING101", color: "#d6336c", room: null };

const slot = (
  id: string,
  course: ScheduleCourse,
  weekday: number,
  startTime: string,
  endTime: string,
  extra: Partial<ScheduleSlot> = {},
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
  ...extra,
});

const change = (id: string, partial: Partial<ClassChange> & Pick<ClassChange, "kind" | "courseId">): ClassChange => ({
  id,
  slotId: null,
  originalDate: null,
  newDate: null,
  startTime: null,
  endTime: null,
  location: null,
  label: null,
  note: null,
  ...partial,
});

const calcMon = slot("s-calc-mon", CALC, 1, "07:30", "09:10");
const calcWed = slot("s-calc-wed", CALC, 3, "07:30", "09:10");
const physMon = slot("s-phys-mon", PHYS, 1, "09:20", "11:00");
const engFri = slot("s-eng-fri", ENG, 5, "13:30", "15:10", { location: "A2.10" });
const SLOTS = [calcMon, calcWed, physMon, engFri];

const keys = (list: { key: string }[]) => list.map((o) => o.key);

describe("buildSchedule: weekly classes", () => {
  it("expands each slot onto its weekday, sorted by date then time", () => {
    const week = buildSchedule({ slots: SLOTS, changes: [], breaks: [] }, WEEK);
    expect(keys(week)).toEqual([
      occurrenceKey("s-calc-mon", MON),
      occurrenceKey("s-phys-mon", MON),
      occurrenceKey("s-calc-wed", WED),
      occurrenceKey("s-eng-fri", FRI),
    ]);
    expect(week.every((o) => o.status === "scheduled")).toBe(true);
  });

  it("respects a slot's own date range", () => {
    const lab = slot("s-lab", PHYS, 4, "13:00", "15:30", { startsOn: "2026-11-20", endsOn: "2026-12-31" });
    const week = buildSchedule({ slots: [lab], changes: [], breaks: [] }, { from: MON, to: "2026-11-29" });
    expect(week.map((o) => o.date)).toEqual(["2026-11-26"]);
  });

  it("uses the slot's location, else the course room", () => {
    const week = buildSchedule({ slots: SLOTS, changes: [], breaks: [] }, WEEK);
    expect(week.find((o) => o.slotId === "s-eng-fri")?.location).toBe("A2.10");
    expect(week.find((o) => o.slotId === "s-calc-mon")?.location).toBe("B2.04");
    expect(week.find((o) => o.slotId === "s-calc-mon")?.room).toBeNull();
  });

  it("is a SlotTiming for its own date only", () => {
    const [o] = buildSchedule({ slots: [calcWed], changes: [], breaks: [] }, WEEK);
    expect(o).toMatchObject({ weekday: 3, startsOn: WED, endsOn: WED, id: o.key });
  });

  it("returns nothing for an empty or reversed range", () => {
    expect(buildSchedule({ slots: SLOTS, changes: [], breaks: [] }, { from: SUN, to: MON })).toEqual([]);
  });

  it("carries the online flag and meeting link", () => {
    const online = slot("s-online", ENG, 2, "10:00", "11:00", { online: true, meetingUrl: "https://meet.example/x" });
    const [o] = buildSchedule({ slots: [online], changes: [], breaks: [] }, WEEK);
    expect(o).toMatchObject({ online: true, meetingUrl: "https://meet.example/x" });
  });
});

describe("buildSchedule: cancelled", () => {
  const cancel = change("ch-1", {
    kind: "cancelled",
    courseId: CALC.id,
    slotId: calcWed.id,
    originalDate: WED,
    note: "Dr. Siti unwell",
  });

  it("marks that one date cancelled and keeps the others", () => {
    const twoWeeks = buildSchedule(
      { slots: [calcWed], changes: [cancel], breaks: [] },
      { from: MON, to: "2026-11-29" },
    );
    expect(twoWeeks.map((o) => [o.date, o.status])).toEqual([
      [WED, "cancelled"],
      ["2026-11-25", "scheduled"],
    ]);
    expect(twoWeeks[0]).toMatchObject({ note: "Dr. Siti unwell", changeId: "ch-1", breakLabel: null });
  });

  it("stays listed but isn't live", () => {
    const [o] = buildSchedule({ slots: [calcWed], changes: [cancel], breaks: [] }, WEEK);
    expect(isListed(o)).toBe(true);
    expect(isLive(o)).toBe(false);
    expect(isChanged(o)).toBe(true);
  });

  it("ignores a change on a date the slot doesn't run (stale)", () => {
    const stale = { ...cancel, originalDate: THU };
    const week = buildSchedule({ slots: [calcWed], changes: [stale], breaks: [] }, WEEK);
    expect(week.map((o) => o.status)).toEqual(["scheduled"]);
  });
});

describe("buildSchedule: moved", () => {
  const moveToThu = change("mv-1", {
    kind: "moved",
    courseId: ENG.id,
    slotId: engFri.id,
    originalDate: FRI,
    newDate: THU,
    startTime: "10:00",
    endTime: "11:40",
  });

  it("places the class at the new date and time, with where it came from", () => {
    const week = buildSchedule({ slots: [engFri], changes: [moveToThu], breaks: [] }, WEEK);
    const live = week.filter(isLive);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      key: occurrenceKey(engFri.id, FRI),
      status: "moved",
      date: THU,
      weekday: 4,
      startTime: "10:00",
      endTime: "11:40",
      originalDate: FRI,
      from: { date: FRI, startTime: "13:30", endTime: "15:10" },
    });
  });

  it("leaves a ghost at the old spot that isn't listed or live", () => {
    const week = buildSchedule({ slots: [engFri], changes: [moveToThu], breaks: [] }, WEEK);
    const ghost = week.find((o) => o.status === "ghost");
    expect(ghost).toMatchObject({ date: FRI, startTime: "13:30", movedTo: { date: THU, startTime: "10:00" } });
    expect(ghost && (isListed(ghost) || isLive(ghost))).toBe(false);
    // Keys never collide with the moved class itself.
    expect(new Set(keys(week)).size).toBe(week.length);
  });

  it("shows the moved class in the week it lands in, even if it came from another week", () => {
    const intoNextWeek = { ...moveToThu, newDate: NEXT_MON };
    const thisWeek = buildSchedule({ slots: [engFri], changes: [intoNextWeek], breaks: [] }, WEEK);
    expect(thisWeek.map((o) => o.status)).toEqual(["ghost"]);
    const nextWeek = buildSchedule(
      { slots: [engFri], changes: [intoNextWeek], breaks: [] },
      { from: NEXT_MON, to: "2026-11-29" },
    );
    expect(nextWeek.map((o) => [o.date, o.status])).toEqual([
      [NEXT_MON, "moved"],
      ["2026-11-27", "scheduled"],
    ]);
  });

  it("a time-only move keeps the date", () => {
    const later = change("mv-2", {
      kind: "moved",
      courseId: CALC.id,
      slotId: calcMon.id,
      originalDate: MON,
      startTime: "13:00",
      endTime: "14:40",
    });
    const day = liveOn(buildSchedule({ slots: [calcMon], changes: [later], breaks: [] }, WEEK), MON);
    expect(day).toMatchObject([
      { status: "moved", date: MON, startTime: "13:00", from: { date: MON, startTime: "07:30" } },
    ]);
  });

  it("a room-only change stays scheduled, with the room change noted", () => {
    const room = change("rm-1", {
      kind: "moved",
      courseId: CALC.id,
      slotId: calcMon.id,
      originalDate: MON,
      location: "B2.05",
    });
    const [o] = buildSchedule({ slots: [calcMon], changes: [room], breaks: [] }, WEEK);
    expect(o).toMatchObject({
      status: "scheduled",
      location: "B2.05",
      room: { from: "B2.04", to: "B2.05" },
      from: null,
    });
    expect(isChanged(o)).toBe(true);
  });

  it("a 'room change' to the same room is no change", () => {
    const same = change("rm-2", {
      kind: "moved",
      courseId: CALC.id,
      slotId: calcMon.id,
      originalDate: MON,
      location: "B2.04",
    });
    const [o] = buildSchedule({ slots: [calcMon], changes: [same], breaks: [] }, WEEK);
    expect(o.room).toBeNull();
  });

  it("a move to the same date and time is just scheduled (no ghost)", () => {
    const noop = change("mv-3", {
      kind: "moved",
      courseId: CALC.id,
      slotId: calcMon.id,
      originalDate: MON,
      newDate: MON,
      location: "B2.05",
    });
    const week = buildSchedule({ slots: [calcMon], changes: [noop], breaks: [] }, WEEK);
    expect(week.map((o) => o.status)).toEqual(["scheduled"]);
  });

  it("a move plus a room change carries both", () => {
    const both = { ...moveToThu, location: "Aula" };
    const o = buildSchedule({ slots: [engFri], changes: [both], breaks: [] }, WEEK).find(isLive);
    expect(o).toMatchObject({ status: "moved", location: "Aula", room: { from: "A2.10", to: "Aula" } });
  });

  it("ignores a stale move (slot no longer runs on the original date)", () => {
    const ended = { ...engFri, endsOn: "2026-11-13" };
    const week = buildSchedule({ slots: [ended], changes: [moveToThu], breaks: [] }, WEEK);
    expect(week).toEqual([]);
  });

  it("ignores a move whose slot is gone (deleted or archived course)", () => {
    expect(buildSchedule({ slots: [], changes: [moveToThu], breaks: [] }, WEEK)).toEqual([]);
  });
});

describe("buildSchedule: extra sessions", () => {
  const makeup = change("x-1", {
    kind: "extra",
    courseId: CALC.id,
    course: CALC,
    newDate: SUN,
    startTime: "09:00",
    endTime: "10:40",
    label: "Makeup",
  });

  it("adds a session with its label, in the course room by default", () => {
    const [o] = buildSchedule({ slots: [], changes: [makeup], breaks: [] }, WEEK);
    expect(o).toMatchObject({
      key: "x.x-1",
      status: "extra",
      date: SUN,
      weekday: 7,
      label: "Makeup",
      location: "B2.04",
      slotId: null,
    });
    expect(isLive(o)).toBe(true);
  });

  it("skips extras outside the range or of an archived course", () => {
    expect(buildSchedule({ slots: [], changes: [makeup], breaks: [] }, { from: MON, to: "2026-11-21" })).toEqual([]);
    expect(buildSchedule({ slots: [], changes: [{ ...makeup, course: null }], breaks: [] }, WEEK)).toEqual([]);
  });
});

describe("buildSchedule: breaks", () => {
  const examWeek: ClassBreak = { id: "b-1", label: "Exam week", startsOn: NEXT_MON, endsOn: "2026-11-27" };
  const twoWeeks = { from: MON, to: "2026-11-29" };

  it("cancels every regular class in the range, with the break's label", () => {
    const list = buildSchedule({ slots: SLOTS, changes: [], breaks: [examWeek] }, twoWeeks);
    const inBreak = list.filter((o) => o.date >= NEXT_MON);
    expect(inBreak.length).toBe(4);
    expect(inBreak.every((o) => o.status === "cancelled" && o.breakLabel === "Exam week")).toBe(true);
    expect(list.filter((o) => o.date < NEXT_MON).every((o) => o.status === "scheduled")).toBe(true);
  });

  it("is inclusive at both ends", () => {
    const oneDay: ClassBreak = { id: "b-2", label: "Holiday", startsOn: WED, endsOn: WED };
    const week = buildSchedule({ slots: SLOTS, changes: [], breaks: [oneDay] }, WEEK);
    expect(week.filter((o) => o.status === "cancelled").map((o) => o.date)).toEqual([WED]);
  });

  it("keeps extra sessions (an exam in exam week)", () => {
    const exam = change("x-exam", {
      kind: "extra",
      courseId: CALC.id,
      course: CALC,
      newDate: "2026-11-24",
      startTime: "08:00",
      endTime: "10:00",
      label: "Midterm exam",
    });
    const list = buildSchedule({ slots: SLOTS, changes: [exam], breaks: [examWeek] }, twoWeeks);
    expect(liveOn(list, "2026-11-24")).toMatchObject([{ status: "extra", label: "Midterm exam" }]);
  });

  it("a move out of the break wins; a move into the break also wins", () => {
    const out = change("mv-out", {
      kind: "moved",
      courseId: CALC.id,
      slotId: calcWed.id,
      originalDate: "2026-11-25",
      newDate: "2026-11-28",
      startTime: "08:00",
      endTime: "09:40",
    });
    const into = change("mv-in", {
      kind: "moved",
      courseId: PHYS.id,
      slotId: physMon.id,
      originalDate: MON,
      newDate: "2026-11-26",
      startTime: "08:00",
      endTime: "09:40",
    });
    const list = buildSchedule({ slots: SLOTS, changes: [out, into], breaks: [examWeek] }, twoWeeks);
    expect(liveOn(list, "2026-11-28").map((o) => o.courseId)).toEqual([CALC.id]);
    expect(liveOn(list, "2026-11-26").map((o) => o.courseId)).toEqual([PHYS.id]);
  });

  it("a room-only change inside a break is still cancelled", () => {
    const room = change("rm-b", {
      kind: "moved",
      courseId: CALC.id,
      slotId: calcMon.id,
      originalDate: NEXT_MON,
      location: "B2.05",
    });
    const list = buildSchedule({ slots: [calcMon], changes: [room], breaks: [examWeek] }, twoWeeks);
    expect(list.find((o) => o.date === NEXT_MON)).toMatchObject({ status: "cancelled", breakLabel: "Exam week" });
  });

  it("an explicit cancellation keeps its own note inside a break", () => {
    const cancel = change("c-b", {
      kind: "cancelled",
      courseId: CALC.id,
      slotId: calcMon.id,
      originalDate: NEXT_MON,
      note: "Own note",
    });
    const [o] = buildSchedule(
      { slots: [calcMon], changes: [cancel], breaks: [examWeek] },
      { from: NEXT_MON, to: NEXT_MON },
    );
    expect(o).toMatchObject({ status: "cancelled", note: "Own note", breakLabel: null });
  });
});

describe("reading the schedule", () => {
  const cancelMon = change("c-1", { kind: "cancelled", courseId: CALC.id, slotId: calcMon.id, originalDate: MON });
  const list = buildSchedule({ slots: SLOTS, changes: [cancelMon], breaks: [] }, WEEK);

  it("nextOccurrence skips cancelled and finished classes", () => {
    expect(nextOccurrence(list, { date: MON, minute: 6 * 60 })?.courseId).toBe(PHYS.id);
    expect(nextOccurrence(list, { date: MON, minute: 10 * 60 })?.courseId).toBe(PHYS.id); // on now, not over
    expect(nextOccurrence(list, { date: MON, minute: 11 * 60 })?.slotId).toBe(calcWed.id);
    expect(nextOccurrence(list, { date: MON, minute: 0 }, ENG.id)?.date).toBe(FRI);
    expect(nextOccurrence(list, { date: SUN, minute: 0 })).toBeNull();
  });

  it("isPast is by end time", () => {
    const phys = list.find((o) => o.slotId === physMon.id);
    if (!phys) throw new Error("missing");
    expect(isPast(phys, { date: MON, minute: 11 * 60 - 1 })).toBe(false);
    expect(isPast(phys, { date: MON, minute: 11 * 60 })).toBe(true);
    expect(isPast(phys, { date: TUE, minute: 0 })).toBe(true);
  });

  it("overlap checks only see what really happens", () => {
    const clash = slot("s-clash", ENG, 1, "08:00", "09:00");
    const withClash = buildSchedule({ slots: [...SLOTS, clash], changes: [cancelMon], breaks: [] }, WEEK);
    // Calculus on Monday is cancelled, so the 08:00 class clashes with nothing.
    expect(findConflicts(liveOn(withClash, MON)).size).toBe(0);
    const noCancel = buildSchedule({ slots: [...SLOTS, clash], changes: [], breaks: [] }, WEEK);
    expect(
      findConflicts(liveOn(noCancel, MON))
        .get(occurrenceKey("s-clash", MON))
        ?.map((o) => o.courseId),
    ).toEqual([CALC.id]);
  });

  it("the same weekday in different weeks never clashes", () => {
    const twoWeeks = buildSchedule({ slots: [calcMon], changes: [], breaks: [] }, { from: MON, to: NEXT_MON });
    expect(findConflicts(twoWeeks).size).toBe(0);
  });

  it("moved classes get lanes like any other", () => {
    const toMorning = change("mv-m", {
      kind: "moved",
      courseId: ENG.id,
      slotId: engFri.id,
      originalDate: FRI,
      newDate: MON,
      startTime: "08:00",
      endTime: "09:00",
    });
    const mon = liveOn(buildSchedule({ slots: SLOTS, changes: [toMorning], breaks: [] }, WEEK), MON);
    expect(layoutDay(mon).map((p) => p.lanes)).toEqual([2, 2, 1]);
  });
});

describe("parseOccurrenceKey", () => {
  const id = "0b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  it("round-trips weekly and extra keys", () => {
    expect(parseOccurrenceKey(occurrenceKey(id, MON))).toEqual({ kind: "slot", slotId: id, date: MON });
    expect(parseOccurrenceKey(`x.${id}`)).toEqual({ kind: "extra", changeId: id });
  });
  it("rejects anything else", () => {
    expect(parseOccurrenceKey(`g.${id}.${MON}`)).toBeNull();
    expect(parseOccurrenceKey(`s.${id}.16-11-2026`)).toBeNull();
    expect(parseOccurrenceKey("s.not-a-uuid.2026-11-16")).toBeNull();
    expect(parseOccurrenceKey(`s.${id}.2026-02-30`)).toBeNull();
    expect(parseOccurrenceKey(`x.${id}/../etc`)).toBeNull();
  });
});

describe("buildSchedule: rescheduled without a date yet (postponed)", () => {
  const postponed = change("ch-post", {
    kind: "postponed",
    courseId: CALC.id,
    slotId: calcMon.id,
    originalDate: MON,
  });

  it("keeps the class on its date as postponed: listed, but not live or markable", () => {
    const week = buildSchedule({ slots: SLOTS, changes: [postponed], breaks: [] }, WEEK);
    const occ = week.find((o) => o.key === occurrenceKey(calcMon.id, MON));
    expect(occ?.status).toBe("postponed");
    expect(occ?.changeId).toBe("ch-post");
    expect(occ && isLive(occ)).toBe(false);
    expect(occ && isListed(occ)).toBe(true);
    expect(liveOn(week, MON).map((o) => o.courseId)).toEqual([PHYS.id]);
  });

  it("wins over a break (it was explicitly rescheduled) and only touches its own date", () => {
    const brk: ClassBreak = { id: "b", label: "Holiday", startsOn: MON, endsOn: MON };
    const week = buildSchedule({ slots: SLOTS, changes: [postponed], breaks: [brk] }, WEEK);
    expect(week.find((o) => o.key === occurrenceKey(calcMon.id, MON))?.status).toBe("postponed");
    const next = buildSchedule({ slots: SLOTS, changes: [postponed], breaks: [] }, { from: NEXT_MON, to: NEXT_MON });
    expect(next.find((o) => o.slotId === calcMon.id)?.status).toBe("scheduled");
  });
});

describe("buildSchedule: finished courses (meeting log)", () => {
  it("drops a course's classes after the day of its last meeting, extras included", () => {
    const done = { ...CALC, endsAfter: MON };
    const out = buildSchedule(
      {
        slots: [slot("s-mon", done, 1, "07:30", "09:10"), slot("s-wed", done, 3, "07:30", "09:10"), physMon],
        changes: [
          change("x1", {
            kind: "extra",
            courseId: done.id,
            course: done,
            newDate: THU,
            startTime: "10:00",
            endTime: "11:00",
          }),
        ],
        breaks: [],
      },
      WEEK,
    );
    expect(out.map((o) => `${o.course.code} ${o.date}`)).toEqual(["MAT101 2026-11-16", "FIS101 2026-11-16"]);
  });
});
