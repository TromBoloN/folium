import { describe, expect, it } from "vitest";
import type { Occurrence } from "@/features/schedule/occurrences";
import { dueAtFrom } from "@/features/tasks/due";
import { buildCatchUp, type CatchUpInput } from "./catch-up";

const TZ = "Asia/Makassar";
const TODAY = "2026-11-22";
const NOW = new Date("2026-11-22T04:00:00Z"); // 12:00 WITA

function occ(key: string, date: string, status: Occurrence["status"] = "scheduled"): Occurrence {
  return {
    id: key,
    weekday: 1,
    startsOn: null,
    endsOn: null,
    key,
    courseId: "course-1",
    slotId: "slot-1",
    changeId: null,
    originalDate: date,
    date,
    startTime: "08:00",
    endTime: "09:40",
    location: null,
    room: null,
    from: null,
    movedTo: null,
    status,
    note: null,
    label: null,
    breakLabel: null,
    online: false,
    meetingUrl: null,
    course: { id: "course-1", name: "Calculus", code: "MAT101", color: "#2f9e44", room: null, lecturer: null },
  };
}

function base(overrides: Partial<CatchUpInput> = {}): CatchUpInput {
  return {
    today: TODAY,
    now: NOW,
    timeZone: TZ,
    bills: [],
    hasActiveAccounts: true,
    lastActivityTxDate: TODAY,
    balancesCheckedOn: null,
    occurrences: [],
    marks: new Set(),
    progress: new Map(),
    tasks: [],
    ...overrides,
  };
}

describe("buildCatchUp", () => {
  it("is empty when there is no backlog from before yesterday", () => {
    const res = buildCatchUp(
      base({
        bills: [{ id: "b1", dueOn: TODAY, occurredOn: TODAY }],
        occurrences: [occ("s.1.2026-11-21", "2026-11-21"), occ("s.1.2026-11-22", "2026-11-22")],
        tasks: [{ id: "t1", status: "todo", dueAt: dueAtFrom("2026-11-21", null, TZ), dueHasTime: false }],
      }),
    );
    expect(res).toEqual({ billIds: [], showBalances: false, classKeys: [], taskIds: [], hasAny: false });
  });

  it("collects past-due bills, unmarked classes older than yesterday, and tasks overdue > 1 day", () => {
    const res = buildCatchUp(
      base({
        bills: [
          { id: "b-past", dueOn: "2026-11-20", occurredOn: "2026-11-20" },
          { id: "b-today", dueOn: TODAY, occurredOn: TODAY },
        ],
        occurrences: [
          occ("s.1.2026-11-18", "2026-11-18"),
          occ("s.1.2026-11-19", "2026-11-19", "cancelled"),
          occ("s.1.2026-11-20", "2026-11-20"),
          occ("s.1.2026-11-21", "2026-11-21"), // yesterday -> stays in AttendancePrompt
        ],
        marks: new Set(["s.1.2026-11-18"]),
        tasks: [
          { id: "t-old", status: "todo", dueAt: dueAtFrom("2026-11-19", null, TZ), dueHasTime: false },
          { id: "t-yest", status: "todo", dueAt: dueAtFrom("2026-11-21", null, TZ), dueHasTime: false },
          { id: "t-done", status: "done", dueAt: dueAtFrom("2026-11-18", null, TZ), dueHasTime: false },
        ],
      }),
    );
    expect(res.billIds).toEqual(["b-past"]);
    expect(res.classKeys).toEqual(["s.1.2026-11-20"]);
    expect(res.taskIds).toEqual(["t-old"]);
    expect(res.hasAny).toBe(true);
  });

  it("hides Balances while past-due bills exist, then shows it once bills are cleared and tx is 3+ days old", () => {
    const withBills = buildCatchUp(
      base({
        bills: [{ id: "b-past", dueOn: "2026-11-19", occurredOn: "2026-11-19" }],
        lastActivityTxDate: "2026-11-18",
      }),
    );
    expect(withBills.showBalances).toBe(false);

    const afterBills = buildCatchUp(base({ lastActivityTxDate: "2026-11-19" }));
    expect(afterBills.showBalances).toBe(true);
    expect(afterBills.hasAny).toBe(true);
  });

  it("hides Balances after Looks right (balancesCheckedOn) or when user has no money activity yet", () => {
    expect(buildCatchUp(base({ lastActivityTxDate: "2026-11-15", balancesCheckedOn: TODAY })).showBalances).toBe(false);
    expect(buildCatchUp(base({ lastActivityTxDate: "2026-11-15", balancesCheckedOn: "2026-11-20" })).showBalances).toBe(
      false,
    );
    expect(buildCatchUp(base({ lastActivityTxDate: "2026-11-15", balancesCheckedOn: "2026-11-19" })).showBalances).toBe(
      true,
    );
    expect(buildCatchUp(base({ lastActivityTxDate: null })).showBalances).toBe(false);
  });

  it("keeps remaining rows visible after clearing one category (no disappearing card bug)", () => {
    // User already synced money today, so lastActivityTxDate is today, yet old classes and tasks still show.
    const res = buildCatchUp(
      base({
        lastActivityTxDate: TODAY,
        balancesCheckedOn: TODAY,
        occurrences: [occ("s.1.2026-11-19", "2026-11-19")],
        tasks: [{ id: "t-old", status: "todo", dueAt: dueAtFrom("2026-11-18", null, TZ), dueHasTime: false }],
      }),
    );
    expect(res.showBalances).toBe(false);
    expect(res.classKeys).toEqual(["s.1.2026-11-19"]);
    expect(res.taskIds).toEqual(["t-old"]);
    expect(res.hasAny).toBe(true);
  });
});
