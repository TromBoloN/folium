"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldErrorsFrom, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../../auth/queries";
import { getSettings } from "../../settings/queries";
import { suggestBudget } from "../lib/budgets";
import { shiftMonth } from "../lib/compare-months";
import { formatIdr } from "../lib/format-idr";
import { addDays, localDateFor } from "../lib/local-date";
import { parseAmount } from "../lib/parse-amount";
import { listCategories } from "../queries";
import { listBudgets, listExpenseLines } from "../queries/planning";
import { monthBounds } from "../schemas/money-math";
import { budgetFormSchema, goalFormSchema, ruleFormSchema } from "../schemas/planning";

function refresh() {
  revalidatePath("/money", "layout");
  revalidatePath("/");
}

async function today() {
  const { preferences } = await getSettings();
  return localDateFor(new Date(), preferences.timeZone);
}

/** Drop a rule's future planned rows, so they're generated again from the rule. (Bills never touch tasks.) */
async function clearFuturePlanned(ruleId: string, from: string) {
  const supabase = await createClient();
  await supabase
    .from("transactions")
    .delete()
    .eq("recurring_rule_id", ruleId)
    .eq("status", "planned")
    .gte("due_on", from);
}

// ---------------------------------------------------------------- recurring

export async function saveRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = ruleFormSchema.safeParse({
    name: formData.get("name") ?? "",
    kind: formData.get("kind") ?? "",
    amount: formData.get("amount") ?? "",
    isEstimate: formData.get("isEstimate") === "on",
    accountId: formData.get("accountId") ?? "",
    toAccountId: formData.get("toAccountId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    payee: formData.get("payee") ?? "",
    cadence: formData.get("cadence") ?? "",
    intervalCount: formData.get("intervalCount") ?? "",
    dueDay: formData.get("dueDay") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
    instalmentsTotal: formData.get("instalmentsTotal") ?? "",
    remindDaysBefore: formData.get("remindDaysBefore") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const r = parsed.data;
  if (r.categoryId) {
    const category = (await listCategories()).find((c) => c.id === r.categoryId);
    if (category && category.kind !== r.kind) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: { categoryId: `Pick ${r.kind === "income" ? "an income" : "an expense"} category.` },
        values,
      };
    }
  }
  const row = {
    name: r.name,
    kind: r.kind,
    amount: Number(r.amount),
    is_estimate: r.isEstimate,
    account_id: r.accountId,
    to_account_id: r.toAccountId,
    category_id: r.categoryId,
    payee: r.payee,
    cadence: r.cadence,
    interval_count: r.intervalCount,
    due_day: r.dueDay,
    starts_on: r.startsOn,
    ends_on: r.endsOn,
    instalments_total: r.instalmentsTotal,
    remind_days_before: r.remindDaysBefore,
  };
  const id = z.uuid().safeParse(formData.get("id"));
  const supabase = await createClient();
  const now = await today();
  if (id.success) {
    // Editing changes only the future: posted history stays, future planned rows are regenerated.
    await clearFuturePlanned(id.data, now);
    const { error } = await supabase
      .from("recurring_rules")
      .update({ ...row, generated_through: addDays(now, -1) })
      .eq("id", id.data);
    if (error) return ruleError(error, values);
  } else {
    const { error } = await supabase.from("recurring_rules").insert(row);
    if (error) return ruleError(error, values);
  }
  refresh();
  redirect("/money/recurring");
}

function ruleError(error: { code: string; message: string }, values: Record<string, string>): FormState {
  console.error("[finance] rule", error.code, error.message);
  if (error.code === "23505") {
    return {
      ok: false,
      error: "You already have one with that name.",
      fieldErrors: { name: "You already have one with that name." },
      values,
    };
  }
  if (error.code === "23503") return { ok: false, error: "That account or category can't be used here.", values };
  return { ok: false, error: "Couldn't save. Please try again.", values };
}

/** Delete a rule: its posted history stays (unlinked); its planned rows go. */
export async function deleteRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That rule no longer exists." };
  await clearFuturePlanned(id.data, "0001-01-01");
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_rules").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't delete. Please try again." };
  refresh();
  redirect("/money/recurring");
}

/** Pause until a date (skips those occurrences), or resume (pausedUntil empty). */
export async function pauseRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That rule no longer exists." };
  const until = String(formData.get("until") ?? "");
  const now = await today();
  const pausedUntil = until === "" ? null : until === "month" ? monthBounds(now.slice(0, 7)).to : until;
  if (pausedUntil !== null && !/^\d{4}-\d{2}-\d{2}$/.test(pausedUntil)) return { ok: false, error: "Pick a date." };
  await clearFuturePlanned(id.data, now);
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_rules")
    .update({ paused_until: pausedUntil, generated_through: addDays(now, -1) })
    .eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't update. Please try again." };
  refresh();
  return { ok: true, result: { message: pausedUntil ? "Paused" : "Resumed" } };
}

/**
 * Mark a planned bill as paid: it becomes a posted transaction dated today
 * (with the real amount when the rule was an estimate).
 */
export async function markPaid(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That bill no longer exists." };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("transactions")
    .select("amount::text, payee, note, kind")
    .eq("id", id.data)
    .eq("status", "planned")
    .maybeSingle();
  if (!row) return { ok: false, error: "That bill was already paid or removed." };
  const typed = String(formData.get("amount") ?? "").trim();
  let amount = BigInt((row as unknown as { amount: string }).amount);
  if (typed) {
    const parsed = parseAmount(typed);
    if (!parsed.ok || parsed.value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return {
        ok: false,
        error: "Enter the amount paid, like 54.990.",
        fieldErrors: { amount: "Enter the amount paid." },
        values,
      };
    }
    amount = parsed.value;
  }
  const { error } = await supabase
    .from("transactions")
    .update({ status: "posted", amount: Number(amount), occurred_on: await today() })
    .eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't mark it paid. Please try again.", values };
  refresh();
  const what = row.kind === "income" ? "Received" : row.kind === "transfer" ? "Moved" : "Paid";
  return {
    ok: true,
    result: { message: `${what}: ${row.payee ?? row.note ?? ""} ${formatIdr(amount)}`.replace("  ", " ") },
  };
}

// ---------------------------------------------------------------- budgets

export async function saveBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = budgetFormSchema.safeParse({
    categoryId: formData.get("categoryId") ?? "",
    month: formData.get("month") ?? "",
    amount: formData.get("amount") ?? "",
    rollover: formData.get("rollover") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const b = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { category_id: b.categoryId, month: `${b.month}-01`, amount: Number(b.amount), rollover: b.rollover },
      { onConflict: "user_id,category_id,month" },
    );
  if (error) {
    console.error("[finance] budget", error.code, error.message);
    return {
      ok: false,
      error: error.code === "23503" ? "Budgets are for expense categories." : "Couldn't save. Please try again.",
      values,
    };
  }
  refresh();
  return { ok: true, result: { message: "Budget saved" } };
}

export async function deleteBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That budget no longer exists." };
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't delete. Please try again." };
  refresh();
  return { ok: true, result: { message: "Budget removed" } };
}

const monthField = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Copy last month's budgets into this month (ones already set stay). */
export async function copyLastMonthBudgets(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const month = monthField.safeParse(formData.get("month"));
  if (!month.success) return { ok: false, error: "Choose a month." };
  const previous = shiftMonth(month.data, -1);
  const { current, previous: last } = await listBudgets(month.data, previous);
  const missing = last.filter((b) => !current.some((c) => c.categoryId === b.categoryId));
  if (missing.length === 0) return { ok: false, error: "Nothing to copy from last month." };
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").insert(
    missing.map((b) => ({
      category_id: b.categoryId,
      month: `${month.data}-01`,
      amount: Number(b.amount),
      rollover: b.rollover,
    })),
  );
  if (error) return { ok: false, error: "Couldn't copy. Please try again." };
  refresh();
  return { ok: true, result: { message: `Copied ${missing.length} ${missing.length === 1 ? "budget" : "budgets"}` } };
}

/** Budgets from the last 3 months' average spending, for parent categories without one yet. */
export async function suggestBudgets(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const month = monthField.safeParse(formData.get("month"));
  if (!month.success) return { ok: false, error: "Choose a month." };
  const months = [1, 2, 3].map((n) => shiftMonth(month.data, -n));
  const [lines, categories, { current }] = await Promise.all([
    listExpenseLines(monthBounds(months[2]).from, monthBounds(months[0]).to, "posted"),
    listCategories(),
    listBudgets(month.data, months[0]),
  ]);
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId ?? c.id]));
  const rows: { category_id: string; month: string; amount: number; rollover: boolean }[] = [];
  for (const c of categories.filter((c) => c.kind === "expense" && !c.parentId && !c.archived)) {
    if (current.some((b) => b.categoryId === c.id)) continue;
    const totals = months.map((m) =>
      lines
        .filter((l) => l.categoryId && parentOf.get(l.categoryId) === c.id && l.occurredOn.startsWith(m))
        .reduce((s, l) => s + l.amount, 0n),
    );
    const suggestion = suggestBudget(totals);
    if (suggestion)
      rows.push({ category_id: c.id, month: `${month.data}-01`, amount: Number(suggestion), rollover: false });
  }
  if (rows.length === 0) return { ok: false, error: "No spending in the last 3 months to go on yet." };
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").insert(rows);
  if (error) return { ok: false, error: "Couldn't add the suggestions. Please try again." };
  refresh();
  return { ok: true, result: { message: `Suggested ${rows.length} ${rows.length === 1 ? "budget" : "budgets"}` } };
}

// ---------------------------------------------------------------- goals

export async function saveGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = goalFormSchema.safeParse({
    name: formData.get("name") ?? "",
    targetAmount: formData.get("targetAmount") ?? "",
    targetOn: formData.get("targetOn") ?? "",
    accountId: formData.get("accountId") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }
  const g = parsed.data;
  const row = { name: g.name, target_amount: Number(g.targetAmount), target_on: g.targetOn, account_id: g.accountId };
  const id = z.uuid().safeParse(formData.get("id"));
  const supabase = await createClient();
  const { error } = id.success
    ? await supabase.from("goals").update(row).eq("id", id.data)
    : await supabase.from("goals").insert(row);
  if (error) {
    console.error("[finance] goal", error.code, error.message);
    const message =
      error.code === "23503"
        ? "Pick a savings account."
        : error.code === "23505"
          ? "That account (or name) already has a goal."
          : "Couldn't save. Please try again.";
    return { ok: false, error: message, values };
  }
  refresh();
  return { ok: true, result: { message: "Goal saved" } };
}

export async function deleteGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That goal no longer exists." };
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't delete. Please try again." };
  refresh();
  return { ok: true, result: { message: "Goal removed" } };
}
