import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import { quotedLike } from "@/lib/supabase/filter";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, CategoryKind, TransactionFilters, TransactionKind } from "../schemas";
import { monthBounds } from "../schemas/money-math";

/**
 * Finance reads. Amounts are selected as text (`amount::text`) and turned into
 * bigint here, so nothing passes through a float. Balances always come from the
 * `account_balances` view; never add them up in TypeScript.
 */

export const LAST_ACCOUNT_COOKIE = "folium_last_account";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  icon: string | null;
  sortOrder: number;
  archived: boolean;
  /** Counted by safe to spend (savings are off by default). */
  isSpendable: boolean;
  openingBalance: bigint;
  balance: bigint;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  color: string;
  icon: string | null;
  sortOrder: number;
  archived: boolean;
};

export type Transaction = {
  id: string;
  kind: TransactionKind;
  status: "posted" | "planned";
  amount: bigint;
  feeAmount: bigint;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  payee: string | null;
  note: string | null;
  occurredOn: string;
  adjustmentDirection: "in" | "out" | null;
  personId: string | null;
  recurringRuleId: string | null;
  dueOn: string | null;
  courseId: string | null;
  createdAt: string;
};

/**
 * Default accounts and categories for a first visit (the SQL function is a
 * no-op once the user has any). Cached per request; call before other reads.
 */
export const ensureFinanceDefaults = cache(async (): Promise<void> => {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ensure_finance_defaults");
  if (error) throw new Error(`Couldn't set up money: ${error.message}`);
});

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  icon: string | null;
  sort_order: number;
  archived_at: string | null;
  is_spendable: boolean;
  opening_balance: string;
};

export const listAccounts = cache(async (): Promise<Account[]> => {
  const supabase = await createClient();
  const [accounts, balances] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, color, icon, sort_order, archived_at, is_spendable, opening_balance::text")
      .order("sort_order")
      .order("name"),
    supabase.from("account_balances").select("account_id, balance::text"),
  ]);
  if (accounts.error) throw new Error(`Couldn't load accounts: ${accounts.error.message}`);
  if (balances.error) throw new Error(`Couldn't load balances: ${balances.error.message}`);
  const balanceOf = new Map(
    (balances.data as unknown as { account_id: string; balance: string }[]).map((b) => [
      b.account_id,
      BigInt(b.balance),
    ]),
  );
  return (accounts.data as unknown as AccountRow[]).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    color: a.color,
    icon: a.icon,
    sortOrder: a.sort_order,
    archived: a.archived_at !== null,
    isSpendable: a.is_spendable,
    openingBalance: BigInt(a.opening_balance),
    balance: balanceOf.get(a.id) ?? BigInt(a.opening_balance),
  }));
});

export const listCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, parent_id, color, icon, sort_order, archived_at")
    .order("kind")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Couldn't load categories: ${error.message}`);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind as CategoryKind,
    parentId: c.parent_id,
    color: c.color,
    icon: c.icon,
    sortOrder: c.sort_order,
    archived: c.archived_at !== null,
  }));
});

export const TX_COLUMNS =
  "id, kind, status, amount::text, fee_amount::text, account_id, to_account_id, category_id, payee, note, occurred_on, adjustment_direction, person_id, recurring_rule_id, due_on, course_id, created_at";

export type TxRow = {
  id: string;
  kind: TransactionKind;
  status: "posted" | "planned";
  amount: string;
  fee_amount: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  payee: string | null;
  note: string | null;
  occurred_on: string;
  adjustment_direction: "in" | "out" | null;
  person_id: string | null;
  recurring_rule_id: string | null;
  due_on: string | null;
  course_id: string | null;
  created_at: string;
};

export function toTransaction(r: TxRow): Transaction {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    amount: BigInt(r.amount),
    feeAmount: BigInt(r.fee_amount),
    accountId: r.account_id,
    toAccountId: r.to_account_id,
    categoryId: r.category_id,
    payee: r.payee,
    note: r.note,
    occurredOn: r.occurred_on,
    adjustmentDirection: r.adjustment_direction,
    personId: r.person_id,
    recurringRuleId: r.recurring_rule_id,
    dueOn: r.due_on,
    courseId: r.course_id,
    createdAt: r.created_at,
  };
}

/** The few filter methods used here (PostgREST's builder types are too generic to name). */
type Filterable = {
  or(f: string): Filterable;
  eq(c: string, v: string): Filterable;
  in(c: string, v: string[]): Filterable;
  is(c: string, v: null): Filterable;
  gte(c: string, v: string): Filterable;
  lte(c: string, v: string): Filterable;
};

/** A category and its children (a parent's filter includes them: they roll up into it). */
async function categoryWithChildren(id: string | undefined): Promise<string[]> {
  if (!id || id === "none") return [];
  return [id, ...(await listCategories()).filter((c) => c.parentId === id).map((c) => c.id)];
}

/**
 * The URL filters as SQL. Synchronous on purpose: the builder is thenable, so
 * returning it from an async function would run the query early.
 */
function applyFilters<Q>(query: Q, filters: TransactionFilters, categoryIds: string[]): Q {
  let q = query as unknown as Filterable;
  // Two "either" conditions (account on either side, text in payee or note) must go in one
  // `or` parameter: PostgREST doesn't reliably combine repeated ones.
  const groups: string[] = [];
  if (filters.account) groups.push(`account_id.eq.${filters.account},to_account_id.eq.${filters.account}`);
  if (filters.q) groups.push(`payee.ilike.${quotedLike(filters.q)},note.ilike.${quotedLike(filters.q)}`);
  if (groups.length === 1) q = q.or(groups[0]);
  if (groups.length === 2) q = q.or(`and(or(${groups[0]}),or(${groups[1]}))`);
  // "none": uncategorised income and expenses (transfers and adjustments never have a category).
  if (filters.category === "none") q = q.is("category_id", null).in("kind", ["expense", "income"]);
  else if (filters.category) q = q.in("category_id", categoryIds);
  if (filters.kind) q = q.eq("kind", filters.kind);
  if (filters.month) {
    const { from, to } = monthBounds(filters.month);
    q = q.gte("occurred_on", from).lte("occurred_on", to);
  }
  return q as unknown as Q;
}

/** Transactions, newest first, with the URL filters applied in SQL. `more` says whether older ones exist. */
export async function listTransactions(
  filters: TransactionFilters,
  limit = 200,
): Promise<{ rows: Transaction[]; more: boolean }> {
  const [supabase, categoryIds] = await Promise.all([createClient(), categoryWithChildren(filters.category)]);
  const data = await fetchAllPages<TxRow>(
    (from, to) =>
      applyFilters(supabase.from("transactions").select(TX_COLUMNS), filters, categoryIds)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    "Couldn't load transactions",
    limit + 1,
  );
  const rows = data.map(toTransaction);
  return { rows: rows.slice(0, limit), more: rows.length > limit };
}

/** Every transaction, newest first (for full CSV export). */
export async function listAllTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const data = await fetchAllPages<TxRow>(
    (from, to) =>
      supabase
        .from("transactions")
        .select(TX_COLUMNS)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    "Couldn't load transactions",
  );
  return data.map(toTransaction);
}

/** Count and posted money in/out for everything the filters match (not just the page shown). */
export async function summarizeTransactions(
  filters: TransactionFilters,
): Promise<{ count: number; income: bigint; expense: bigint }> {
  const [supabase, categoryIds] = await Promise.all([createClient(), categoryWithChildren(filters.category)]);
  const rows = await fetchAllPages<{ kind: string; status: string; amount: string }>(
    (from, to) =>
      applyFilters(supabase.from("transactions").select("kind, status, amount::text"), filters, categoryIds)
        .order("id")
        .range(from, to),
    "Couldn't load the summary",
  );
  let income = 0n;
  let expense = 0n;
  for (const r of rows) {
    if (r.status !== "posted") continue;
    if (r.kind === "income") income += BigInt(r.amount);
    else if (r.kind === "expense") expense += BigInt(r.amount);
  }
  return { count: rows.length, income, expense };
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").select(TX_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the transaction: ${error.message}`);
  return data ? toTransaction(data as unknown as TxRow) : null;
}

/** Posted income and expense rows in a date range (month totals and spending by category). */
export async function listPostedInOut(
  fromDate: string,
  toDate: string,
): Promise<{ kind: string; status: string; categoryId: string | null; amount: bigint }[]> {
  const supabase = await createClient();
  const rows = await fetchAllPages<{ kind: string; category_id: string | null; amount: string }>(
    (from, to) =>
      supabase
        .from("transactions")
        .select("kind, category_id, amount::text")
        .eq("status", "posted")
        .in("kind", ["income", "expense"])
        .gte("occurred_on", fromDate)
        .lte("occurred_on", toDate)
        .order("id")
        .range(from, to),
    "Couldn't load this month",
  );
  return rows.map((r) => ({
    kind: r.kind,
    status: "posted",
    categoryId: r.category_id,
    amount: BigInt(r.amount),
  }));
}

/**
 * Posted rows dated after `since`, future-dated ones included: what balanceSeries
 * needs to work backwards from account_balances.
 */
export async function listPostedSince(since: string): Promise<Transaction[]> {
  const supabase = await createClient();
  const rows = await fetchAllPages<TxRow>(
    (from, to) =>
      supabase
        .from("transactions")
        .select(TX_COLUMNS)
        .eq("status", "posted")
        .gt("occurred_on", since)
        .order("id")
        .range(from, to),
    "Couldn't load recent activity",
  );
  return rows.map(toTransaction);
}

/** Recent payee → category pairs, for suggesting a category as you type a payee. */
export async function listPayeeHistory(): Promise<{ payee: string; categoryId: string; occurredOn: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("payee, category_id, occurred_on")
    .not("payee", "is", null)
    .not("category_id", "is", null)
    .order("occurred_on", { ascending: false })
    .limit(300);
  if (error) return [];
  return data.map((r) => ({
    payee: r.payee as string,
    categoryId: r.category_id as string,
    occurredOn: r.occurred_on,
  }));
}

export const hasAnyTransaction = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { count, error } = await supabase.from("transactions").select("id", { count: "exact", head: true }).limit(1);
  if (error) return false;
  return (count ?? 0) > 0;
});

/** The account used last (a cookie set by the save actions), if it's still one of the user's active accounts. */
export async function lastUsedAccountId(accounts: readonly Account[]): Promise<string | undefined> {
  const id = (await cookies()).get(LAST_ACCOUNT_COOKIE)?.value;
  return accounts.find((a) => a.id === id && !a.archived)?.id ?? accounts.find((a) => !a.archived)?.id;
}
