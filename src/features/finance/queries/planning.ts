import "server-only";
import { cache } from "react";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { createClient } from "@/lib/supabase/server";
import { addDays, type IsoDate } from "../lib/local-date";
import { type Cadence, occurrencesBetween } from "../lib/recurrence";
import { type Transaction, TX_COLUMNS, type TxRow, toTransaction } from "./index";

/**
 * Recurring rules, budgets and goals. Planned transactions are generated from
 * rules lazily (on a Money or Today visit), up to HORIZON_DAYS ahead. No cron.
 */

export const HORIZON_DAYS = 45;
/** A rule older than this doesn't backfill further (no flood of overdue rows). */
const BACKFILL_DAYS = 60;

export type Rule = {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer";
  amount: bigint;
  isEstimate: boolean;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  payee: string | null;
  cadence: Cadence;
  intervalCount: number;
  dueDay: number | null;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  instalmentsTotal: number | null;
  remindDaysBefore: number;
  active: boolean;
  pausedUntil: IsoDate | null;
  generatedThrough: IsoDate | null;
  updatedAt: string;
};

const RULE_COLUMNS =
  "id, name, kind, amount::text, is_estimate, account_id, to_account_id, category_id, payee, cadence, interval_count, due_day, starts_on, ends_on, instalments_total, remind_days_before, active, paused_until, generated_through, updated_at";

type RuleRow = {
  id: string;
  name: string;
  kind: Rule["kind"];
  amount: string;
  is_estimate: boolean;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  payee: string | null;
  cadence: Cadence;
  interval_count: number;
  due_day: number | null;
  starts_on: string;
  ends_on: string | null;
  instalments_total: number | null;
  remind_days_before: number;
  active: boolean;
  paused_until: string | null;
  generated_through: string | null;
  updated_at: string;
};

function toRule(r: RuleRow): Rule {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    amount: BigInt(r.amount),
    isEstimate: r.is_estimate,
    accountId: r.account_id,
    toAccountId: r.to_account_id,
    categoryId: r.category_id,
    payee: r.payee,
    cadence: r.cadence,
    intervalCount: r.interval_count,
    dueDay: r.due_day,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    instalmentsTotal: r.instalments_total,
    remindDaysBefore: r.remind_days_before,
    active: r.active,
    pausedUntil: r.paused_until,
    generatedThrough: r.generated_through,
    updatedAt: r.updated_at,
  };
}

export const listRules = cache(async (): Promise<Rule[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_rules").select(RULE_COLUMNS).order("name");
  if (error) throw new Error(`Couldn't load recurring rules: ${error.message}`);
  return (data as unknown as RuleRow[]).map(toRule);
});

export async function getRule(id: string): Promise<Rule | null> {
  return (await listRules()).find((r) => r.id === id) ?? null;
}

/**
 * Create the planned rows each active rule owes, from where it was last
 * generated up to today + HORIZON_DAYS. Idempotent: unique (rule, due date) in
 * SQL, and `generated_through` so a deleted (skipped) occurrence stays gone.
 * Cached per request; pass the user's today. Bills never create or touch tasks.
 */
export const ensureRecurringGenerated = cache(async (today: IsoDate): Promise<void> => {
  const rules = (await listRules()).filter((r) => r.active);
  const to = addDays(today, HORIZON_DAYS);
  const floor = addDays(today, -BACKFILL_DAYS);
  const supabase = await createClient();
  const due = rules.filter((rule) => !rule.generatedThrough || rule.generatedThrough < to);
  await Promise.all(
    due.map(async (rule) => {
      const start = rule.generatedThrough ? addDays(rule.generatedThrough, 1) : rule.startsOn;
      // biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers.
      const dates = occurrencesBetween(rule, start > floor ? start : floor, to);
      const { error } = await supabase.rpc("generate_recurring_transactions", {
        p_rule_id: rule.id,
        p_expected_updated_at: rule.updatedAt,
        p_to: to,
        p_dates: dates,
      });
      if (error) console.error("[finance] generate", rule.id, error.code, error.message);
    }),
  );
});

export type Bill = Transaction & { rule: Rule | null };

/** Planned rows that came from a rule (bills, allowance, set-asides), oldest first. */
export async function listBills(): Promise<Bill[]> {
  const supabase = await createClient();
  const [{ data, error }, rules] = await Promise.all([
    supabase
      .from("transactions")
      .select(TX_COLUMNS)
      .eq("status", "planned")
      .not("recurring_rule_id", "is", null)
      .order("occurred_on")
      .limit(500),
    listRules(),
  ]);
  if (error) throw new Error(`Couldn't load bills: ${error.message}`);
  const byId = new Map(rules.map((r) => [r.id, r]));
  return (data as unknown as TxRow[])
    .map(toTransaction)
    .map((t) => ({ ...t, rule: t.recurringRuleId ? (byId.get(t.recurringRuleId) ?? null) : null }));
}

/** Every planned row (for safe to spend and the forecast), any origin. */
export async function listPlanned(): Promise<Transaction[]> {
  const supabase = await createClient();
  const rows = await fetchAllPages<TxRow>(
    (from, to) =>
      supabase
        .from("transactions")
        .select(TX_COLUMNS)
        .eq("status", "planned")
        .order("occurred_on")
        .order("id")
        .range(from, to),
    "Couldn't load planned transactions",
  );
  return rows.map(toTransaction);
}

/** Posted rule payments in a date range (paid vs remaining this month). */
export async function listPaidFromRules(from: IsoDate, to: IsoDate): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("status", "posted")
    .not("recurring_rule_id", "is", null)
    .gte("due_on", from)
    .lte("due_on", to);
  if (error) throw new Error(`Couldn't load payments: ${error.message}`);
  return (data as unknown as TxRow[]).map(toTransaction);
}

export type Budget = { id: string; categoryId: string; month: string; amount: bigint; rollover: boolean };

/** Budgets for a month ("2026-11") and the month before (for rollover). */
export async function listBudgets(
  month: string,
  previousMonth: string,
): Promise<{ current: Budget[]; previous: Budget[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, category_id, month, amount::text, rollover")
    .in("month", [`${month}-01`, `${previousMonth}-01`]);
  if (error) throw new Error(`Couldn't load budgets: ${error.message}`);
  const rows = (
    data as unknown as { id: string; category_id: string; month: string; amount: string; rollover: boolean }[]
  ).map((b) => ({
    id: b.id,
    categoryId: b.category_id,
    month: b.month.slice(0, 7),
    amount: BigInt(b.amount),
    rollover: b.rollover,
  }));
  return { current: rows.filter((b) => b.month === month), previous: rows.filter((b) => b.month === previousMonth) };
}

/** Expense lines (category + amount) for a date range: posted or planned. */
export async function listExpenseLines(
  fromDate: IsoDate,
  toDate: IsoDate,
  status: "posted" | "planned",
): Promise<{ categoryId: string | null; amount: bigint; occurredOn: string }[]> {
  const supabase = await createClient();
  const rows = await fetchAllPages<{ category_id: string | null; amount: string; occurred_on: string }>(
    (from, to) =>
      supabase
        .from("transactions")
        .select("category_id, amount::text, occurred_on")
        .eq("kind", "expense")
        .eq("status", status)
        .gte("occurred_on", fromDate)
        .lte("occurred_on", toDate)
        .order("id")
        .range(from, to),
    "Couldn't load spending",
  );
  return rows.map((r) => ({
    categoryId: r.category_id,
    amount: BigInt(r.amount),
    occurredOn: r.occurred_on,
  }));
}

export type Goal = {
  id: string;
  name: string;
  targetAmount: bigint;
  targetOn: IsoDate | null;
  accountId: string;
  createdOn: IsoDate;
};

export const listGoals = cache(async (): Promise<Goal[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id, name, target_amount::text, target_on, account_id, created_at")
    .order("target_on", { nullsFirst: false })
    .order("name");
  if (error) throw new Error(`Couldn't load goals: ${error.message}`);
  return (
    data as unknown as {
      id: string;
      name: string;
      target_amount: string;
      target_on: string | null;
      account_id: string;
      created_at: string;
    }[]
  ).map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: BigInt(g.target_amount),
    targetOn: g.target_on,
    accountId: g.account_id,
    createdOn: g.created_at.slice(0, 10),
  }));
});

/** Posted expenses tagged to a course: count and total. */
export async function courseSpending(courseId: string): Promise<{ count: number; total: bigint }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("amount::text")
    .eq("course_id", courseId)
    .eq("status", "posted")
    .eq("kind", "expense");
  if (error || !data) return { count: 0, total: 0n };
  const rows = data as unknown as { amount: string }[];
  return { count: rows.length, total: rows.reduce((s, r) => s + BigInt(r.amount), 0n) };
}
