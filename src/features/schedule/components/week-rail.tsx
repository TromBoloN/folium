import { CalendarOff, Download } from "lucide-react";
import Link from "next/link";
import type { Week } from "@/features/timetable/week";
import { formatDate } from "@/lib/dates";
import type { ClassBreak } from "../occurrences";
import { BreakBanner } from "./break-banner";
import { ChangeChips } from "./change-chips";

/** Beside the by-day list on wide screens: this week's changes at a glance, and breaks coming up. */
export function WeekRail({ week, breaks }: { week: Week; breaks: ClassBreak[] }) {
  const changed = week.days.flatMap((d) =>
    d.items.filter((i) => i.chips.some((c) => c.kind !== "online")).map((i) => ({ ...i, date: d.date })),
  );
  return (
    <aside aria-label="Changes and breaks" className="flex flex-col gap-4 xl:sticky xl:top-8">
      <section aria-labelledby="changes-h" className="tile flex flex-col gap-3 p-4">
        <h2 id="changes-h" className="font-medium">
          Changes this week
        </h2>
        {changed.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            None: every class is as usual. Tap a class if something changes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {changed.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/courses/class/${i.id}`}
                  className="flex flex-col gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{i.title}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatDate(i.date, { weekday: "short", day: "numeric" })} · {i.timeLabel.split("–")[0]}
                    </span>
                  </span>
                  <ChangeChips chips={i.chips.filter((c) => c.kind !== "online")} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="breaks-h" className="tile flex flex-col gap-3 p-4">
        <h2 id="breaks-h" className="font-medium">
          Breaks
        </h2>
        {breaks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No holidays or exam weeks coming up.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {breaks.map((b) => (
              <li key={b.id} className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatDate(b.startsOn, { day: "numeric", month: "short" })}
                  {b.endsOn !== b.startsOn ? ` – ${formatDate(b.endsOn, { day: "numeric", month: "short" })}` : ""}
                </span>
                <BreakBanner id={b.id} label={b.label} />
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/courses/breaks/new?from=${week.next}`}
          className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        >
          <CalendarOff aria-hidden className="size-4" />
          Add a break
        </Link>
      </section>
      <a
        href="/courses/calendar.ics"
        download
        className="inline-flex w-fit items-center gap-1.5 px-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <Download aria-hidden className="size-4" />
        Export to Google or Apple Calendar (.ics)
      </a>
    </aside>
  );
}
