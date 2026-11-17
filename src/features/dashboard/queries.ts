import "server-only";
import { io } from "next/cache";
import { cache } from "react";
import { listCourses } from "@/features/courses/queries";
import { hasAnyTransaction } from "@/features/finance/queries";
import { courseResult } from "@/features/grades/logic";
import { listGradebook } from "@/features/grades/queries";
import { isListed, isLive } from "@/features/schedule/occurrences";
import { getSchedule } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { dueParts, dueState } from "@/features/tasks/due";
import { hasAnyTask, listOpenTasks } from "@/features/tasks/queries";
import { weekDates } from "@/features/timetable/logic";
import { addDays, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { type ResolvedLayout, resolveLayout } from "./layout";
import type { DashboardFacts } from "./presence";
import { WIDGET_IDS } from "./widget-ids";

/** The user's dashboard layout merged over the registry defaults. Falls back to defaults on any problem. */
export const getDashboardLayout = cache(async (): Promise<ResolvedLayout> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("dashboard_layout").maybeSingle();
  if (error) console.error("[dashboard] layout load failed", error.code, error.message);
  return resolveLayout(data?.dashboard_layout, WIDGET_IDS);
});

export const getDisplayName = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").maybeSingle();
  return data?.display_name?.trim() || null;
});

/**
 * Counts behind "does this widget have anything to show" (see presence.ts).
 * Uses the same cached loaders as the widgets, so the widgets reuse them.
 */
export const getDashboardFacts = cache(async (): Promise<DashboardFacts> => {
  const { preferences } = await getSettings();
  await io();
  const now = new Date();
  const zone = preferences.timeZone;
  const today = todayIn(zone, now);
  const tomorrow = addDays(today, 1);
  const week = weekDates(today, preferences.weekStart);
  const [courses, anyTask, money, tasks, gradebook, near, thisWeek] = await Promise.all([
    listCourses(),
    hasAnyTask(),
    hasAnyTransaction(),
    listOpenTasks(),
    listGradebook(),
    getSchedule({ from: today, to: tomorrow }),
    getSchedule({ from: week[0], to: week[6] }),
  ]);
  const states = tasks.map((t) => dueState(t, now, zone));
  const weekDeadlines = tasks.filter((t) => {
    if (!t.dueAt) return false;
    const day = dueParts(t.dueAt, t.dueHasTime, zone).date;
    return day >= week[0] && day <= week[6];
  }).length;
  return {
    courses: courses.filter((c) => !c.archivedAt).length,
    tasks: anyTask ? 1 : 0,
    money,
    classesTodayOrTomorrow: near.filter((o) => (o.date === today ? isListed(o) : isLive(o))).length,
    weekItems: thisWeek.filter(isLive).length + weekDeadlines,
    deadlinesAhead: tasks.filter((t, i) => t.dueAt && states[i] !== "overdue").length,
    dueToday: states.filter((s) => s === "today").length,
    dueSoon: states.filter((s) => s === "today" || s === "soon").length,
    overdue: states.filter((s) => s === "overdue").length,
    graded: gradebook.filter((c) => !c.archived && courseResult(c.assessments, preferences.gradeScale).band !== null)
      .length,
  };
});
