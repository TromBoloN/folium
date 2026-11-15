import { CheckCircle2, MapPin, Moon } from "lucide-react";
import Link from "next/link";
import { formatTime } from "@/features/timetable/logic";
import type { HeroClass } from "./next-up-hero";

type Props = {
  /** Today's classes; all of them are over (or there are none). */
  past: HeroClass[];
  tomorrow: HeroClass[];
  timeFormat: "24h" | "12h";
};

/**
 * What the classes tile shows once today has no more classes: a short note on
 * today, then tomorrow's classes, so the space looks ahead instead of at an
 * empty time axis. No hooks, so both the server widget and the live timeline use it.
 */
export function DaySummary({ past, tomorrow, timeFormat }: Props) {
  const time = (t: string) => formatTime(t, timeFormat);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        {past.length > 0 ? (
          <>
            <CheckCircle2 aria-hidden className="size-4 text-primary" />
            Done for today: {past.length === 1 ? "1 class" : `${past.length} classes`}.
          </>
        ) : (
          <>
            <Moon aria-hidden className="size-4 text-muted-foreground" />
            No classes today.
          </>
        )}
      </p>
      {past.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {past.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-(--tint)"
                style={{ "--tint": c.color } as React.CSSProperties}
              />
              {c.code ?? c.name} · {time(c.startTime)}
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="tomorrow-classes" className="flex flex-col gap-2">
        <h3 id="tomorrow-classes" className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Tomorrow
        </h3>
        {tomorrow.length === 0 ? (
          <p className="text-muted-foreground text-sm">No classes tomorrow either.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tomorrow.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.courseId}`}
                  style={{ "--tint": c.color } as React.CSSProperties}
                  className="relative flex items-center gap-3 overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--tint)_12%,var(--surface-1))] py-2 pr-3 pl-4 text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--tint)_20%,var(--surface-1))]"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
                  <span className="w-24 shrink-0 text-xs tabular-nums">
                    {time(c.startTime)}–{time(c.endTime)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.code ?? c.name}</span>
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
        href="/courses/timetable"
        className="mt-auto w-fit text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
      >
        See the week
      </Link>
    </div>
  );
}
