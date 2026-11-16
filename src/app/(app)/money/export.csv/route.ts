import { requireUser } from "@/features/auth/queries";
import { toCsv } from "@/features/finance/lib/to-csv";
import { ensureFinanceDefaults, listAccounts, listCategories, listTransactions } from "@/features/finance/queries";

/**
 * All finance data as one CSV download: a `record` column says what each row is
 * (account, category, transaction). Amounts are plain integer rupiah (bigint, no
 * separators), so spreadsheets read them as numbers. Authenticated: RLS limits
 * every row to the signed-in user.
 */
export async function GET() {
  await requireUser();
  await ensureFinanceDefaults();
  const [accounts, categories, { rows: transactions }] = await Promise.all([
    listAccounts(),
    listCategories(),
    listTransactions({}, 100_000),
  ]);
  const account = new Map(accounts.map((a) => [a.id, a.name]));
  const category = new Map(categories.map((c) => [c.id, c.name]));
  const rows = [
    [
      "record",
      "id",
      "date",
      "kind",
      "status",
      "amount",
      "fee",
      "account",
      "to_account",
      "category",
      "payee",
      "note",
      "direction",
      "type",
      "opening_balance",
      "balance",
      "parent",
      "archived",
    ],
    ...accounts.map((a) => [
      "account",
      a.id,
      null,
      null,
      null,
      null,
      null,
      a.name,
      null,
      null,
      null,
      null,
      null,
      a.type,
      a.openingBalance,
      a.balance,
      null,
      a.archived ? "yes" : "no",
    ]),
    ...categories.map((c) => [
      "category",
      c.id,
      null,
      c.kind,
      null,
      null,
      null,
      null,
      null,
      c.name,
      null,
      null,
      null,
      null,
      null,
      null,
      c.parentId ? (category.get(c.parentId) ?? null) : null,
      c.archived ? "yes" : "no",
    ]),
    ...transactions.map((t) => [
      "transaction",
      t.id,
      t.occurredOn,
      t.kind,
      t.status,
      t.amount,
      t.feeAmount,
      account.get(t.accountId) ?? null,
      t.toAccountId ? (account.get(t.toAccountId) ?? null) : null,
      t.categoryId ? (category.get(t.categoryId) ?? null) : null,
      t.payee,
      t.note,
      t.adjustmentDirection,
      null,
      null,
      null,
      null,
      null,
    ]),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`${toCsv(rows)}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="folium-money-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
