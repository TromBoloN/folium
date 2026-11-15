import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AssessmentRecord = {
  id: string;
  courseId: string;
  name: string;
  weight: number;
  maxScore: number;
  score: number | null;
  dueAt: string | null;
};

export type GradebookCourse = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  semester: string | null;
  credits: number;
  archived: boolean;
  assessments: AssessmentRecord[];
};

const COLUMNS =
  "id, name, code, color, semester, credits, archived_at, assessments(id, name, weight, max_score, score, due_at, created_at)";

type Row = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  semester: string | null;
  credits: number;
  archived_at: string | null;
  assessments: {
    id: string;
    name: string;
    weight: number;
    max_score: number;
    score: number | null;
    due_at: string | null;
    created_at: string;
  }[];
};

function toCourse(row: Row): GradebookCourse {
  const assessments = [...row.assessments]
    // Dated work in date order, undated after it, then by when it was added.
    .sort((a, b) =>
      a.due_at && b.due_at
        ? a.due_at.localeCompare(b.due_at)
        : a.due_at
          ? -1
          : b.due_at
            ? 1
            : a.created_at.localeCompare(b.created_at),
    )
    .map((a) => ({
      id: a.id,
      courseId: row.id,
      name: a.name,
      weight: Number(a.weight),
      maxScore: Number(a.max_score),
      score: a.score === null ? null : Number(a.score),
      dueAt: a.due_at,
    }));
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    color: row.color,
    semester: row.semester,
    credits: Number(row.credits),
    archived: row.archived_at !== null,
    assessments,
  };
}

/** Every course (active and archived) with its assessments. RLS limits rows to the owner. */
export async function listGradebook(): Promise<GradebookCourse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select(COLUMNS).order("name");
  if (error) throw new Error(`Couldn't load grades: ${error.message}`);
  return (data as Row[]).map(toCourse);
}

/** One course's gradebook, or null if it doesn't exist or isn't the user's. */
export async function getCourseGradebook(courseId: string): Promise<GradebookCourse | null> {
  if (!z.uuid().safeParse(courseId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select(COLUMNS).eq("id", courseId).maybeSingle();
  if (error) throw new Error(`Couldn't load the course grades: ${error.message}`);
  return data ? toCourse(data as Row) : null;
}
