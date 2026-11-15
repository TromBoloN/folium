import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, resolveSettings, type Settings } from "./schema";

/**
 * The signed-in user's settings merged over defaults, or the defaults when
 * nobody is signed in. Used by the root layout to theme the first paint, so it
 * must never throw: any failure falls back to the defaults.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return DEFAULT_SETTINGS;

  const { data, error } = await supabase
    .from("user_settings")
    .select("version, theme, preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[settings] load failed", error.code, error.message);
    return DEFAULT_SETTINGS;
  }
  return resolveSettings(data);
});
