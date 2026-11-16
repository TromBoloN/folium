"use client";

import { CalendarClock, Flag, Tag, TriangleAlert } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { formatDate, minutesNowIn, todayIn } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";
import { formatTime } from "../../timetable/logic";
import { matchCourse, type ParsedQuickAdd, parseQuickAdd } from "../parse";
import { PRIORITY_LABELS } from "../schema";
import { type ClientData, useClientData } from "./client-data-store";

/** Parse quick-add text with the user's zone and courses; null until client data has loaded. */
export function useQuickAddParse(
  text: string,
): { parsed: ParsedQuickAdd; course: ClientData["courses"][number] | null } | null {
  const data = useClientData();
  if (!data || !text.trim()) return null;
  const now = new Date();
  const parsed = parseQuickAdd(text, {
    today: todayIn(data.timeZone, now),
    nowMinute: minutesNowIn(data.timeZone, now),
    weekStart: data.weekStart,
  });
  const course = parsed.course
    ? matchCourse(
        parsed.course,
        data.courses.filter((c) => !c.archived),
      )
    : null;
  return { parsed, course };
}

/** What the quick-add text will become: the title and chips for date, course and priority. */
export function ParsePreview({ text, id }: { text: string; id?: string }) {
  const data = useClientData();
  const { t, intl } = useI18n();
  const result = useQuickAddParse(text);
  if (!result || !data || result.parsed.tokens.length === 0) return null;
  const { parsed, course } = result;
  const today = todayIn(data.timeZone);
  const day = parsed.dueDate
    ? parsed.dueDate === today
      ? t("Today")
      : formatDate(parsed.dueDate, { weekday: "short", day: "numeric", month: "short" }, intl)
    : null;
  return (
    <p id={id} className="flex flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
      <span className="text-muted-foreground">{t("Adds “{title}”", { title: parsed.title })}</span>
      {day ? (
        <Pill tone="accent">
          <CalendarClock aria-hidden />
          {day}
          {parsed.dueTime ? ` ${formatTime(parsed.dueTime, data.timeFormat)}` : ""}
        </Pill>
      ) : null}
      {parsed.course ? (
        course ? (
          <Pill tone="course" tint={course.color}>
            <Tag aria-hidden />
            {course.code ?? course.name}
          </Pill>
        ) : (
          <Pill tone="warning">
            <TriangleAlert aria-hidden />
            {t("#{course}: no such course, kept in the title", { course: parsed.course })}
          </Pill>
        )
      ) : null}
      {parsed.priority ? (
        <Pill tone={parsed.priority === "urgent" ? "danger" : "neutral"}>
          <Flag aria-hidden />
          {t(PRIORITY_LABELS[parsed.priority])}
        </Pill>
      ) : null}
    </p>
  );
}
