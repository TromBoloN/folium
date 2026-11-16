"use client";

import { CalendarClock, CircleSlash, ExternalLink, MapPin, Sprout, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Pill } from "@/components/ui/pill";
import { Tile } from "@/components/ui/tile";
import { ChangeChips } from "@/features/schedule/components/change-chips";
import type { Chip } from "@/features/schedule/format";
import { formatTime, type SlotTiming } from "@/features/timetable/logic";
import type { CivilDate } from "@/lib/dates";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { useNow } from "@/lib/use-now";
import { countdownText, nextUp } from "../now";

/** A class as the Today widgets need it: an occurrence (see buildSchedule), flattened and serialisable. */
export type HeroClass = SlotTiming & {
  key: string;
  courseId: string;
  name: string;
  code: string | null;
  color: string;
  location: string | null;
  cancelled: boolean;
  chips: Chip[];
  note: string | null;
  meetingUrl: string | null;
};

type Props = {
  initialNow: number;
  serverToday: CivilDate;
  timeZone: string;
  timeFormat: "24h" | "12h";
  /** Today's live classes (not cancelled). */
  today: HeroClass[];
  tomorrow: HeroClass[];
  /** Today's cancelled classes, mentioned under the hero. */
  cancelled: HeroClass[];
  deadline: { id: string; title: string; due: string; color: string | null; course: string | null } | null;
};

export function NextUpHero({
  initialNow,
  serverToday,
  timeZone,
  timeFormat,
  today,
  tomorrow,
  cancelled,
  deadline,
}: Props) {
  const t = useT();
  const clock = useNow(initialNow, timeZone);
  const router = useRouter();
  // Past midnight the classes above belong to yesterday: fetch the new day.
  const stale = clock.today !== serverToday;
  useEffect(() => {
    if (stale) router.refresh();
  }, [stale, router]);

  const up = nextUp(today, tomorrow, clock.minute);
  const time = (value: string) => formatTime(value, timeFormat);

  if (up.kind === "none") {
    return deadline ? <DeadlineHero deadline={deadline} /> : <QuietHero />;
  }

  const { slot } = up;
  const eyebrow = up.kind === "now" ? t("On now") : up.kind === "next" ? t("Next up") : t("Tomorrow");
  const then = up.kind === "now" || up.kind === "next" ? up.after : null;

  return (
    <Tile
      tint={slot.color}
      reveal={0}
      className="flex min-h-56 flex-col justify-between gap-6 overflow-hidden p-5 sm:p-6"
    >
      <span aria-hidden className="leaf-veins pointer-events-none absolute -right-10 -bottom-14 size-72 opacity-20" />
      <div className="relative flex flex-col gap-2">
        <span className="flex items-center gap-2 font-medium text-sm">
          <span
            aria-hidden
            className={
              up.kind === "now" ? "now-dot size-2.5 rounded-full bg-(--tint)" : "size-2.5 rounded-full bg-(--tint)"
            }
          />
          {eyebrow}
        </span>
        <Link
          href={`/courses/${slot.courseId}`}
          className="w-fit rounded-md font-display font-medium text-3xl leading-tight tracking-tight hover:underline hover:decoration-(--tint) hover:underline-offset-4 sm:text-4xl"
        >
          {slot.name}
        </Link>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
          <span className="tabular-nums">
            {time(slot.startTime)}–{time(slot.endTime)}
          </span>
          {slot.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              {slot.location}
            </span>
          ) : null}
          {slot.code ? <Pill tone="course">{slot.code}</Pill> : null}
          <ChangeChips chips={slot.chips} />
        </span>
        {slot.meetingUrl && up.kind !== "tomorrow" ? (
          <a
            href={slot.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90"
          >
            <Video aria-hidden className="size-4" />
            {t("Open link")}
            <ExternalLink aria-hidden className="size-3.5 opacity-70" />
          </a>
        ) : null}
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {up.kind === "tomorrow" ? (
            <p className="font-display text-2xl tabular-nums">
              {t("Tomorrow at {time}", { time: time(slot.startTime) })}
              <span className="block font-sans text-muted-foreground text-sm">
                {t("That's all your classes for today.")}
              </span>
            </p>
          ) : (
            <p className="font-display text-2xl tabular-nums sm:text-3xl">{countdownText(up, t)}</p>
          )}
          {up.kind === "now" ? (
            <span
              aria-hidden
              className="block h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--tint)_22%,transparent)]"
            >
              <span
                className="block h-full w-full origin-left rounded-full bg-(--tint) transition-transform duration-(--dur-base) ease-(--ease-out)"
                style={{ transform: `scaleX(${up.progress})` }}
              />
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          {then ? (
            <p className="text-muted-foreground text-sm">
              {rich(t("Then {name} at {time}"), {
                name: <span className="font-medium text-foreground">{then.code ?? then.name}</span>,
                time: <span className="tabular-nums">{time(then.startTime)}</span>,
              })}
            </p>
          ) : null}
          <CancelledNote cancelled={cancelled} time={time} />
        </div>
      </div>
    </Tile>
  );
}

/** "FIS101 07:30 cancelled": today's cancellations, so they aren't missed. */
function CancelledNote({ cancelled, time }: { cancelled: HeroClass[]; time: (value: string) => string }) {
  const t = useT();
  if (cancelled.length === 0) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
      <CircleSlash aria-hidden className="size-3.5 text-destructive" />
      {t("{names} cancelled today", {
        names: cancelled.map((c) => `${c.code ?? c.name} ${time(c.startTime)}`).join(", "),
      })}
    </p>
  );
}

function DeadlineHero({ deadline }: { deadline: NonNullable<Props["deadline"]> }) {
  const t = useT();
  return (
    <Tile
      tint={deadline.color ?? "var(--primary)"}
      reveal={0}
      className="flex min-h-56 flex-col justify-between gap-6 overflow-hidden p-5 sm:p-6"
    >
      <span aria-hidden className="leaf-veins pointer-events-none absolute -right-10 -bottom-14 size-72 opacity-20" />
      <div className="relative flex flex-col gap-2">
        <span className="flex items-center gap-2 font-medium text-sm">
          <CalendarClock aria-hidden className="size-4" />
          {t("No more classes · next deadline")}
        </span>
        <Link
          href={`/tasks/${deadline.id}`}
          className="w-fit font-display font-medium text-3xl leading-tight tracking-tight hover:underline hover:underline-offset-4 sm:text-4xl"
        >
          {deadline.title}
        </Link>
      </div>
      <p className="relative flex flex-wrap items-center gap-2 font-display text-2xl">
        {t("Due {when}", { when: deadline.due })}
        {deadline.course ? <Pill tone="course">{deadline.course}</Pill> : null}
      </p>
    </Tile>
  );
}

function QuietHero() {
  const t = useT();
  return (
    <Tile reveal={0} className="flex min-h-56 flex-col justify-end gap-2 overflow-hidden p-5 sm:p-6">
      <span aria-hidden className="leaf-veins pointer-events-none absolute -right-10 -bottom-14 size-72 opacity-15" />
      <Sprout aria-hidden className="relative size-6 text-primary" />
      <p className="relative font-display text-3xl">{t("Nothing scheduled.")}</p>
      <p className="relative text-muted-foreground text-sm">
        {t("No classes today or tomorrow, and no deadlines.")}{" "}
        <Link href="/courses" className="text-foreground underline underline-offset-4">
          {t("Add class times")}
        </Link>
      </p>
    </Tile>
  );
}
