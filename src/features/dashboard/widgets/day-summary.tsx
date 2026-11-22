"use client";

import { CheckCircle2, MapPin } from "lucide-react";
import Link from "next/link";
import { ChangeChip } from "@/features/schedule/components/change-chips";
import { formatTime } from "@/features/timetable/logic";
import { useT } from "@/lib/i18n/client";
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
 * Shown when today's classes are over (just "Done for today") or when today has
 * no classes at all (then shows Tomorrow's classes, if any).
 */
export function DaySummary({ past, cancelled = [], tomorrow, timeFormat }: Props) {
  const t = useT();
  const time = (value: string) => formatTime(value, timeFormat);
  const showTomorrow = past.length === 0 && tomorrow.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {past.length > 0 ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <CheckCircle2 aria-hidden className="size-4 text-primary" />
          {t("Done for today")}
        </p>
      ) : null}

      {cancelled.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {cancelled.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-2 py-0.5 text-muted-foreground text-xs"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-(--tint)"
                style={{ "--tint": c.color } as React.CSSProperties}
              />
              <span className="line-through">
                {c.code ?? c.name} · {time(c.startTime)}
              </span>
              <span className="sr-only">{t(" (cancelled)")}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {showTomorrow ? (
        <section aria-labelledby="tomorrow-classes" className="flex flex-col gap-2">
          <h3 id="tomorrow-classes" className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t("Tomorrow")}
          </h3>
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
        </section>
      ) : null}
    </div>
  );
}
