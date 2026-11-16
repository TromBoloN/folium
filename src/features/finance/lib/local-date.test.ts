import { describe, expect, it } from "vitest";
import { addDays, localDateFor } from "./local-date";

const at = (iso: string) => new Date(iso);

describe("localDateFor", () => {
  it("Asia/Makassar (UTC+8) turns over at 16:00 UTC", () => {
    expect(localDateFor(at("2026-11-16T15:59:00Z"), "Asia/Makassar")).toBe("2026-11-16");
    expect(localDateFor(at("2026-11-16T16:00:00Z"), "Asia/Makassar")).toBe("2026-11-17");
    expect(localDateFor(at("2026-11-16T16:01:00Z"), "Asia/Makassar")).toBe("2026-11-17");
  });

  it("Asia/Jakarta (UTC+7) turns over at 17:00 UTC", () => {
    expect(localDateFor(at("2026-11-16T16:30:00Z"), "Asia/Jakarta")).toBe("2026-11-16");
    expect(localDateFor(at("2026-11-16T17:00:00Z"), "Asia/Jakarta")).toBe("2026-11-17");
  });

  it("a zone behind UTC can still be on the previous day", () => {
    // 03:00 UTC on the 17th is 22:00 on the 16th in New York (UTC-5 in November).
    expect(localDateFor(at("2026-11-17T03:00:00Z"), "America/New_York")).toBe("2026-11-16");
    expect(localDateFor(at("2026-11-17T09:00:00Z"), "Pacific/Honolulu")).toBe("2026-11-16");
  });

  it("is not UTC midnight: the same instant gives different dates per zone", () => {
    const instant = at("2026-12-31T20:00:00Z");
    expect(localDateFor(instant, "UTC")).toBe("2026-12-31");
    expect(localDateFor(instant, "Asia/Makassar")).toBe("2027-01-01");
  });

  it("rejects an invalid date or zone", () => {
    expect(() => localDateFor(new Date(Number.NaN), "Asia/Makassar")).toThrow(RangeError);
    expect(() => localDateFor(at("2026-11-16T00:00:00Z"), "Not/AZone")).toThrow(RangeError);
  });
});

describe("addDays", () => {
  it("does calendar math across months, years and leap days", () => {
    expect(addDays("2026-11-16", 1)).toBe("2026-11-17");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-11-16", 0)).toBe("2026-11-16");
    expect(addDays("2026-11-16", -365)).toBe("2025-11-16");
  });

  it("doesn't drift across DST changes (no local-time Date math)", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("rejects malformed or impossible dates and non-integer days", () => {
    for (const bad of ["2026-2-1", "16-11-2026", "2026-02-30", "2026-13-01", ""]) {
      expect(() => addDays(bad, 1), bad).toThrow(RangeError);
    }
    expect(() => addDays("2026-11-16", 1.5)).toThrow(RangeError);
  });
});
