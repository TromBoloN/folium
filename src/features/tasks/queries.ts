import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { WeekStart } from "../timetable/logic";
import { compareTasks, dueWindowRange } from "./due";
import type { TaskFilters, TaskPriority, TaskStatus } from "./schema";

export type Subtask = { id: string; title: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  courseId: string | null;
  course: { id: string; name: string; code: string | null; color: string } | null;
  dueAt: string | null;
  dueHasTime: boolean;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  subtasks: Subtask[];
};

const TASK_COLUMNS =
  "id, title, notes, course_id, due_at, due_has_time, priority, status, completed_at, created_at, course:courses!tasks_course_fk(id, name, code, color)";

type Row = {
  id: string;
  title: string;
  notes: string | null;
  course_id: string | null;
  due_at: string | null;
  due_has_time: boolean;
  priority: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  course: { id: string; name: string; code: string | null; color: string } | null;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SUBTASK_CHUNK = 100;

/** Subtasks for these parents, in checklist order. (PostgREST can't embed the composite self-reference.) */
async function loadSubtasks(supabase: Supabase, parentIds: string[]): Promise<Map<string, Subtask[]>> {
  const byParent = new Map<string, Subtask[]>();
  if (parentIds.length === 0) return byParent;
  const chunks: string[][] = [];
  for (let i = 0; i < parentIds.length; i += SUBTASK_CHUNK) chunks.push(parentIds.slice(i, i + SUBTASK_CHUNK));
  const results = await Promise.all(
    chunks.map((ids) =>
      supabase
        .from("tasks")
        .select("id, title, status, parent_id")
        .in("parent_id", ids)
        .order("position")
        .order("created_at"),
    ),
  );
  for (const { data, error } of results) {
    if (error) throw new Error(`Couldn't load subtasks: ${error.message}`);
    for (const s of data) {
      if (!s.parent_id) continue;
      byParent.set(s.parent_id, [
        ...(byParent.get(s.parent_id) ?? []),
        { id: s.id, title: s.title, done: s.status === "done" },
      ]);
    }
  }
  return byParent;
}

function toTask(row: Row, subtasks: Subtask[]): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    courseId: row.course_id,
    course: row.course,
    dueAt: row.due_at,
    dueHasTime: row.due_has_time,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    subtasks,
  };
}

export type ListContext = { now: Date; timeZone: string; weekStart: WeekStart };

/** Top-level tasks matching the filters. RLS limits rows to the owner. */
export async function listTasks(filters: TaskFilters, ctx: ListContext): Promise<Task[]> {
  const supabase = await createClient();
  let query = supabase.from("tasks").select(TASK_COLUMNS).is("parent_id", null);

  if (filters.status === "open") query = query.neq("status", "done");
  if (filters.status === "done") query = query.eq("status", "done");
  if (filters.course) query = query.eq("course_id", filters.course);
  if (filters.due !== "any") {
    const range = dueWindowRange(filters.due, ctx.now, ctx.timeZone, ctx.weekStart);
    if (range.from) query = query.gte("due_at", range.from);
    if (range.to) query = query.lte("due_at", range.to);
    if (range.before) query = query.lt("due_at", range.before).neq("status", "done");
  }

  query =
    filters.status === "done"
      ? query.order("completed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
      : query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });

  const { data, error } = await query.limit(500);
  if (error) throw new Error(`Couldn't load tasks: ${error.message}`);
  const rows = data as Row[];
  const subtasks = await loadSubtasks(
    supabase,
    rows.map((r) => r.id),
  );
  const tasks = rows.map((r) => toTask(r, subtasks.get(r.id) ?? []));

  // Finished work reads best newest-first; open work by deadline.
  if (filters.status === "done") {
    return tasks.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  }
  return tasks.sort(compareTasks);
}

/** One top-level task with its subtasks, or null if it doesn't exist or isn't the user's. */
export async function getTask(id: string): Promise<Task | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("id", id)
    .is("parent_id", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the task: ${error.message}`);
  if (!data) return null;
  const subtasks = await loadSubtasks(supabase, [id]);
  return toTask(data as Row, subtasks.get(id) ?? []);
}

/**
 * Every open top-level task, cached per request so several dashboard widgets
 * share one query. Widgets pick their slice with dueState().
 */
export const listOpenTasks = cache(
  (): Promise<Task[]> =>
    // The due window is "any", so the context is never used for a range.
    listTasks(
      { status: "open", due: "any", course: undefined },
      { now: new Date(0), timeZone: "UTC", weekStart: "monday" },
    ),
);

/** Whether the user has ever made a task (open or done): for the first-run checklist. */
export const hasAnyTask = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { count, error } = await supabase.from("tasks").select("id", { count: "exact", head: true }).limit(1);
  if (error) throw new Error(`Couldn't count tasks: ${error.message}`);
  return (count ?? 0) > 0;
});
