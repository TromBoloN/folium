import { io } from "next/cache";
import { lastActivityTransactionDate, listAccounts } from "@/features/finance/queries";
import { ensureRecurringGenerated, listBills } from "@/features/finance/queries/planning";
import { getMeetingLog, getSchedule } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { listOpenTasks } from "@/features/tasks/queries";
import { addDays, todayIn } from "@/lib/dates";
import { buildCatchUp, CATCHUP_CLASS_LOOKBACK_DAYS } from "../catch-up";
import { WelcomeBackCard } from "./welcome-back-card";

/**
 * Backlog-driven catch-up card at the top of Today. Renders nothing when there
 * are no past-due bills, stale balances, older-than-yesterday unmarked classes,
 * or tasks overdue by more than a day.
 */
export async function WelcomeBack() {
  const { preferences } = await getSettings();
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);

  await ensureRecurringGenerated(today);
  const [bills, accounts, lastTxDate, occurrences, log, tasks] = await Promise.all([
    listBills(),
    listAccounts(),
    lastActivityTransactionDate(),
    getSchedule({ from: addDays(today, -CATCHUP_CLASS_LOOKBACK_DAYS), to: addDays(today, -2) }),
    getMeetingLog(),
    listOpenTasks(),
  ]);

  const summary = buildCatchUp({
    today,
    now,
    timeZone: preferences.timeZone,
    bills,
    hasActiveAccounts: accounts.some((a) => !a.archived),
    lastActivityTxDate: lastTxDate,
    balancesCheckedOn: preferences.catchUp.balancesCheckedOn,
    occurrences,
    marks: new Set(log.marks.keys()),
    progress: log.progress,
    tasks,
  });

  if (!summary.hasAny) return null;
  return <WelcomeBackCard summary={summary} />;
}
