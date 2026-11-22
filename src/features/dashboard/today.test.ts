import { describe, expect, it } from "vitest";
import { minutesNowIn } from "@/lib/dates";
import type { SlotTiming } from "../timetable/logic";
import { classMoment, greeting } from "./today";

const slot = (id: string, weekday: number, startTime: string, endTime: string, range: Partial<SlotTiming> = {}) => ({
  id,
  weekday,
  startTime,
  endTime,
  startsOn: null,
  endsOn: null,
  ...range,
});

describe("classMoment", () => {
  const todays = [slot("a", 1, "08:00", "10:00"), slot("b", 1, "10:00", "11:40"), slot("c", 1, "13:00", "14:40")];
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return classMoment(todays, h * 60 + m);
  };

  it("before the first class: nothing current, first is next", () => {
    expect(at("07:00")).toEqual({ current: [], next: "a" });
  });

  it("during a class: it is current, the following one is next", () => {
    expect(at("08:30")).toEqual({ current: ["a"], next: "b" });
  });

  it("at a back-to-back boundary the new class is current, not next", () => {
    expect(at("10:00")).toEqual({ current: ["b"], next: "c" });
  });

  it("in a gap between classes: nothing current, next is set", () => {
    expect(at("12:00")).toEqual({ current: [], next: "c" });
  });

  it("after the last class: nothing current or next", () => {
    expect(at("15:00")).toEqual({ current: [], next: null });
  });

  it("overlapping classes can both be current", () => {
    const overlap = [slot("x", 1, "09:00", "11:00"), slot("y", 1, "10:00", "12:00")];
    expect(classMoment(overlap, 10 * 60 + 30)).toEqual({ current: ["x", "y"], next: null });
  });
});

describe("greeting", () => {
  it("changes with the time of day", () => {
    expect(greeting(4 * 60 + 59)).toBe("Good evening");
    expect(greeting(5 * 60)).toBe("Good morning");
    expect(greeting(12 * 60)).toBe("Good afternoon");
    expect(greeting(18 * 60)).toBe("Good evening");
  });
});

describe("minutesNowIn", () => {
  it("reads the clock in the user's zone", () => {
    // 01:30 UTC is 09:30 in Makassar.
    expect(minutesNowIn("Asia/Makassar", new Date("2026-11-16T01:30:00Z"))).toBe(9 * 60 + 30);
    expect(minutesNowIn("UTC", new Date("2026-11-16T23:59:00Z"))).toBe(23 * 60 + 59);
  });
});
