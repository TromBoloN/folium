import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { type ResolvedLayout, resolveLayout } from "./layout";
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
