"use client";

import { CalendarCheck2, Clock, Receipt, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { resolvePastDueBills, resolvePastDueBillsForm, undoPastDueBills } from "@/features/finance/actions/planning";
import { clearAttendance, markOccurrencesBatch, markOccurrencesBatchForm } from "@/features/schedule/actions";
import { markBalancesChecked, markBalancesCheckedForm } from "@/features/settings/actions";
import { BulkOverdueBar } from "@/features/tasks/components/bulk-overdue-bar";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/core";
import type { CatchUpSummary } from "../catch-up";

const chip =
  "inline-flex min-h-9 items-center gap-1 rounded-pill border border-border bg-surface-1 px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60";

const primaryChip =
  "inline-flex min-h-9 items-center gap-1 rounded-pill border border-primary/40 bg-accent px-2.5 font-medium text-accent-foreground text-xs transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60";

/**
 * One-place catch-up at the top of Today.
 *
 * Bills always appear before Balances (which stays hidden until past-due bills
 * clear, preventing double-counting). Each row vanishes as it is cleared, and
 * the whole card disappears once nothing is left.
 */
export function WelcomeBackCard({ summary }: { summary: CatchUpSummary }) {
  const [cleared, setCleared] = useState({ bills: false, balances: false, classes: false, tasks: false });
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const { t, tl } = useI18n();

  const showBills = summary.billIds.length > 0 && !cleared.bills;
  const showBalances = summary.showBalances && !cleared.balances && !showBills;
  const showClasses = summary.classKeys.length > 0 && !cleared.classes;
  const showTasks = summary.taskIds.length > 0 && !cleared.tasks;

  if (!showBills && !showBalances && !showClasses && !showTasks) return null;

  const handleBills = (action: "paid" | "skip") =>
    start(async () => {
      const result = await resolvePastDueBills({ action, ids: summary.billIds });
      if (!result.ok) {
        toast({ message: tl(result.error), tone: "error" });
        return;
      }
      setCleared((c) => ({ ...c, bills: true }));
      const { count, undo } = result.data;
      if (count > 0) {
        const message =
          action === "paid"
            ? t(plural(count, "Marked 1 bill paid", "Marked {n} bills paid"), { n: count })
            : t(plural(count, "Skipped 1 bill", "Skipped {n} bills"), { n: count });
        toast({
          message,
          duration: 8000,
          action: {
            label: t("Undo"),
            onClick: async () => {
              const undone = await undoPastDueBills(undo);
              if (!undone.ok) toast({ message: tl(undone.error), tone: "error" });
              else {
                setCleared((c) => ({ ...c, bills: false }));
                router.refresh();
              }
            },
          },
        });
      }
      // Refresh so Balances can appear next if balances are also stale.
      router.refresh();
    });

  const handleLooksRight = () =>
    start(async () => {
      const result = await markBalancesChecked();
      if (result && !result.ok) {
        toast({ message: tl(result.error), tone: "error" });
        return;
      }
      setCleared((c) => ({ ...c, balances: true }));
      toast({ message: t("Balances marked up to date") });
    });

  const handleClasses = (status: "attended" | "missed") =>
    start(async () => {
      const result = await markOccurrencesBatch({ keys: summary.classKeys, status });
      if (!result.ok) {
        toast({ message: tl(result.error), tone: "error" });
        return;
      }
      setCleared((c) => ({ ...c, classes: true }));
      const count = result.data.keys.length;
      if (count > 0) {
        const message =
          status === "attended"
            ? t(plural(count, "Marked 1 class attended", "Marked {n} classes attended"), { n: count })
            : t(plural(count, "Marked 1 class skipped", "Marked {n} classes skipped"), { n: count });
        toast({
          message,
          duration: 8000,
          action: {
            label: t("Undo"),
            onClick: async () => {
              const undone = await clearAttendance(result.data.keys);
              if (!undone.ok) toast({ message: tl(undone.error), tone: "error" });
              else {
                setCleared((c) => ({ ...c, classes: false }));
                router.refresh();
              }
            },
          },
        });
      }
    });

  return (
    <section
      aria-labelledby="welcome-back-h"
      className="tile reveal flex flex-col gap-3 p-4 sm:p-5"
      style={{ "--i": 0 } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-4.5 shrink-0 text-primary" />
        <h2 id="welcome-back-h" className="font-medium text-sm">
          {t("Welcome back")}
        </h2>
      </div>

      <ul className="flex flex-col divide-y divide-border-soft">
        {showBills ? (
          <li className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2 text-sm">
              <Receipt aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {t(plural(summary.billIds.length, "1 bill passed due", "{n} bills passed due"), {
                  n: summary.billIds.length,
                })}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <form
                action={resolvePastDueBillsForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBills("paid");
                }}
                className="inline"
              >
                <input type="hidden" name="action" value="paid" />
                {summary.billIds.map((id) => (
                  <input key={id} type="hidden" name="id" value={id} />
                ))}
                <button type="submit" disabled={pending} className={primaryChip}>
                  {t("Mark paid")}
                </button>
              </form>
              <form
                action={resolvePastDueBillsForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBills("skip");
                }}
                className="inline"
              >
                <input type="hidden" name="action" value="skip" />
                {summary.billIds.map((id) => (
                  <input key={id} type="hidden" name="id" value={id} />
                ))}
                <button type="submit" disabled={pending} className={chip}>
                  {t("Skip")}
                </button>
              </form>
            </span>
          </li>
        ) : null}

        {showBalances ? (
          <li className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2 text-sm">
              <Wallet aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span>{t("Balances may be off")}</span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {/* Step 2 switches this to /money/sync once the Sync sheet exists. */}
              <Link href="/money/accounts" className={primaryChip}>
                {t("Sync")}
              </Link>
              <form
                action={markBalancesCheckedForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLooksRight();
                }}
                className="inline"
              >
                <button type="submit" disabled={pending} className={chip}>
                  {t("Looks right")}
                </button>
              </form>
            </span>
          </li>
        ) : null}

        {showClasses ? (
          <li className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2 text-sm">
              <CalendarCheck2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {t(plural(summary.classKeys.length, "1 class to confirm", "{n} classes to confirm"), {
                  n: summary.classKeys.length,
                })}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <form
                action={markOccurrencesBatchForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleClasses("attended");
                }}
                className="inline"
              >
                <input type="hidden" name="status" value="attended" />
                {summary.classKeys.map((k) => (
                  <input key={k} type="hidden" name="key" value={k} />
                ))}
                <button type="submit" disabled={pending} className={primaryChip}>
                  {t("All attended")}
                </button>
              </form>
              <form
                action={markOccurrencesBatchForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleClasses("missed");
                }}
                className="inline"
              >
                <input type="hidden" name="status" value="missed" />
                {summary.classKeys.map((k) => (
                  <input key={k} type="hidden" name="key" value={k} />
                ))}
                <button type="submit" disabled={pending} className={chip}>
                  {t("All skipped")}
                </button>
              </form>
              <Link href="/courses?view=day" className={chip}>
                {t("Review")}
                <span className="sr-only"> {t("classes")}</span>
              </Link>
            </span>
          </li>
        ) : null}

        {showTasks ? (
          <li className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2 text-sm">
              <Clock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {t(plural(summary.taskIds.length, "1 task waiting", "{n} tasks waiting"), {
                  n: summary.taskIds.length,
                })}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <BulkOverdueBar
                ids={summary.taskIds}
                onDone={() => setCleared((c) => ({ ...c, tasks: true }))}
                onUndone={() => {
                  setCleared((c) => ({ ...c, tasks: false }));
                  router.refresh();
                }}
              />
              <Link href="/tasks?due=overdue" className={chip}>
                {t("Review")}
                <span className="sr-only"> {t("tasks")}</span>
              </Link>
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
