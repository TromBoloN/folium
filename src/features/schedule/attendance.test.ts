import { describe, expect, it } from "vitest";
import { meetingStats } from "./attendance";
import { type MeetingRow, meetingProgress } from "./meetings";

const row = (number: number, status: MeetingRow["status"], date: string | null = null): MeetingRow => ({
  courseId: "c",
  number,
  status,
  key: date ? `s.slot.${date}` : null,
  date,
});

describe("meetingStats", () => {
  it("reports null percent until at least one class is attended or missed", () => {
    const empty = meetingProgress([], 16);
    expect(meetingStats(empty, 2, 75, null)).toMatchObject({
      held: 2,
      attended: 0,
      missed: 0,
      unmarked: 2,
      percent: null,
      planned: 16,
      canMiss: 4,
      belowTarget: false,
      unknown: 0,
    });

    const onlyUnknown = meetingProgress([row(1, "unknown"), row(2, "unknown")], 16);
    expect(meetingStats(onlyUnknown, 1, 75, null)).toMatchObject({
      held: 3,
      percent: null,
      unknown: 2,
      canMiss: 4,
      belowTarget: false,
    });
  });

  it("computes percent over real marks (excluding unknown) and flags below-target attendance", () => {
    const progress = meetingProgress(
      [row(1, "unknown"), row(2, "attended", "2026-11-02"), row(3, "missed", "2026-11-09")],
      8,
    );
    // 1/2 = 50% (< 75%), allowed misses = floor(8 * 0.25) = 2, canMiss = 1
    expect(meetingStats(progress, 0, 75, null)).toMatchObject({
      held: 3,
      attended: 1,
      missed: 1,
      unknown: 1,
      percent: 50,
      planned: 8,
      canMiss: 1,
      belowTarget: true,
    });
  });

  it("flags belowTarget when skips exceed the term budget even if current percent is above target", () => {
    // 4 meetings, 75% target -> 1 miss allowed; 2 misses -> canMiss = -1 -> belowTarget even if percent were high.
    const progress = meetingProgress(
      [
        row(1, "attended", "2026-11-02"),
        row(2, "attended", "2026-11-09"),
        row(3, "missed", "2026-11-16"),
        row(4, "missed", "2026-11-23"),
      ],
      4,
    );
    expect(meetingStats(progress, 0, 75, null)).toMatchObject({ canMiss: -1, belowTarget: true });
  });

  it("falls back to plannedFallback for open-ended courses (or null when unknown)", () => {
    const open = meetingProgress([row(1, "attended", "2026-11-02")], null);
    expect(meetingStats(open, 0, 75, 12)).toMatchObject({ planned: 12, canMiss: 3, belowTarget: false });
    expect(meetingStats(open, 0, 75, null)).toMatchObject({ planned: null, canMiss: null, belowTarget: false });
  });

  it("computes held from logged rows plus unmarked, even with out-of-order meeting numbers", () => {
    const rows = [...Array.from({ length: 14 }, (_, i) => row(i + 1, "unknown")), row(16, "attended", "2026-11-23")];
    const progress = meetingProgress(rows, 16);
    expect(meetingStats(progress, 1, 75, null)).toMatchObject({
      held: 16,
      attended: 1,
      missed: 0,
      unknown: 14,
      unmarked: 1,
      planned: 16,
    });
  });
});
