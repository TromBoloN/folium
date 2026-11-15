"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../auth/queries";

export type SearchResults = {
  tasks: {
    id: string;
    title: string;
    done: boolean;
    course: { code: string | null; name: string; color: string } | null;
  }[];
  courses: { id: string; name: string; code: string | null; color: string; archived: boolean }[];
};

const querySchema = z.string().trim().min(1).max(100);
const LIMIT = 6;

/** Escape LIKE wildcards so "100%" searches for a literal percent sign. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** A PostgREST filter value in double quotes (backslash and quote escaped). */
function quoted(value: string) {
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/** Tasks (top-level, open first) and courses whose title, name or code contains the query. RLS limits rows to the owner. */
export async function searchEverything(query: string): Promise<ActionResult<SearchResults>> {
  await requireUser();
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return { ok: true, data: { tasks: [], courses: [] } };
  const pattern = likePattern(parsed.data);
  const supabase = await createClient();
  const [tasks, courses] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, course:courses!tasks_course_fk(code, name, color)")
      .is("parent_id", null)
      .ilike("title", pattern)
      .order("status", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(LIMIT),
    supabase
      .from("courses")
      .select("id, name, code, color, archived_at")
      // Quoted, so commas or parentheses in the query can't break PostgREST's or= syntax.
      .or(`name.ilike.${quoted(pattern)},code.ilike.${quoted(pattern)}`)
      .order("archived_at", { ascending: true, nullsFirst: true })
      .order("name")
      .limit(LIMIT),
  ]);
  if (tasks.error || courses.error) {
    console.error("[search]", tasks.error?.message ?? courses.error?.message);
    return { ok: false, error: "Search isn't working right now." };
  }
  return {
    ok: true,
    data: {
      tasks: tasks.data.map((t) => ({
        id: t.id,
        title: t.title,
        done: t.status === "done",
        course: t.course as SearchResults["tasks"][number]["course"],
      })),
      courses: courses.data.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        color: c.color,
        archived: c.archived_at !== null,
      })),
    },
  };
}
