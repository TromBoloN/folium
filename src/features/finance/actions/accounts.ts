"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, type FormState, fieldErrorsFrom, formValues, fromSheet } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../../auth/queries";
import { markBalancesChecked } from "../../settings/actions";
import { getSettings } from "../../settings/queries";
import { formatIdr } from "../lib/format-idr";
import { localDateFor } from "../lib/local-date";
import { accountFormSchema, realBalanceSchema, signedAmount } from "../schemas";

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

/**
 * Batch balance sync (/money/sync): client sends real_balance per filled
 * account (never the diff), SQL locks in sorted account_id order and inserts
 * silent adjustments only for non-zero diffs. Also stamps balancesCheckedOn.
 */
export async function syncBalances(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const rawIds = formData.getAll("accountId").filter((v): v is string => typeof v === "string");
  const uniqueIds = [...new Set(rawIds)].filter((id) => z.uuid().safeParse(id).success);

  const items: { account_id: string; real_balance: number; note?: string }[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const id of uniqueIds) {
    const rawReal = String(formData.get(`real:${id}`) ?? "").trim();
    if (!rawReal) continue;
    const parsedReal = signedAmount.safeParse(rawReal);
    if (!parsedReal.success) {
      fieldErrors[`real:${id}`] = parsedReal.error.issues[0]?.message ?? "Enter an amount like 25.000, 25k or 1,5jt.";
      continue;
    }
    const rawNote = String(formData.get(`note:${id}`) ?? "")
      .trim()
      .slice(0, 200);
    items.push({
      account_id: id,
      real_balance: Number(parsedReal.data),
      note: rawNote || undefined,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors, values };
  }

  const { preferences } = await getSettings();
  const today = localDateFor(new Date(), preferences.timeZone);
  let insertedIds: string[] = [];

  if (items.length > 0) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sync_account_balances", {
      p_items: items,
      p_occurred_on: today,
    });
    if (error) {
      if (error.code === "P0002") return { ok: false, error: "One of those accounts no longer exists.", values };
      console.error("[finance] sync balances", error.code, error.message);
      return { ok: false, error: "Couldn't sync balances. Please try again.", values };
    }
    insertedIds = (data ?? []).filter((id): id is string => typeof id === "string");
  }

  await markBalancesChecked();
  refresh();
  if (fromSheet(formData)) {
    return {
      ok: true,
      result: {
        ids: insertedIds.join(","),
        count: String(insertedIds.length),
      },
    };
  }
  redirect("/money");
}

/** Inline set-balance on an account card: 1-item sync_account_balances with Undo id. */
export async function setAccountBalanceInline(input: {
  accountId: string;
  real: string;
}): Promise<ActionResult<{ id: string | null; balance: string }>> {
  await requireUser();
  const parsed = realBalanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter an amount like 25.000, 25k or 1,5jt." };
  }
  const { preferences } = await getSettings();
  const today = localDateFor(new Date(), preferences.timeZone);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_account_balances", {
    p_items: [{ account_id: parsed.data.accountId, real_balance: Number(parsed.data.real) }],
    p_occurred_on: today,
  });
  if (error) {
    if (error.code === "P0002") return { ok: false, error: "That account no longer exists." };
    console.error("[finance] inline balance", error.code, error.message);
    return { ok: false, error: "Couldn't update the balance. Please try again." };
  }
  const id = (data ?? []).find((v): v is string => typeof v === "string") ?? null;
  await markBalancesChecked();
  refresh();
  return { ok: true, data: { id, balance: parsed.data.real.toString() } };
}

/** Undo for syncBalances: remove the adjustment transactions created by that sync. */
export async function undoSyncedBalances(ids: string[]): Promise<ActionResult> {
  await requireUser();
  const parsed = z.array(z.uuid()).min(1).max(100).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Couldn't undo." };
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().in("id", parsed.data).eq("kind", "adjustment");
  if (error) return { ok: false, error: "Couldn't undo." };
  refresh();
  return { ok: true };
}
