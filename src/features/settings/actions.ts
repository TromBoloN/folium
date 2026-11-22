"use server";

import { revalidatePath } from "next/cache";
import { type FormState, formValues } from "@/lib/action-result";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { parseGradeScaleField } from "../grades/scale";
import {
  COURSES_VIEWS,
  type CoursesView,
  DEFAULT_PREFERENCES,
  DEFAULT_THEME,
  diffFromDefaults,
  parseClassTypesField,
  profileFormSchema,
  resolveSettings,
  SETTINGS_VERSION,
  settingsFormSchema,
  themePackFormSchema,
} from "./schema";

type JsonObject = { [key: string]: Json | undefined };

export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const rawTarget = formData.get("attendanceTarget");
  const attendanceTarget =
    rawTarget === null
      ? DEFAULT_PREFERENCES.attendanceTarget
      : typeof rawTarget === "string" && rawTarget.trim() === ""
        ? Number.NaN
        : Number(rawTarget);
  const parsed = settingsFormSchema.safeParse({
    theme: {
      mode: formData.get("mode"),
      preset: formData.get("preset"),
      accent: formData.get("useAccent") === "on" ? formData.get("accent") : null,
      font: formData.get("font"),
      density: formData.get("density"),
      motion: formData.get("motion"),
      effects: formData.get("effects"),
    },
    preferences: {
      weekStart: formData.get("weekStart"),
      timeFormat: formData.get("timeFormat"),
      language: formData.get("language"),
      timeZone: formData.get("timeZone"),
      gradeScale: parseGradeScaleField(formData.get("gradeScale")),
      attendanceTarget,
      classTypes: parseClassTypesField(formData.get("classTypes")),
      billReminderEmails: formData.get("billReminderEmails") === "on",
      weeklySummaryEmail: formData.get("weeklySummaryEmail") === "on",
    },
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, values };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Your session has ended. Sign in again.", values };

  const { data: stored, error: readError } = await supabase
    .from("user_settings")
    .select("version, theme, preferences")
    .maybeSingle();
  if (readError) {
    console.error("[settings] read failed", readError.code, readError.message);
    return { ok: false, error: "Couldn't save your settings. Please try again.", values };
  }
  const current = resolveSettings(stored);
  const { coursesView, catchUp } = current.preferences;

  const { error } = await supabase
    .from("user_settings")
    .update({
      version: SETTINGS_VERSION,
      theme: diffFromDefaults({ ...parsed.data.theme, pack: current.theme.pack }, DEFAULT_THEME) as JsonObject,
      preferences: diffFromDefaults(
        { ...parsed.data.preferences, coursesView, catchUp },
        DEFAULT_PREFERENCES,
      ) as JsonObject,
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

/** Switch the theme pack (the Themes page). Keeps every other theme setting. Works without JavaScript. */
export async function setThemePack(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = themePackFormSchema.safeParse({ pack: formData.get("pack") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Your session has ended. Sign in again." };

  const { data: stored, error: readError } = await supabase
    .from("user_settings")
    .select("version, theme, preferences")
    .maybeSingle();
  if (readError) {
    console.error("[settings] theme pack read failed", readError.code, readError.message);
    return { ok: false, error: "Couldn't change the theme. Please try again." };
  }
  const theme = { ...resolveSettings(stored).theme, pack: parsed.data.pack };
  const { error } = await supabase
    .from("user_settings")
    .update({ version: SETTINGS_VERSION, theme: diffFromDefaults(theme, DEFAULT_THEME) as JsonObject })
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("[settings] theme pack save failed", error.code, error.message);
    return { ok: false, error: "Couldn't change the theme. Please try again." };
  }
  // The pack lives on <html> in the root layout.
  revalidatePath("/", "layout");
  return { ok: true, result: { message: "Theme applied" } };
}

/** Change the display name (profiles.display_name). Blank clears it. */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = profileFormSchema.safeParse({ displayName: formData.get("displayName") ?? "" });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0].message,
      fieldErrors: { displayName: parsed.error.issues[0].message },
      values,
    };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Your session has ended. Sign in again.", values };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("[settings] profile save failed", error.code, error.message);
    return { ok: false, error: "Couldn't save your name. Please try again.", values };
  }
  // The name shows in the sidebar and the greeting on every page.
  revalidatePath("/", "layout");
  return { ok: true, result: { message: parsed.data.displayName ? "Name saved" : "Name cleared" } };
}

/** Remember which view /courses opens in. Fire-and-forget from the view switch. */
export async function rememberCoursesView(view: CoursesView): Promise<void> {
  if (!COURSES_VIEWS.includes(view)) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: stored, error: readError } = await supabase
    .from("user_settings")
    .select("version, theme, preferences")
    .maybeSingle();
  if (readError) {
    console.error("[settings] courses view read", readError.code, readError.message);
    return;
  }
  const preferences = { ...resolveSettings(stored).preferences, coursesView: view };
  const { error } = await supabase
    .from("user_settings")
    .update({ preferences: diffFromDefaults(preferences, DEFAULT_PREFERENCES) as JsonObject })
    .eq("user_id", auth.user.id);
  if (error) console.error("[settings] courses view", error.code, error.message);
}

/**
 * Mark balances as checked today ("Looks right" on Welcome back, or after Sync).
 * Stored in preferences.catchUp.balancesCheckedOn so it stays synced across devices.
 */
export async function markBalancesChecked(): Promise<FormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Your session has ended. Sign in again." };
  const { data: stored, error: readError } = await supabase
    .from("user_settings")
    .select("version, theme, preferences")
    .maybeSingle();
  if (readError) {
    console.error("[settings] catch-up read", readError.code, readError.message);
    return { ok: false, error: "Couldn't save your settings. Please try again." };
  }
  const current = resolveSettings(stored).preferences;
  const today = todayIn(current.timeZone, new Date());
  const preferences = { ...current, catchUp: { balancesCheckedOn: today } };
  const { error } = await supabase
    .from("user_settings")
    .update({ preferences: diffFromDefaults(preferences, DEFAULT_PREFERENCES) as JsonObject })
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("[settings] catch-up save", error.code, error.message);
    return { ok: false, error: "Couldn't save your settings. Please try again." };
  }
  revalidatePath("/");
  return { ok: true, result: { message: "Balances marked up to date" } };
}

/** FormData wrapper for markBalancesChecked (no-JS <form> fallback). */
export async function markBalancesCheckedForm(): Promise<void> {
  await markBalancesChecked();
}
