import { addDays, type IsoDate } from "./local-date";

/**
 * Which bills to remind about today: planned rows from a rule whose reminder
 * window has started (due − remind_days_before ≤ today ≤ due). The ref key
 * (row id + due date) makes each reminder unique in notification_log, so a
 * retried cron never sends twice, and a moved due date reminds again.
 */
export type BillRow = { id: string; name: string; amount: bigint; dueOn: IsoDate; remindDaysBefore: number };

export function remindersDue(rows: readonly BillRow[], today: IsoDate): (BillRow & { refKey: string })[] {
  return rows
    .filter((r) => r.dueOn >= today && addDays(r.dueOn, -Math.max(0, r.remindDaysBefore)) <= today)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.name.localeCompare(b.name))
    .map((r) => ({ ...r, refKey: `${r.id}:${r.dueOn}` }));
}

/** The weekly summary's key: one per user per ISO week (its Monday). */
export function weekKey(today: IsoDate): string {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return `week:${addDays(today, -((day + 6) % 7))}`;
}

/** Bills in the next 7 days, overdue first: for Today and Overview. */
export function upcomingBills<T extends { dueOn: IsoDate }>(rows: readonly T[], today: IsoDate, days = 7) {
  const end = addDays(today, days);
  const overdue = rows.filter((r) => r.dueOn < today).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const soon = rows.filter((r) => r.dueOn >= today && r.dueOn <= end).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return { overdue, soon };
}
