import { CalendarClock, ExternalLink, Mail, MapPin, MessageCircle, Pencil, Video } from "lucide-react";
import { io } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { requireUser } from "@/features/auth/queries";
import { listCourses } from "@/features/courses/queries";
import { whatsappLink } from "@/features/courses/schema";
import { getSettings } from "@/features/settings/queries";
import { formatDate, minutesNowIn, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatTime, toMinutes } from "../../timetable/logic";
import { occurrenceChips, placementLabel, timeRange } from "../format";
import { isLive } from "../occurrences";
import { getOccurrence, listAttendanceMarks } from "../queries";
import { ChangeChips } from "./change-chips";
import { ClassActions } from "./class-actions";

/**
 * One class on one date: what's happening, and "Changed?" (cancel, move,
 * room), attendance, the meeting link and the lecturer's contact.
 */
export async function ClassScreen({ occurrenceKey, variant }: { occurrenceKey: string; variant: "page" | "sheet" }) {
  await requireUser();
  const [occurrence, { preferences }, courses] = await Promise.all([
    getOccurrence(occurrenceKey),
    getSettings(),
    listCourses(),
  ]);
  if (!occurrence) notFound();
  await io();
  const now = new Date();
  const today = todayIn(preferences.timeZone, now);
  const nowMinute = minutesNowIn(preferences.timeZone, now);
  const fmt = preferences.timeFormat;
  const course = courses.find((c) => c.id === occurrence.courseId);
  const marks = await listAttendanceMarks(occurrence.courseId);
  const started =
    occurrence.date < today || (occurrence.date === today && toMinutes(occurrence.startTime) <= nowMinute);
  const cancelled = occurrence.status === "cancelled";
  const back = `/courses?view=day&week=${occurrence.date}`;

  return (
    <div className="flex flex-col gap-6" style={{ "--tint": occurrence.course.color } as React.CSSProperties}>
      {variant === "page" ? (
        <PageHeader title={occurrence.course.name} back={<BackLink href={back}>Schedule</BackLink>} />
      ) : null}

      <section className="tile tile-tinted relative flex flex-col gap-3 overflow-hidden p-4 pl-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
        {variant === "sheet" ? (
          <div className="flex flex-wrap items-center gap-2">
            {occurrence.course.code ? <Pill tone="course">{occurrence.course.code}</Pill> : null}
            <h3 className="font-display font-medium text-2xl leading-tight">{occurrence.course.name}</h3>
          </div>
        ) : null}
        <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", cancelled && "text-muted-foreground")}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
            <span className={cn("font-medium", cancelled && "line-through")}>
              {formatDate(occurrence.date, { weekday: "long", day: "numeric", month: "long" })},{" "}
              <span className="tabular-nums">{timeRange(occurrence, fmt)}</span>
            </span>
          </span>
          {occurrence.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4 text-muted-foreground" />
              {occurrence.location}
            </span>
          ) : null}
        </p>
        <ChangeChips chips={occurrenceChips(occurrence, fmt)} />
        {occurrence.note ? <p className="text-muted-foreground text-sm">“{occurrence.note}”</p> : null}
        {occurrence.status === "moved" && occurrence.from ? (
          <p className="text-muted-foreground text-xs">
            Usually {placementLabel(occurrence.from, fmt)}–{formatTime(occurrence.from.endTime, fmt)}
          </p>
        ) : null}
        {occurrence.meetingUrl && isLive(occurrence) ? (
          <Button asChild size="sm" className="w-fit">
            <a href={occurrence.meetingUrl} target="_blank" rel="noopener noreferrer">
              <Video aria-hidden />
              Open meeting link
              <ExternalLink aria-hidden className="opacity-70" />
            </a>
          </Button>
        ) : null}
      </section>

      <ClassActions
        occurrenceKey={occurrence.key}
        status={occurrence.status}
        weekly={occurrence.slotId !== null}
        changed={occurrence.changeId !== null}
        breakLabel={occurrence.breakLabel}
        date={occurrence.date}
        startTime={occurrence.startTime}
        endTime={occurrence.endTime}
        location={occurrence.location}
        usualRoom={occurrence.room?.from ?? occurrence.location}
        note={occurrence.note}
        canMark={started && isLive(occurrence)}
        attendance={marks.get(occurrence.key) ?? null}
        backHref={back}
        label={`${occurrence.course.code ?? occurrence.course.name}, ${placementLabel(occurrence, fmt)}`}
      />

      <footer className="flex flex-wrap gap-2 border-border-soft border-t pt-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/courses/${occurrence.courseId}`}>Open course</Link>
        </Button>
        {occurrence.slotId ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/courses/${occurrence.courseId}/slots/${occurrence.slotId}/edit`}>
              <Pencil aria-hidden />
              Edit weekly time
            </Link>
          </Button>
        ) : null}
        {course?.lecturerPhone ? (
          <Button asChild variant="ghost" size="sm">
            <a href={whatsappLink(course.lecturerPhone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden />
              WhatsApp {course.lecturer ? course.lecturer.split(",")[0] : "lecturer"}
            </a>
          </Button>
        ) : null}
        {course?.lecturerEmail ? (
          <Button asChild variant="ghost" size="sm">
            <a href={`mailto:${course.lecturerEmail}`}>
              <Mail aria-hidden />
              Email
            </a>
          </Button>
        ) : null}
      </footer>
    </div>
  );
}
