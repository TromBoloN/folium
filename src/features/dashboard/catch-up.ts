import type { MeetingProgress } from "@/features/schedule/meetings";
import { isCounted } from "@/features/schedule/meetings";
import { isLive, type Occurrence } from "@/features/schedule/occurrences";
import { type Due, dueParts, dueState } from "@/features/tasks/due";
import { addDays, type CivilDate } from "@/lib/dates";

/** How far back Welcome back looks for unmarked past classes. */
export const CATCHUP_CLASS_LOOKBACK_DAYS = 14;
/** Days without a manual transaction (or balance check) before "Balances may be off" appears. */
export const BALANCES_STALE_DAYS = 3;

export type CatchUpBill = {
  id: string;
  dueOn: CivilDate | null;
  occurredOn: CivilDate;
};

export type CatchUpTask = Due & {
  id: string;
  status: string;
};

export type CatchUpInput = {
  today: CivilDate;
  now: Date;
  timeZone: string;
  bills: readonly CatchUpBill[];
  hasActiveAccounts: boolean;
  /** Most recent posted non-recurring transaction date, or null if the user hasn't tracked money yet. */
  lastActivityTxDate: CivilDate | null;
  balancesCheckedOn: CivilDate | null;
  occurrences: readonly Occurrence[];
  marks: ReadonlySet<string>;
  progress: ReadonlyMap<string, Pick<MeetingProgress, "countFrom">>;
  tasks: readonly CatchUpTask[];
};

export type CatchUpSummary = {
  billIds: string[];
  showBalances: boolean;
  classKeys: string[];
  taskIds: string[];
  hasAny: boolean;
};

/**
 * Backlog-driven catch-up for Today ("Welcome back").
 *
 * Shown only when something from before yesterday is waiting — never gated on
 * "days since last visit", so clearing the first row never hides the rest.
 * Balances wait until past-due bills are cleared so a paid bill isn't counted twice.
 */
export function buildCatchUp(input: CatchUpInput): CatchUpSummary {
  const yesterday = addDays(input.today, -1);
  const staleCutoff = addDays(input.today, -BALANCES_STALE_DAYS);

  const billIds = input.bills.filter((b) => (b.dueOn ?? b.occurredOn) < input.today).map((b) => b.id);

  const classKeys = input.occurrences
    .filter(
      (o) =>
        isLive(o) &&
        o.date < yesterday &&
        isCounted(o, input.progress.get(o.courseId)?.countFrom ?? null) &&
        !input.marks.has(o.key),
    )
    .map((o) => o.key);

  const taskIds = input.tasks
    .filter(
      (t) =>
        dueState(t, input.now, input.timeZone) === "overdue" &&
        t.dueAt !== null &&
        dueParts(t.dueAt, t.dueHasTime, input.timeZone).date < yesterday,
    )
    .map((t) => t.id);

  const checkedRecently = input.balancesCheckedOn !== null && input.balancesCheckedOn > staleCutoff;
  const txStale = input.lastActivityTxDate !== null && input.lastActivityTxDate <= staleCutoff;
  const showBalances = billIds.length === 0 && input.hasActiveAccounts && txStale && !checkedRecently;

  return {
    billIds,
    showBalances,
    classKeys,
    taskIds,
    hasAny: billIds.length > 0 || showBalances || classKeys.length > 0 || taskIds.length > 0,
  };
}
