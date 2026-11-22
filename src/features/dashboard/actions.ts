"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { requireUser } from "../auth/queries";
import { layoutOverrides } from "./layout";
import { DEFAULT_HIDDEN_WIDGETS, WIDGET_IDS } from "./widget-ids";

/** Saves the editor's order and hidden widgets. Unknown ids are dropped; only overrides are stored. */
export async function saveDashboardLayout(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const strings = (name: string) => formData.getAll(name).filter((v): v is string => typeof v === "string");
  const stored = layoutOverrides(
    { order: strings("order"), hidden: strings("hidden") },
    WIDGET_IDS,
    DEFAULT_HIDDEN_WIDGETS,
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .update({ dashboard_layout: stored as unknown as { [key: string]: Json } })
    .eq("user_id", user.id);
  if (error) {
    console.error("[dashboard] layout save failed", error.code, error.message);
    return { ok: false, error: "Couldn't save your layout. Please try again." };
  }
  revalidatePath("/");
  redirect("/");
}
