import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type Person = { id: string; name: string; archived: boolean; balance: bigint };

/** People you lend to or borrow from, with their balance (positive = they owe you) from person_balances. */
export const listPeople = cache(async (): Promise<Person[]> => {
  const supabase = await createClient();
  const [people, balances] = await Promise.all([
    supabase.from("people").select("id, name, archived_at").order("name"),
    supabase.from("person_balances").select("person_id, balance::text"),
  ]);
  if (people.error) throw new Error(`Couldn't load people: ${people.error.message}`);
  if (balances.error) throw new Error(`Couldn't load debts: ${balances.error.message}`);
  const balanceOf = new Map(
    (balances.data as unknown as { person_id: string; balance: string }[]).map((b) => [b.person_id, BigInt(b.balance)]),
  );
  return people.data.map((p) => ({
    id: p.id,
    name: p.name,
    archived: p.archived_at !== null,
    balance: balanceOf.get(p.id) ?? 0n,
  }));
});

const personNameSchema = z.string().trim().min(1, "Enter a name.").max(60, "A name can be at most 60 characters.");

/** The person called `name` (case-insensitive), created if new. Server-only helper (callers must `requireUser()`). */
export async function personIdFor(name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = personNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const existing = (await listPeople()).find((p) => p.name.toLowerCase() === parsed.data.toLowerCase());
  if (existing) return { ok: true, id: existing.id };
  const supabase = await createClient();
  const { data, error } = await supabase.from("people").insert({ name: parsed.data }).select("id").single();
  if (error) {
    // A concurrent insert of the same name: read it back.
    if (error.code === "23505") {
      const escaped = parsed.data.replace(/[\\%_]/g, (c) => `\\${c}`);
      const { data: row } = await supabase.from("people").select("id").ilike("name", escaped).maybeSingle();
      if (row) return { ok: true, id: row.id };
    }
    return { ok: false, error: "Couldn't save that person." };
  }
  return { ok: true, id: data.id };
}
