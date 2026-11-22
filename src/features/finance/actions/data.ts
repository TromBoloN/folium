"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../../auth/queries";
import { type DateFormat, guessMapping, type Mapping, mapRows, parseCsv } from "../lib/csv-import";
import { formatIdr } from "../lib/format-idr";
import { listAccounts } from "../queries";

function refresh() {
  revalidatePath("/money", "layout");
  revalidatePath("/");
}

const MAX_BYTES = 900_000;
const MAX_ROWS = 5000;

export type ImportState = {
  step: "upload" | "map" | "done";
  error?: string;
  csv?: string;
  filename?: string;
  accountId?: string;
  header?: string[];
  mapping?: Partial<Mapping> & { hasHeader?: boolean };
  preview?: { line: number; date: string; kind: string; amount: string; payee: string }[];
  problems?: { line: number; message: string }[];
  total?: number;
  inserted?: number;
  skipped?: number;
};

const col = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return v === null || v === "" || !Number.isInteger(n) || n < 0 ? undefined : n;
};

function mappingFrom(formData: FormData): Mapping & { hasHeader: boolean } {
  const format = String(formData.get("dateFormat") ?? "dmy");
  return {
    date: col(formData.get("colDate")) ?? 0,
    amount: col(formData.get("colAmount")),
    debit: col(formData.get("colDebit")),
    credit: col(formData.get("colCredit")),
    payee: col(formData.get("colPayee")),
    note: col(formData.get("colNote")),
    dateFormat: (["ymd", "dmy", "mdy"].includes(format) ? format : "dmy") as DateFormat,
    positiveIsExpense: formData.get("positiveIsExpense") === "on",
    hasHeader: formData.getAll("hasHeader").includes("on"),
  };
}

/**
 * CSV import in steps, one action (works without JavaScript):
 *   upload  → parse, guess the columns
 *   map     → preview with the chosen columns (re-run as often as needed)
 *   import  → write a batch; rows already imported (same account + key) are skipped
 */
export async function importCsv(prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireUser();
  const step = String(formData.get("step") ?? "upload");
  const accounts = (await listAccounts()).filter((a) => !a.archived);
  const accountId = String(formData.get("accountId") ?? "");
  if (!accounts.some((a) => a.id === accountId))
    return { ...prev, step: prev.step, error: "Choose the account this file is from." };

  let csv = String(formData.get("csv") ?? "");
  let filename = String(formData.get("filename") ?? "");
  if (step === "upload") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { step: "upload", error: "Choose a CSV file." };
    if (file.size > MAX_BYTES)
      return { step: "upload", error: "That file is too big (900 KB at most). Split it by month." };
    csv = await file.text();
    filename = file.name.slice(0, 200);
  }
  const all = parseCsv(csv);
  if (all.length === 0) return { step: "upload", error: "That file has no rows." };
  if (all.length > MAX_ROWS + 1) return { step: "upload", error: `Up to ${MAX_ROWS} rows at a time.` };

  if (step === "upload") {
    const guess = guessMapping(all[0]);
    return {
      step: "map",
      csv,
      filename,
      accountId,
      header: all[0],
      mapping: { ...guess, date: guess.date ?? 0, dateFormat: "dmy", hasHeader: true },
    };
  }

  const mapping = mappingFrom(formData);
  const body = mapping.hasHeader ? all.slice(1) : all;
  const { drafts, errors } = mapRows(body, mapping, mapping.hasHeader ? 2 : 1);
  const base: ImportState = {
    step: "map",
    csv,
    filename,
    accountId,
    header: all[0],
    mapping,
    preview: drafts.slice(0, 15).map((d) => ({
      line: d.line,
      date: d.occurredOn,
      kind: d.kind,
      amount: formatIdr(d.amount),
      payee: d.payee ?? "",
    })),
    problems: errors.slice(0, 10),
    total: drafts.length,
  };
  if (step !== "import") return base;
  if (drafts.length === 0) return { ...base, error: "No rows to import with these columns." };

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({ account_id: accountId, filename: filename || null, row_count: 0 })
    .select("id")
    .single();
  if (batchError) return { ...base, error: "Couldn't start the import. Please try again." };
  const { data: inserted, error } = await supabase
    .from("transactions")
    .upsert(
      drafts.map((d) => ({
        kind: d.kind,
        amount: Number(d.amount),
        account_id: accountId,
        payee: d.payee,
        note: d.note,
        occurred_on: d.occurredOn,
        import_batch_id: batch.id,
        import_key: d.key,
      })),
      { onConflict: "account_id,import_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    console.error("[finance] import", error.code, error.message);
    await supabase.from("import_batches").delete().eq("id", batch.id);
    return { ...base, error: "Couldn't import. Nothing was saved." };
  }
  const count = inserted?.length ?? 0;
  if (count === 0) await supabase.from("import_batches").delete().eq("id", batch.id);
  else await supabase.from("import_batches").update({ row_count: count }).eq("id", batch.id);
  refresh();
  return { step: "done", accountId, inserted: count, skipped: drafts.length - count, filename };
}

/** "Undo this import": deleting the batch deletes its transactions (ON DELETE CASCADE). */
export async function undoImport(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That import no longer exists." };
  const supabase = await createClient();
  const { error } = await supabase.from("import_batches").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't undo. Please try again." };
  refresh();
  return { ok: true, result: { message: "Import undone" } };
}

/**
 * Delete ALL finance data (transactions, rules, budgets, goals, people, imports,
 * categories, accounts). Needs "DELETE" typed. The default accounts and
 * categories come back on the next Money visit.
 */
export async function deleteAllFinanceData(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") {
    return { ok: false, error: "Type DELETE to confirm." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_all_finance_data");
  if (error) {
    console.error("[finance] delete all", error.code, error.message);
    return { ok: false, error: "Couldn't delete everything. Please try again." };
  }
  refresh();
  return { ok: true, result: { message: "All money data deleted" } };
}
