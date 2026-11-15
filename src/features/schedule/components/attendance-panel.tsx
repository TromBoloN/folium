"use client";

import { Check, CheckCheck, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";
import { clearAttendance, markUnmarkedAttended, setAttendance } from "../actions";
import type { AttendanceStats } from "../attendance";
import type { AttendanceStatus } from "../schema";

export type RecentClass = { key: string; label: string; status: AttendanceStatus | null };

type Props = {
  courseId: string;
  stats: AttendanceStats;
  target: number;
  recent: RecentClass[];
};

/** Attendance for a course: the share attended against the campus target, and quick marks for recent classes. */
export function AttendancePanel({ courseId, stats, target, recent }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
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
        message: n === 0 ? "Nothing left to mark" : `Marked ${n} ${n === 1 ? "class" : "classes"} attended`,
        action: n ? { label: "Undo", onClick: async () => void (await clearAttendance(result.data.keys)) } : undefined,
      });
    });

  return (
    <section aria-labelledby="attendance-h" className="tile flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={percent === null ? 0 : percent / 100}
          size={64}
          label={percent === null ? "No marks" : `${Math.round(percent)}%`}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="attendance-h" className="font-medium">
            Attendance
          </h2>
          <p className="text-muted-foreground text-sm">
            {percent === null
              ? `${stats.held} ${stats.held === 1 ? "class" : "classes"} so far, none marked yet.`
              : `${stats.attended} of ${stats.attended + stats.missed} marked classes · target ${target}%`}
          </p>
          {stats.canMiss !== null ? (
            <p
              className={cn(
                "flex items-center gap-1 text-sm",
                stats.belowTarget ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {stats.belowTarget ? <TriangleAlert aria-hidden className="size-4" /> : null}
              {stats.canMiss < 0
                ? `Over the limit by ${-stats.canMiss}: check with your lecturer.`
                : stats.canMiss === 0
                  ? "You can't miss any more classes this term."
                  : `You can miss ${stats.canMiss} more of ${stats.planned} this term.`}
            </p>
          ) : stats.belowTarget ? (
            <p className="flex items-center gap-1 text-destructive text-sm">
              <TriangleAlert aria-hidden className="size-4" />
              Below your {target}% target.
            </p>
          ) : null}
        </div>
      </div>

      {recent.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border-soft">
          {recent.map((c) => (
            <RecentRow key={c.key} item={c} />
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {stats.unmarked > 0 ? (
          <Button size="sm" variant="outline" onClick={markRest} disabled={pending}>
            <CheckCheck aria-hidden />
            Mark {stats.unmarked} unmarked as attended
          </Button>
        ) : (
          <span />
        )}
        <Link
          href="/settings"
          className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
        >
          Change target
        </Link>
      </div>
    </section>
  );
}

function RecentRow({ item }: { item: RecentClass }) {
  const [status, setStatus] = useState(item.status);
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = (next: AttendanceStatus) => {
    const value = status === next ? null : next;
    const before = status;
    setStatus(value);
    start(async () => {
      const result = await setAttendance({ key: item.key, status: value });
      if (!result.ok) {
        setStatus(before);
        toast({ message: result.error, tone: "error" });
      }
    });
  };
  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <Link href={`/courses/class/${item.key}`} className="min-w-0 truncate tabular-nums hover:underline">
        {item.label}
      </Link>
      <span className="flex gap-1">
        {(
          [
            ["attended", "Attended", Check],
            ["missed", "Missed", X],
          ] as const
        ).map(([value, text, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            aria-label={`${text}: ${item.label}`}
            disabled={pending}
            onClick={() => set(value)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border border-border-soft transition-colors disabled:opacity-60",
              status === value
                ? value === "attended"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-destructive bg-destructive text-destructive-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        ))}
      </span>
    </li>
  );
}
