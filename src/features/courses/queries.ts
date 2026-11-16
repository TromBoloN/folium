import "server-only";
import { cache } from "react";
import { z } from "zod";
import { safeHttpsUrl } from "@/lib/safe-links";
import { createClient } from "@/lib/supabase/server";
import { trimSeconds } from "../timetable/logic";
import type { TimetableSlot } from "../timetable/types";
import type { Course } from "./schema";

export type CourseWithSlots = Course & { slots: TimetableSlot[] };

const COURSE_COLUMNS =
  "id, name, code, color, lecturer, lecturer_email, lecturer_phone, room, semester, credits, archived_at, timetable_slots(id, weekday, start_time, end_time, location, starts_on, ends_on, is_online, meeting_url)";

type Row = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  lecturer: string | null;
  lecturer_email: string | null;
  lecturer_phone: string | null;
  room: string | null;
  semester: string | null;
  credits: number;
  archived_at: string | null;
  timetable_slots: {
    id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    location: string | null;
    starts_on: string | null;
    ends_on: string | null;
    is_online: boolean;
    meeting_url: string | null;
  }[];
};

function toCourse(row: Row): CourseWithSlots {
  const course: Course = {
    id: row.id,
    name: row.name,
    code: row.code,
    color: row.color,
    lecturer: row.lecturer,
    room: row.room,
    semester: row.semester,
    credits: Number(row.credits),
    archivedAt: row.archived_at,
    lecturerEmail: row.lecturer_email,
    lecturerPhone: row.lecturer_phone,
  };
  return {
    ...course,
    slots: row.timetable_slots.map((s) => ({
      id: s.id,
      courseId: row.id,
      weekday: s.weekday,
      startTime: trimSeconds(s.start_time),
      endTime: trimSeconds(s.end_time),
      location: s.location,
      startsOn: s.starts_on,
      endsOn: s.ends_on,
      online: s.is_online,
      // Rows can be written outside the app's forms: only a safe https link reaches an href or the .ics.
      meetingUrl: safeHttpsUrl(s.meeting_url),
      course,
    })),
  };
}

/** All of the user's courses with their class times, active first, then by name. RLS limits rows to the owner. */
export const listCourses = cache(async (): Promise<CourseWithSlots[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("name");
  if (error) throw new Error(`Couldn't load courses: ${error.message}`);
  return (data as Row[]).map(toCourse);
});

/** One course, or null if it doesn't exist or isn't the user's (RLS hides other users' rows). */
export async function getCourse(id: string): Promise<CourseWithSlots | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select(COURSE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the course: ${error.message}`);
  return data ? toCourse(data as Row) : null;
}

/** Every class time of every active (non-archived) course: what the timetable shows and checks for overlaps. */
export async function listActiveSlots(): Promise<TimetableSlot[]> {
  const courses = await listCourses();
  return courses.filter((c) => !c.archivedAt).flatMap((c) => c.slots);
}

export type CourseOption = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  archived: boolean;
  credits: number;
};

/** Lightweight course list for pickers and filters. */
export async function listCourseOptions(): Promise<CourseOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, code, color, archived_at, credits")
    .order("name");
  if (error) throw new Error(`Couldn't load courses: ${error.message}`);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    color: c.color,
    archived: c.archived_at !== null,
    credits: Number(c.credits),
  }));
}
