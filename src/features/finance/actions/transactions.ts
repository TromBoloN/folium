"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, type FormState, fieldErrorsFrom, formValues, fromSheet } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { requireUser } from "../../auth/queries";
import { getSettings } from "../../settings/queries";
import { formatIdr } from "../lib/format-idr";
import { parseQuickTransaction } from "../lib/parse-quick-transaction";
import { LAST_ACCOUNT_COOKIE, lastUsedAccountId, listAccounts, listCategories } from "../queries";
import { transactionFormSchema, transactionRow } from "../schemas";
import { personIdFor } from "./debts";

export type TransactionSnapshot = Tables<"transactions">;

const FAILED = "Couldn't save the transaction. Please try again.";

function refresh() {
  revalidatePath("/money", "layout");
  revalidatePath("/");
}

/** Remember the account used, so the next form and quick add start there. A cookie: works without JavaScript. */
async function rememberAccount(accountId: string) {
  (await cookies()).set(LAST_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function messageFor(code: string) {
  // 23503: an account or category that isn't the user's, or of the wrong kind (composite FK).
  if (code === "23503") return "That account or category can't be used here.";
  if (code === "23514") return "Some details don't fit this kind of transaction.";
  return FAILED;
}

/** Create (no id) or edit (id) a transaction from the full form. */
export async function saveTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = transactionFormSchema.safeParse({
    kind: formData.get("kind") ?? "",
    status: formData.get("status") === "planned" ? "planned" : "posted",
    amount: formData.get("amount") ?? "",
    accountId: formData.get("accountId") ?? "",
    toAccountId: formData.get("toAccountId") ?? "",
    feeAmount: formData.get("feeAmount") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    payee: formData.get("payee") ?? "",
    note: formData.get("note") ?? "",
    occurredOn: formData.get("occurredOn") ?? "",
    adjustmentDirection: formData.get("adjustmentDirection") ?? "",
    personId: formData.get("personId") ?? "",
    personName: formData.get("personName") ?? "",
    courseId: formData.get("courseId") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  // A category of the other kind (left checked after switching kinds without JavaScript).
  if (parsed.data.categoryId) {
    const category = (await listCategories()).find((c) => c.id === parsed.data.categoryId);
    if (category && category.kind !== parsed.data.kind) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: {
          categoryId: `Pick ${parsed.data.kind === "income" ? "an income" : "an expense"} category, or None.`,
        },
        values,
      };
    }
  }
  // A debt with a new name: create (or find) the person first.
  let personId = parsed.data.personId;
  if (!personId && parsed.data.personName) {
    const person = await personIdFor(parsed.data.personName);
    if (!person.ok) {
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: { personName: person.error }, values };
    }
    personId = person.id;
  }
  const id = z.uuid().safeParse(formData.get("id"));
  const supabase = await createClient();
  const row = { ...transactionRow(parsed.data), person_id: personId };
  const { data, error } = id.success
    ? await supabase.from("transactions").update(row).eq("id", id.data).select("id")
    : await supabase.from("transactions").insert(row).select("id");
  if (error) {
    console.error("[finance] save", error.code, error.message);
    return { ok: false, error: messageFor(error.code), values };
  }
  if (!data || data.length === 0) return { ok: false, error: "That transaction no longer exists.", values };

  await rememberAccount(parsed.data.accountId);
  refresh();
  if (fromSheet(formData)) {
    return { ok: true, result: { id: data[0].id, message: id.success ? "Transaction saved" : "Transaction added" } };
  }
  redirect("/money");
}

/** Hard delete. Returns the full row so Undo can put it back with the same id. */
export async function deleteTransaction(id: string): Promise<ActionResult<{ previous: TransactionSnapshot }>> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "That transaction no longer exists." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").delete().eq("id", id).select("*");
  if (error) return { ok: false, error: "Couldn't delete the transaction. Please try again." };
  if (data.length === 0) return { ok: false, error: "That transaction no longer exists." };
  refresh();
  return { ok: true, data: { previous: data[0] } };
}

const snapshotSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  status: z.string(),
  amount: z.number().int().positive(),
  account_id: z.uuid(),
  to_account_id: z.uuid().nullable(),
  fee_amount: z.number().int().nonnegative(),
  category_id: z.uuid().nullable(),
  payee: z.string().nullable(),
  note: z.string().nullable(),
  occurred_on: z.string(),
  adjustment_direction: z.string().nullable(),
  person_id: z.uuid().nullable().default(null),
  recurring_rule_id: z.uuid().nullable().default(null),
  due_on: z.string().nullable().default(null),
  course_id: z.uuid().nullable().default(null),
  task_id: z.uuid().nullable().default(null),
  import_batch_id: z.uuid().nullable().default(null),
  import_key: z.string().nullable().default(null),
  created_at: z.string(),
});

/** Undo a delete: insert the same row again, same id (no soft delete). The database re-checks everything. */
export async function restoreTransaction(snapshot: TransactionSnapshot): Promise<ActionResult> {
  await requireUser();
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) return { ok: false, error: "Couldn't undo. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(parsed.data);
  if (error) {
    console.error("[finance] restore", error.code, error.message);
    return {
      ok: false,
      error:
        error.code === "23503" ? "Couldn't undo: its account or category is gone." : "Couldn't undo. Please try again.",
    };
  }
  refresh();
  return { ok: true };
}

export type QuickMoneyContext = {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; kind: "expense" | "income" }[];
  defaultAccountId?: string;
  timeZone: string;
};

/** What the quick-add box needs to preview a line (active accounts and categories only). */
export async function getQuickMoneyContext(): Promise<ActionResult<QuickMoneyContext>> {
  await requireUser();
  const [accounts, categories, { preferences }] = await Promise.all([listAccounts(), listCategories(), getSettings()]);
  return {
    ok: true,
    data: {
      accounts: accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name })),
      categories: categories.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
      defaultAccountId: await lastUsedAccountId(accounts),
      timeZone: preferences.timeZone,
    },
  };
}

/** Parse a line again on the server (real accounts, categories, clock and zone) and save it if it's clean. */
async function saveQuickLine(text: string): Promise<ActionResult<{ id: string; message: string }>> {
  if (typeof text !== "string" || text.length > 300) return { ok: false, error: "That's too long." };
  if (!text.trim()) return { ok: false, error: "Type something like “gofood 32k #food @gopay”." };
  const context = await getQuickMoneyContext();
  if (!context.ok) return context;
  const draft = parseQuickTransaction(text, { ...context.data, now: new Date() });
  if (draft.errors.length > 0 || !draft.amount || !draft.accountId) {
    return { ok: false, error: draft.errors[0] ?? "Add an amount and an account." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      kind: draft.kind,
      amount: Number(draft.amount),
      account_id: draft.accountId,
      to_account_id: draft.toAccountId ?? null,
      category_id: draft.categoryId ?? null,
      payee: draft.kind === "transfer" ? null : (draft.payee ?? null),
      note: draft.kind === "transfer" ? (draft.payee ?? null) : null,
      occurred_on: draft.occurredOn,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[finance] quick add", error.code, error.message);
    return { ok: false, error: messageFor(error.code) };
  }
  await rememberAccount(draft.accountId);
  refresh();
  const what = draft.kind === "income" ? "Income" : draft.kind === "transfer" ? "Transfer" : "Spent";
  return {
    ok: true,
    data: { id: data.id, message: `${what} ${formatIdr(draft.amount)}${draft.payee ? `: ${draft.payee}` : ""}` },
  };
}

/**
 * One line from the command palette's quick add ("gofood 32k #food @gopay").
 * Saved only when it parses cleanly; returns the id (for Undo) and a sentence for the toast.
 */
export async function quickAddMoney(text: string): Promise<ActionResult<{ id: string; message: string }>> {
  await requireUser();
  return saveQuickLine(text);
}

/**
 * The quick-add bar on /money: a real form, so it works without JavaScript.
 * On an error the typed line comes back in `values` to fix.
 */
export async function quickAddForm(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const text = String(formData.get("text") ?? "");
  const saved = await saveQuickLine(text);
  if (!saved.ok) return { ok: false, error: saved.error, values: { text } };
  return { ok: true, result: saved.data };
}
