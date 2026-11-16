"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../../auth/queries";
import { categoryFormSchema } from "../schemas";

function refresh() {
  revalidatePath("/money", "layout");
  revalidatePath("/money/categories");
}

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = categoryFormSchema.safeParse({
    name: formData.get("name") ?? "",
    kind: formData.get("kind") ?? "",
    parentId: formData.get("parentId") ?? "",
    color: formData.get("color") ?? "",
    icon: formData.get("icon") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const c = parsed.data;
  const row = { name: c.name, kind: c.kind, parent_id: c.parentId, color: c.color, icon: c.icon };
  const id = z.uuid().safeParse(formData.get("id"));
  const supabase = await createClient();
  const { error } = id.success
    ? await supabase.from("categories").update(row).eq("id", id.data)
    : await supabase.from("categories").insert(row);
  if (error) {
    console.error("[finance] category", error.code, error.message);
    const message =
      error.code === "23505"
        ? "You already have a category with that name."
        : error.code === "23514"
          ? "Categories nest one level only: pick a top-level parent."
          : error.code === "23503"
            ? "The parent must be a category of the same kind."
            : "Couldn't save the category. Please try again.";
    return { ok: false, error: message, values };
  }
  refresh();
  redirect("/money/categories");
}

export async function setCategoryArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That category no longer exists." };
  const supabase = await createClient();
  const archive = formData.get("archive") === "true";
  const { error } = await supabase
    .from("categories")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't update the category. Please try again." };
  refresh();
  return { ok: true };
}
