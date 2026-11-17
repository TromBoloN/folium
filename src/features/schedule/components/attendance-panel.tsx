"use client";

import { CheckCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useT } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import { clearAttendance, markUnmarkedAttended, setMeetingStatus } from "../actions";
import type { AttendanceStats } from "../attendance";
import type { AttendanceStatus } from "../schema";
import { AttendanceQuick } from "./attendance-quick";

/**
 * One meeting in the list: a class (key, with its date in the label) or a
 * meeting known only by its number (before counting started; no date guessed).
 */
export type MeetingItem = {
  id: string;
  key: string | null;
  /** Logged, or the number it will take; null when the course is over. */
  number: number | null;
  /** "Meeting 14" or "Meeting 15 · Tue 24 Nov 02:40". */
  label: string;
  status: AttendanceStatus | null;
};

/** Newest meetings shown; the rest fold away. */
const SHOWN = 6;

type Props = {
  courseId: string;
  stats: AttendanceStats;
  target: number;
  meetings: MeetingItem[];
};

/** Attendance for a course: the share attended against the campus target, and quick marks for recent classes. */
export function AttendancePanel({ courseId, stats, target, meetings }: Props) {
  const toast = useToast();
  const t = useT();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const percent = stats.percent;

  const markRest = () =>
    start(async () => {
      const result = await markUnmarkedAttended(courseId);
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      const n = result.data.keys.length;
      toast({
        message:
          n === 0
            ? t("Nothing left to mark")
            : t(plural(n, "Marked 1 class attended", "Marked {n} classes attended"), { n }),
        action: n
          ? { label: t("Undo"), onClick: async () => void (await clearAttendance(result.data.keys)) }
          : undefined,
      });
    });

  return (
    <section aria-labelledby="attendance-h" className="tile flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={percent === null ? 0 : percent / 100}
          size={64}
          label={percent === null ? t("No marks") : `${Math.round(percent)}%`}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="attendance-h" className="font-medium">
            {t("Attendance")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {percent === null
              ? t(plural(stats.held, "1 class so far, none marked yet.", "{n} classes so far, none marked yet."), {
                  n: stats.held,
                })
              : t("{n} of {total} marked classes · target {target}%", {
                  n: stats.attended,
                  total: stats.attended + stats.missed,
                  target,
                })}
          </p>
          {stats.unknown ? (
            <p className="text-muted-foreground text-xs">
              {t(
                plural(
                  stats.unknown,
                  "1 meeting from before you started counting isn't included.",
                  "{n} meetings from before you started counting aren't included.",
                ),
                { n: stats.unknown },
              )}
            </p>
          ) : null}
          {stats.canMiss !== null ? (
            <p
              className={cn(
                "flex items-center gap-1 text-sm",
                stats.belowTarget ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {stats.belowTarget ? <TriangleAlert aria-hidden className="size-4" /> : null}
              {stats.canMiss < 0
                ? t("Over the limit by {n}: check with your lecturer.", { n: -stats.canMiss })
                : stats.canMiss === 0
                  ? t("You can't miss any more classes this term.")
                  : t("You can miss {n} more of {total} this term.", { n: stats.canMiss, total: stats.planned ?? 0 })}
            </p>
          ) : stats.belowTarget ? (
            <p className="flex items-center gap-1 text-destructive text-sm">
              <TriangleAlert aria-hidden className="size-4" />
              {t("Below your {target}% target.", { target })}
            </p>
          ) : null}
        </div>
      </div>

      {meetings.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border-soft">
          {meetings.slice(0, SHOWN).map((m) => (
            <MeetingRow key={m.id} item={m} courseId={courseId} />
          ))}
        </ul>
      ) : null}
      {meetings.length > SHOWN ? (
        <details className="group -mt-2">
          <summary className="w-fit cursor-pointer list-none rounded-md text-muted-foreground text-sm hover:text-foreground">
            {t("Show all {n} meetings", { n: meetings.length })}
          </summary>
          <ul className="flex flex-col divide-y divide-border-soft">
            {meetings.slice(SHOWN).map((m) => (
              <MeetingRow key={m.id} item={m} courseId={courseId} />
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {stats.unmarked > 0 ? (
          confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              {t("Mark all {n} unmarked classes as attended?", { n: stats.unmarked })}
              <Button
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  markRest();
                }}
                disabled={pending}
              >
                {t("Yes, mark {n}", { n: stats.unmarked })}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t("Cancel")}
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)} disabled={pending}>
              <CheckCheck aria-hidden />
              {t("Mark {n} unmarked as attended…", { n: stats.unmarked })}
            </Button>
          )
        ) : (
          <span />
        )}
        <Link
          href="/settings"
          className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("Change target")}
        </Link>
      </div>
    </section>
  );
}

function MeetingRow({ item, courseId }: { item: MeetingItem; courseId: string }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      {item.key ? (
        <Link href={`/courses/class/${item.key}`} className="min-w-0 truncate tabular-nums hover:underline">
          {item.label}
        </Link>
      ) : (
        <span className="min-w-0 truncate tabular-nums">{item.label}</span>
      )}
      <AttendanceQuick
        occurrenceKey={item.key ?? ""}
        initial={item.status}
        label={item.label}
        meeting={item.number}
        save={
          item.key || item.number === null
            ? undefined
            : (status) => setMeetingStatus({ courseId, number: item.number as number, status })
        }
      />
    </li>
  );
}
