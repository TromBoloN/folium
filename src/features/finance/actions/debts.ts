"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type FormState, formValues } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "../../auth/queries";
import { getSettings } from "../../settings/queries";
import { formatIdr } from "../lib/format-idr";
import { settlementFor, splitBill } from "../lib/goals-debts";
import { localDateFor } from "../lib/local-date";
import { parseAmount } from "../lib/parse-amount";
import { listAccounts } from "../queries";
import { listPeople } from "../queries/people";

function refresh() {
  revalidatePath("/money", "layout");
  revalidatePath("/");
}

const nameSchema = z.string().trim().min(1, "Enter a name.").max(60, "A name can be at most 60 characters.");

/** The person called `name` (case-insensitive), created if new. Also used by saveTransaction. */
export async function personIdFor(name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const existing = (await listPeople()).find((p) => p.name.toLowerCase() === parsed.data.toLowerCase());
  if (existing) return { ok: true, id: existing.id };
  const supabase = await createClient();
  const { data, error } = await supabase.from("people").insert({ name: parsed.data }).select("id").single();
  if (error) {
    // A concurrent insert of the same name: read it back.
    if (error.code === "23505") {
      const { data: row } = await supabase.from("people").select("id").ilike("name", parsed.data).maybeSingle();
      if (row) return { ok: true, id: row.id };
    }
    return { ok: false, error: "Couldn't save that person." };
  }
  return { ok: true, id: data.id };
}

export async function addPerson(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const result = await personIdFor(String(formData.get("name") ?? ""));
  if (!result.ok) return { ok: false, error: result.error, fieldErrors: { name: result.error }, values };
  refresh();
  return { ok: true, result: { message: "Added" } };
}

export async function setPersonArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "That person no longer exists." };
  const supabase = await createClient();
  const archived = formData.get("archive") === "true";
  const { error } = await supabase
    .from("people")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return { ok: false, error: "Couldn't update. Please try again." };
  refresh();
  return { ok: true };
}

/** "Mark settled": record the money that clears this person's balance (repay or payback), dated today. */
export async function settlePerson(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const personId = z.uuid().safeParse(formData.get("personId"));
  const accountId = z.uuid().safeParse(formData.get("accountId"));
  if (!personId.success || !accountId.success) return { ok: false, error: "Choose an account." };
  const person = (await listPeople()).find((p) => p.id === personId.data);
  const settle = person ? settlementFor(person.balance) : null;
  if (!person || !settle) return { ok: false, error: "Nothing to settle." };
  const { preferences } = await getSettings();
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert({
    kind: settle.kind,
    amount: Number(settle.amount),
    account_id: accountId.data,
    person_id: person.id,
    occurred_on: localDateFor(new Date(), preferences.timeZone),
    note: "Settled",
  });
  if (error) {
    console.error("[finance] settle", error.code, error.message);
    return { ok: false, error: "Couldn't record it. Please try again." };
  }
  refresh();
  return {
    ok: true,
    result: {
      message:
        settle.kind === "repay"
          ? `${person.name} paid you ${formatIdr(settle.amount)}`
          : `You paid ${person.name} ${formatIdr(settle.amount)}`,
    },
  };
}

const splitSchema = z.object({
  amount: z.string(),
  accountId: z.uuid("Choose an account."),
  categoryId: z.union([z.uuid(), z.literal("")]),
  payee: z.string().trim().max(120),
  names: z.string(),
  includeMe: z.boolean(),
});

/**
 * Split a bill you paid: your share is an expense (a normal one, in reports),
 * each friend's share is a lend to them, so it shows under Debts and never as
 * your spending. Shares from splitEvenly add up to exactly the total.
 */
export async function splitBillAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = splitSchema.safeParse({
    amount: formData.get("amount") ?? "",
    accountId: formData.get("accountId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    payee: formData.get("payee") ?? "",
    names: formData.get("names") ?? "",
    includeMe: formData.get("includeMe") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, values };
  const amount = parseAmount(parsed.data.amount);
  if (!amount.ok || amount.value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return {
      ok: false,
      error: "Enter the total, like 150k.",
      fieldErrors: { amount: "Enter the total, like 150k." },
      values,
    };
  }
  const names = [
    ...new Map(
      parsed.data.names
        .split(/[,\n]/)
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => [n.toLowerCase(), n]),
    ).values(),
  ];
  const shares = splitBill(amount.value, names.length, parsed.data.includeMe);
  if (!shares) {
    return { ok: false, error: "Add at least one friend.", fieldErrors: { names: "Add at least one friend." }, values };
  }
  const accounts = await listAccounts();
  if (!accounts.some((a) => a.id === parsed.data.accountId && !a.archived)) {
    return { ok: false, error: "Choose an account.", values };
  }
  const people: string[] = [];
  for (const name of names) {
    const person = await personIdFor(name);
    if (!person.ok) return { ok: false, error: person.error, values };
    people.push(person.id);
  }
  const { preferences } = await getSettings();
  const occurredOn = localDateFor(new Date(), preferences.timeZone);
  const payee = parsed.data.payee || null;
  const rows = [
    ...(shares.mine > 0n
      ? [
          {
            kind: "expense",
            amount: Number(shares.mine),
            account_id: parsed.data.accountId,
            category_id: parsed.data.categoryId || null,
            payee,
            note: `My share of ${formatIdr(amount.value)}`,
            occurred_on: occurredOn,
          },
        ]
      : []),
    ...people.map((personId, i) => ({
      kind: "lend",
      amount: Number(shares.theirs[i]),
      account_id: parsed.data.accountId,
      person_id: personId,
      note: payee ? `Share of ${payee}` : "Share of a bill",
      occurred_on: occurredOn,
    })),
  ];
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) {
    console.error("[finance] split", error.code, error.message);
    return {
      ok: false,
      error: error.code === "23503" ? "That category can't be used here." : "Couldn't save the split.",
      values,
    };
  }
  refresh();
  return { ok: true, result: { message: `Split ${formatIdr(amount.value)} with ${names.join(", ")}` } };
}
