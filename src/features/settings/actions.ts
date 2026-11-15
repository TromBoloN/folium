"use server";

import { revalidatePath } from "next/cache";
import { type FormState, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { parseGradeScaleField } from "../grades/scale";
import {
  COURSES_VIEWS,
  type CoursesView,
  DEFAULT_PREFERENCES,
  DEFAULT_THEME,
  diffFromDefaults,
  resolveSettings,
  SETTINGS_VERSION,
  settingsFormSchema,
} from "./schema";

type JsonObject = { [key: string]: Json | undefined };

export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = settingsFormSchema.safeParse({
    theme: {
      mode: formData.get("mode"),
      preset: formData.get("preset"),
      accent: formData.get("useAccent") === "on" ? formData.get("accent") : null,
      font: formData.get("font"),
      density: formData.get("density"),
      motion: formData.get("motion"),
    },
    preferences: {
      weekStart: formData.get("weekStart"),
      timeFormat: formData.get("timeFormat"),
      language: formData.get("language"),
      timeZone: formData.get("timeZone"),
      gradeScale: parseGradeScaleField(formData.get("gradeScale")),
      attendanceTarget: Number(formData.get("attendanceTarget") ?? DEFAULT_PREFERENCES.attendanceTarget),
    },
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, values };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Your session has ended. Sign in again.", values };

  const { data: stored } = await supabase.from("user_settings").select("version, theme, preferences").maybeSingle();
  const { coursesView } = resolveSettings(stored).preferences;

  const { error } = await supabase
    .from("user_settings")
    .update({
      version: SETTINGS_VERSION,
      theme: diffFromDefaults(parsed.data.theme, DEFAULT_THEME) as JsonObject,
      preferences: diffFromDefaults({ ...parsed.data.preferences, coursesView }, DEFAULT_PREFERENCES) as JsonObject,
    })
    .eq("user_id", auth.user.id);

  if (error) {
    console.error("[settings] save failed", error.code, error.message);
    return { ok: false, error: "Couldn't save your settings. Please try again.", values };
  }

  // The theme lives on <html> in the root layout, so re-render from the top.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remember which view /courses opens in. Fire-and-forget from the view switch. */
export async function rememberCoursesView(view: CoursesView): Promise<void> {
  if (!COURSES_VIEWS.includes(view)) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: stored } = await supabase.from("user_settings").select("version, theme, preferences").maybeSingle();
  const preferences = { ...resolveSettings(stored).preferences, coursesView: view };
  const { error } = await supabase
    .from("user_settings")
    .update({ preferences: diffFromDefaults(preferences, DEFAULT_PREFERENCES) as JsonObject })
    .eq("user_id", auth.user.id);
  if (error) console.error("[settings] courses view", error.code, error.message);
}
