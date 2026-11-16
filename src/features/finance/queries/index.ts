import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
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
  sortOrder: number;
  archived: boolean;
  openingBalance: bigint;
  balance: bigint;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  color: string;
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
  sort_order: number;
  archived_at: string | null;
  opening_balance: string;
};

export const listAccounts = cache(async (): Promise<Account[]> => {
  const supabase = await createClient();
  const [accounts, balances] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, color, sort_order, archived_at, opening_balance::text")
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
    sortOrder: a.sort_order,
    archived: a.archived_at !== null,
    openingBalance: BigInt(a.opening_balance),
    balance: balanceOf.get(a.id) ?? BigInt(a.opening_balance),
  }));
});

export const listCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, parent_id, color, sort_order, archived_at")
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
    sortOrder: c.sort_order,
    archived: c.archived_at !== null,
  }));
});

const TX_COLUMNS =
  "id, kind, status, amount::text, fee_amount::text, account_id, to_account_id, category_id, payee, note, occurred_on, adjustment_direction, created_at";

type TxRow = {
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
  created_at: string;
};

function toTransaction(r: TxRow): Transaction {
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
    createdAt: r.created_at,
  };
}

/** Escape LIKE wildcards, then quote for a PostgREST `or` filter. */
function quotedLike(q: string) {
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return `"${pattern.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/** Transactions, newest first, with the URL filters applied in SQL. */
export async function listTransactions(filters: TransactionFilters, limit = 200): Promise<Transaction[]> {
  const supabase = await createClient();
  let query = supabase.from("transactions").select(TX_COLUMNS);
  // Two "either" conditions (account on either side, text in payee or note) must go in one
  // `or` parameter: PostgREST doesn't reliably combine repeated ones.
  const groups: string[] = [];
  if (filters.account) groups.push(`account_id.eq.${filters.account},to_account_id.eq.${filters.account}`);
  if (filters.q) groups.push(`payee.ilike.${quotedLike(filters.q)},note.ilike.${quotedLike(filters.q)}`);
  if (groups.length === 1) query = query.or(groups[0]);
  if (groups.length === 2) query = query.or(`and(or(${groups[0]}),or(${groups[1]}))`);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.month) {
    const { from, to } = monthBounds(filters.month);
    query = query.gte("occurred_on", from).lte("occurred_on", to);
  }
  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Couldn't load transactions: ${error.message}`);
  return (data as unknown as TxRow[]).map(toTransaction);
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").select(TX_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the transaction: ${error.message}`);
  return data ? toTransaction(data as unknown as TxRow) : null;
}

/** Posted income and expense rows in a date range (for "This month"). */
export async function listPostedInOut(from: string, to: string): Promise<{ kind: string; amount: bigint }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("kind, amount::text")
    .eq("status", "posted")
    .in("kind", ["income", "expense"])
    .gte("occurred_on", from)
    .lte("occurred_on", to);
  if (error) throw new Error(`Couldn't load this month: ${error.message}`);
  return (data as unknown as { kind: string; amount: string }[]).map((r) => ({
    kind: r.kind,
    amount: BigInt(r.amount),
  }));
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
