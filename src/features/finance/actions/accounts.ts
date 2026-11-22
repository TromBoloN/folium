"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../../auth/queries";
import { getSettings } from "../../settings/queries";
import { formatIdr } from "../lib/format-idr";
import { localDateFor } from "../lib/local-date";
import { accountFormSchema, realBalanceSchema } from "../schemas";

function refresh() {
  revalidatePath("/money", "layout");
  revalidatePath("/");
}

export async function saveAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = accountFormSchema.safeParse({
    name: formData.get("name") ?? "",
    type: formData.get("type") ?? "",
    color: formData.get("color") ?? "",
    icon: formData.get("icon") ?? "",
    openingBalance: formData.get("openingBalance") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const a = parsed.data;
  const row = {
    name: a.name,
    type: a.type,
    color: a.color,
    icon: a.icon,
    is_spendable: formData.get("isSpendable") === "on",
    opening_balance: Number(a.openingBalance),
  };
  const id = z.uuid().safeParse(formData.get("id"));
  const supabase = await createClient();
  const { error } = id.success
    ? await supabase.from("accounts").update(row).eq("id", id.data)
    : await supabase.from("accounts").insert(row);
  if (error) {
    console.error("[finance] account", error.code, error.message);
    const message =
      error.code === "23505"
        ? "You already have an account with that name."
        : "Couldn't save the account. Please try again.";
    return { ok: false, error: message, fieldErrors: error.code === "23505" ? { name: message } : undefined, values };
  }
  refresh();
  redirect("/money/accounts");
}

export async function setAccountArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That account no longer exists." };
  const supabase = await createClient();
  const archive = formData.get("archive") === "true";
  const { error } = await supabase
    .from("accounts")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't update the account. Please try again." };
  refresh();
  return { ok: true };
}

function parseReal(formData: FormData) {
  return realBalanceSchema.safeParse({ accountId: formData.get("accountId"), real: formData.get("real") ?? "" });
}

/**
 * "Match my real balance": change the opening balance so the account's balance
 * equals what the bank shows, without adding a transaction.
 * new opening = real − (balance − opening). Opening balance is a snapshot, so
 * this should be re-run after backfilling older transactions.
 */
export async function matchRealBalance(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = parseReal(formData);
  if (!parsed.success)
    return {
      ok: false,
      error: "Enter the balance your bank app shows.",
      fieldErrors: { real: parsed.error.issues[0]?.message ?? "" },
      values,
    };
  const supabase = await createClient();
  const { error } = await supabase.rpc("match_account_balance", {
    p_account_id: parsed.data.accountId,
    p_real_balance: Number(parsed.data.real),
  });
  if (error) {
    if (error.code === "P0002") return { ok: false, error: "That account no longer exists.", values };
    console.error("[finance] match balance", error.code, error.message);
    return { ok: false, error: "Couldn't update the balance. Please try again.", values };
  }
  refresh();
  redirect(`/money/accounts/${parsed.data.accountId}?matched=1`);
}

/** "Adjust": record the difference as an adjustment transaction dated today. */
export async function adjustToRealBalance(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = parseReal(formData);
  if (!parsed.success)
    return {
      ok: false,
      error: "Enter the balance your bank app shows.",
      fieldErrors: { real: parsed.error.issues[0]?.message ?? "" },
      values,
    };
  const { preferences } = await getSettings();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_account_balance", {
    p_account_id: parsed.data.accountId,
    p_real_balance: Number(parsed.data.real),
    p_occurred_on: localDateFor(new Date(), preferences.timeZone),
    p_note: `Matched to the real balance (${formatIdr(parsed.data.real)})`,
  });
  if (error) {
    if (error.code === "P0002") return { ok: false, error: "That account no longer exists.", values };
    console.error("[finance] adjust balance", error.code, error.message);
    return { ok: false, error: "Couldn't add the adjustment. Please try again.", values };
  }
  refresh();
  redirect(`/money/accounts/${parsed.data.accountId}?matched=1`);
}
