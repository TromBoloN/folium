import "server-only";
import { cache } from "react";
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
