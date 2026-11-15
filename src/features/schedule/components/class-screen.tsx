import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  ListTodo,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Video,
} from "lucide-react";
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
import { formatDue } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";
import { formatDate, minutesNowIn, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatTime } from "../../timetable/logic";
import { occurrenceChips, placementLabel, timeRange } from "../format";
import { isLive, isPast } from "../occurrences";
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
  const ended = isPast(occurrence, { date: today, minute: nowMinute });
  const tasks = (await listOpenTasks()).filter((t) => t.courseId === occurrence.courseId).slice(0, 4);
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
        canMark={ended && isLive(occurrence)}
        attendance={marks.get(occurrence.key) ?? null}
        backHref={back}
        label={`${occurrence.course.code ?? occurrence.course.name}, ${placementLabel(occurrence, fmt)}`}
      />

      {tasks.length > 0 ? (
        <section aria-labelledby="class-tasks-h" className="flex flex-col gap-2">
          <h3 id="class-tasks-h" className="flex items-center gap-2 font-medium text-sm">
            <ListTodo aria-hidden className="size-4 text-muted-foreground" />
            Open tasks for {occurrence.course.code ?? occurrence.course.name}
          </h3>
          <ul className="flex flex-col divide-y divide-border-soft rounded-xl border border-border-soft">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent/50"
                >
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {formatDue(t, now, preferences.timeZone, fmt) ?? "No date"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav
        aria-label="More for this class"
        className="flex flex-col divide-y divide-border-soft rounded-xl border border-border-soft"
      >
        <LinkRow href={`/courses/${occurrence.courseId}`} icon={BookOpen} label="Open course" />
        {occurrence.slotId ? (
          <LinkRow
            href={`/courses/${occurrence.courseId}/slots/${occurrence.slotId}/edit`}
            icon={Pencil}
            label="Edit the weekly time"
          />
        ) : null}
        {course?.lecturerPhone ? (
          <LinkRow
            href={whatsappLink(course.lecturerPhone)}
            icon={MessageCircle}
            label={`WhatsApp ${course.lecturer ? course.lecturer.split(",")[0] : "the lecturer"}`}
            external
          />
        ) : null}
        {course?.lecturerEmail ? (
          <LinkRow
            href={`mailto:${course.lecturerEmail}`}
            icon={Mail}
            label={`Email ${course.lecturerEmail}`}
            external
          />
        ) : null}
      </nav>
    </div>
  );
}

function LinkRow({
  href,
  icon: Icon,
  label,
  external = false,
}: {
  href: string;
  icon: typeof BookOpen;
  label: string;
  external?: boolean;
}) {
  const content = (
    <>
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </>
  );
  const className = "flex min-h-11 items-center gap-3 px-4 py-2 text-sm hover:bg-accent/50";
  return external ? (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
