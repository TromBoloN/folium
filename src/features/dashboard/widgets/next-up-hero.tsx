"use client";

import { ExternalLink, MapPin, Sprout, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Pill } from "@/components/ui/pill";
import { Tile } from "@/components/ui/tile";
import { ChangeChips } from "@/features/schedule/components/change-chips";
import { MeetingQuick, useMeetingLabel } from "@/features/schedule/components/meeting-quick";
import type { Chip } from "@/features/schedule/format";
import type { MeetingInfo } from "@/features/schedule/meetings";
import type { AttendanceStatus } from "@/features/schedule/schema";
import { formatTime, type SlotTiming } from "@/features/timetable/logic";
import type { CivilDate } from "@/lib/dates";
import { useT } from "@/lib/i18n/client";
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
  postponed?: boolean;
  chips: Chip[];
  note: string | null;
  meetingUrl: string | null;
  /** The meeting this class is (if marked) or will log (if not). */
  meeting?: MeetingInfo | null;
  /** Already marked: one answer per class. */
  mark?: { status: AttendanceStatus; number: number | null } | null;
};

type Props = {
  initialNow: number;
  serverToday: CivilDate;
  timeZone: string;
  timeFormat: "24h" | "12h";
  /** Today's live classes (not cancelled). */
  today: HeroClass[];
  tomorrow: HeroClass[];
};

export function NextUpHero({ initialNow, serverToday, timeZone, timeFormat, today, tomorrow }: Props) {
  const t = useT();
  const clock = useNow(initialNow, timeZone);
  const router = useRouter();
  // Past midnight the classes above belong to yesterday: fetch the new day.
  const stale = clock.today !== serverToday;
  useEffect(() => {
    if (stale) router.refresh();
  }, [stale, router]);

  const meetingLabel = useMeetingLabel();
  // Only look ahead to tomorrow when there are no classes today at all.
  const up = nextUp(today, today.length === 0 ? tomorrow : [], clock.minute);
  const time = (value: string) => formatTime(value, timeFormat);

  if (up.kind === "none") {
    return <DoneHero />;
  }

  const { slot } = up;
  const eyebrow = up.kind === "now" ? t("On now") : up.kind === "next" ? t("Next up") : t("Tomorrow");

  return (
    <Tile
      tint={slot.color}
      reveal={0}
      data-emphasis="primary"
      data-state={up.kind}
      className="flex min-h-48 flex-col justify-between gap-5 overflow-hidden p-5 sm:p-6"
    >
      <span
        aria-hidden
        data-slot="hero-art"
        className="leaf-veins pointer-events-none absolute -right-10 -bottom-14 size-72 opacity-20"
      />
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
          {slot.meeting && up.kind !== "now" ? (
            <span className="tabular-nums">{meetingLabel(slot.meeting)}</span>
          ) : null}
          <ChangeChips chips={slot.chips} />
        </span>
        {slot.meetingUrl && up.kind !== "tomorrow" ? (
          <a
            href={slot.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-pill bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90"
          >
            <Video aria-hidden className="size-4" />
            {t("Open link")}
            <ExternalLink aria-hidden className="size-3.5 opacity-70" />
          </a>
        ) : null}
      </div>

      <div className="relative flex min-w-0 flex-col gap-2">
        <p className="font-display text-2xl tabular-nums sm:text-3xl">
          {up.kind === "tomorrow" ? t("Tomorrow at {time}", { time: time(slot.startTime) }) : countdownText(up, t)}
        </p>
        {up.kind === "now" ? (
          <MeetingQuick
            key={slot.key}
            target={{
              key: slot.key,
              name: slot.name,
              when: `${t("Today")} ${time(slot.startTime)}`,
              date: serverToday,
              startTime: slot.startTime,
              endTime: slot.endTime,
              location: slot.location,
              // Weekly classes can wait for a new date; an extra session can only move or be cancelled.
              canWait: slot.key.startsWith("s."),
            }}
            meeting={slot.meeting ?? null}
            initial={slot.mark ?? null}
          />
        ) : null}
        {up.kind === "now" ? (
          <span
            aria-hidden
            className="block h-1.5 w-full max-w-sm overflow-hidden rounded-pill bg-[color-mix(in_oklab,var(--tint)_22%,transparent)]"
          >
            <span
              className="block h-full w-full origin-left rounded-pill bg-(--tint) transition-transform duration-(--dur-base) ease-(--ease-out)"
              style={{ transform: `scaleX(${up.progress})` }}
            />
          </span>
        ) : null}
      </div>
    </Tile>
  );
}

function DoneHero() {
  const t = useT();
  return (
    <Tile reveal={0} className="flex min-h-36 flex-col justify-end gap-2 overflow-hidden p-5 sm:p-6">
      <span
        aria-hidden
        data-slot="hero-art"
        className="leaf-veins pointer-events-none absolute -right-10 -bottom-14 size-72 opacity-15"
      />
      <Sprout aria-hidden className="relative size-6 text-primary" />
      <p className="relative font-display text-2xl sm:text-3xl">{t("Done for today")}</p>
    </Tile>
  );
}
