"use client";

import { CheckCircle2, MapPin, Moon } from "lucide-react";
import Link from "next/link";
import { ChangeChip } from "@/features/schedule/components/change-chips";
import { formatTime } from "@/features/timetable/logic";
import { useT } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/core";
import type { HeroClass } from "./next-up-hero";

type Props = {
  /** Today's classes; all of them are over (or there are none). */
  past: HeroClass[];
  /** Today's cancelled classes. */
  cancelled?: HeroClass[];
  tomorrow: HeroClass[];
  timeFormat: "24h" | "12h";
};

/**
 * What the classes tile shows once today has no more classes: a short note on
 * today, then tomorrow's classes, so the space looks ahead instead of at an
 * empty time axis. No hooks, so both the server widget and the live timeline use it.
 */
export function DaySummary({ past, cancelled = [], tomorrow, timeFormat }: Props) {
  const t = useT();
  const time = (value: string) => formatTime(value, timeFormat);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        {past.length > 0 ? (
          <>
            <CheckCircle2 aria-hidden className="size-4 text-primary" />
            {t(plural(past.length, "Done for today: 1 class.", "Done for today: {n} classes."), { n: past.length })}
          </>
        ) : (
          <>
            <Moon aria-hidden className="size-4 text-muted-foreground" />
            {cancelled.length > 0
              ? t(
                  plural(
                    cancelled.length,
                    "No classes today: 1 was cancelled.",
                    "No classes today: {n} were cancelled.",
                  ),
                  {
                    n: cancelled.length,
                  },
                )
              : t("No classes today.")}
          </>
        )}
      </p>
      {past.length + cancelled.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {[...past, ...cancelled].map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-(--tint)"
                style={{ "--tint": c.color } as React.CSSProperties}
              />
              <span className={c.cancelled ? "line-through" : undefined}>
                {c.code ?? c.name} · {time(c.startTime)}
              </span>
              {c.cancelled ? <span className="sr-only">{t(" (cancelled)")}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="tomorrow-classes" className="flex flex-col gap-2">
        <h3 id="tomorrow-classes" className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t("Tomorrow")}
        </h3>
        {tomorrow.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("No classes tomorrow either.")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tomorrow.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/class/${c.key}`}
                  style={{ "--tint": c.color } as React.CSSProperties}
                  className="relative flex items-center gap-3 overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--tint)_12%,var(--surface-1))] py-2 pr-3 pl-4 text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--tint)_20%,var(--surface-1))]"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
                  <span className="w-24 shrink-0 text-xs tabular-nums">
                    {time(c.startTime)}–{time(c.endTime)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.code ?? c.name}</span>
                  {/* The location already shows a changed room; other changes get their chip. */}
                  {c.chips.find((chip) => chip.kind !== "room") ? (
                    <ChangeChip chip={c.chips.find((chip) => chip.kind !== "room") ?? c.chips[0]} compact />
                  ) : null}
                  {c.location ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                      <MapPin aria-hidden className="size-3" />
                      {c.location}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link
        href="/courses?view=day"
        className="mt-auto w-fit text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("See the week")}
      </Link>
    </div>
  );
}
