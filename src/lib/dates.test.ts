import { describe, expect, it } from "vitest";
import { addDays, isCivilDate, isoWeekday, isValidTimeZone, listTimeZones, todayIn } from "./dates";

describe("dates", () => {
  it("takes today in Makassar (UTC+8), not the server's zone", () => {
    // 17:00 UTC on 15 Nov is 01:00 on 16 Nov in Makassar.
    expect(todayIn("Asia/Makassar", new Date("2026-11-15T17:00:00Z"))).toBe("2026-11-16");
    expect(todayIn("Asia/Makassar", new Date("2026-11-15T15:59:00Z"))).toBe("2026-11-15");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("gives ISO weekdays", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
  });

  it("validates real dates only", () => {
    expect(isCivilDate("2026-11-16")).toBe(true);
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(isCivilDate("16/11/2026")).toBe(false);
    expect(isCivilDate(null)).toBe(false);
  });
});

describe("time zones", () => {
  it("accepts IANA zones and rejects anything else", () => {
    expect(isValidTimeZone("Asia/Makassar")).toBe(true);
    expect(isValidTimeZone("Europe/Amsterdam")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it("lists zones and always includes the saved one", () => {
    expect(listTimeZones()).toContain("Asia/Makassar");
    expect(listTimeZones("Etc/GMT+5")).toContain("Etc/GMT+5");
  });
});
