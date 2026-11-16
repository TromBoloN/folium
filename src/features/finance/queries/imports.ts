import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ImportBatch = {
  id: string;
  accountId: string;
  filename: string | null;
  rowCount: number;
  createdAt: string;
};

export async function listImportBatches(): Promise<ImportBatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, account_id, filename, row_count, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Couldn't load imports: ${error.message}`);
  return data.map((b) => ({
    id: b.id,
    accountId: b.account_id,
    filename: b.filename,
    rowCount: b.row_count,
    createdAt: b.created_at,
  }));
}

/** Everything in the finance tables, for the JSON backup. Amounts as strings (exact). */
export async function financeBackup() {
  const supabase = await createClient();
  const tables = [
    ["accounts", "*, opening_balance::text"],
    ["categories", "*"],
    ["transactions", "*, amount::text, fee_amount::text"],
    ["recurring_rules", "*, amount::text"],
    ["budgets", "*, amount::text"],
    ["goals", "*, target_amount::text"],
    ["people", "*"],
    ["import_batches", "*"],
  ] as const;
  const out: Record<string, unknown> = { format: "folium-money-backup", version: 1 };
  for (const [table, columns] of tables) {
    const { data, error } = await supabase.from(table).select(columns).limit(100_000);
    if (error) throw new Error(`Couldn't read ${table}: ${error.message}`);
    out[table] = data;
  }
  return out;
}
