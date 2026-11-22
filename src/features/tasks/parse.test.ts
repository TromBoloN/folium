import { describe, expect, it } from "vitest";
import { matchCourse, parseQuickAdd } from "./parse";

// Wednesday 18 Nov 2026, 14:00 local; Monday-start weeks.
const ctx = { today: "2026-11-18", nowMinute: 14 * 60, weekStart: "monday" as const };
const parse = (s: string) => parseQuickAdd(s, ctx);

describe("parseQuickAdd", () => {
  it("parses the full example", () => {
    expect(parse("Essay outline tomorrow 5pm #ING101 !high")).toEqual({
      title: "Essay outline",
      dueDate: "2026-11-19",
      dueTime: "17:00",
      priority: "high",
      course: "ING101",
      tokens: [
        { kind: "date", text: "tomorrow" },
        { kind: "time", text: "5pm" },
        { kind: "course", text: "#ING101" },
        { kind: "priority", text: "!high" },
      ],
    });
  });

  it("leaves a plain title alone", () => {
    expect(parse("Read chapter 9")).toMatchObject({
      title: "Read chapter 9",
      dueDate: null,
      dueTime: null,
      tokens: [],
    });
  });

  it("understands relative dates", () => {
    expect(parse("a today").dueDate).toBe("2026-11-18");
    expect(parse("a tmr").dueDate).toBe("2026-11-19");
    expect(parse("a fri").dueDate).toBe("2026-11-20");
    expect(parse("a wednesday").dueDate).toBe("2026-11-25"); // never today itself
    expect(parse("a next week").dueDate).toBe("2026-11-23");
    expect(parse("a next tue").dueDate).toBe("2026-11-24");
    expect(parse("a in 3 days").dueDate).toBe("2026-11-21");
    expect(parse("a in 2 weeks").dueDate).toBe("2026-12-02");
  });

  it("uses the user's week start for next week", () => {
    expect(parseQuickAdd("a next week", { ...ctx, weekStart: "sunday" }).dueDate).toBe("2026-11-22");
  });

  it("understands calendar dates, rolling past ones into next year", () => {
    expect(parse("a 23 nov").dueDate).toBe("2026-11-23");
    expect(parse("a nov 23rd").dueDate).toBe("2026-11-23");
    expect(parse("a 2/1").dueDate).toBe("2027-01-02"); // day/month
    expect(parse("a 10 nov").dueDate).toBe("2027-11-10");
    expect(parse("a 2026-12-01").dueDate).toBe("2026-12-01");
    expect(parse("a 31/2").dueDate).toBeNull();
  });

  it("drops connector words before dates and times", () => {
    expect(parse("Lab report due friday at 9:30am")).toMatchObject({
      title: "Lab report",
      dueDate: "2026-11-20",
      dueTime: "09:30",
    });
    expect(parse("Quiz by 23 nov @ 17:00").title).toBe("Quiz");
  });

  it("reads times in several forms", () => {
    expect(parse("a tomorrow 5 pm").dueTime).toBe("17:00");
    expect(parse("a tomorrow 12am").dueTime).toBe("00:00");
    expect(parse("a tomorrow 12pm").dueTime).toBe("12:00");
    expect(parse("a tomorrow noon").dueTime).toBe("12:00");
    expect(parse("a tomorrow 13pm").dueTime).toBeNull();
    expect(parse("a tomorrow 24:00").dueTime).toBeNull();
  });

  it("puts a time alone today, or tomorrow once it has passed", () => {
    expect(parse("Call home 6pm")).toMatchObject({ dueDate: "2026-11-18", dueTime: "18:00" });
    expect(parse("Call home 9am")).toMatchObject({ dueDate: "2026-11-19", dueTime: "09:00" });
  });

  it("reads priorities and keeps only the first of each kind", () => {
    expect(parse("a !!").priority).toBe("high");
    expect(parse("a !!!").priority).toBe("urgent");
    expect(parse("a !med").priority).toBe("medium");
    expect(parse("Move monday meeting to friday").title).toBe("Move meeting to friday");
    expect(parse("a #calc #phys").course).toBe("calc");
    expect(parse("a #calc #phys").title).toBe("a #phys");
  });

  it("ignores punctuation around tokens", () => {
    expect(parse("Buy goggles, tomorrow.")).toMatchObject({ title: "Buy goggles", dueDate: "2026-11-19" });
  });

  it("keeps the whole input as the title when nothing else is left", () => {
    expect(parse("tomorrow")).toMatchObject({ title: "tomorrow", dueDate: null, tokens: [] });
  });

  it("ignores Object.prototype keys like constructor and toString", () => {
    expect(parse("Fix constructor bug")).toMatchObject({
      title: "Fix constructor bug",
      dueDate: null,
      priority: null,
      tokens: [],
    });
    expect(parse("Next toString 5 valueOf")).toMatchObject({
      title: "Next toString 5 valueOf",
      dueDate: null,
      priority: null,
      tokens: [],
    });
  });
});

describe("matchCourse", () => {
  const courses = [
    { id: "1", code: "ING101", name: "Academic English" },
    { id: "2", code: "INF101", name: "Intro to Programming" },
    { id: "3", code: null, name: "Study group" },
  ];
  it("matches codes and names, ignoring case and spaces", () => {
    expect(matchCourse("ing101", courses)?.id).toBe("1");
    expect(matchCourse("studygroup", courses)?.id).toBe("3");
    expect(matchCourse("academic", courses)?.id).toBe("1");
  });
  it("returns null for unknown or ambiguous tokens", () => {
    expect(matchCourse("in", courses)).toBeNull();
    expect(matchCourse("chem", courses)).toBeNull();
  });
});
