import "server-only";
import { forecast, type SafeToSpend, safeToSpend } from "../lib/safe-to-spend";
import { listAccounts } from "./index";
import { listPlanned } from "./planning";

/** Safe to spend and the 30-day forecast, from spendable accounts and every planned row. */
export async function loadSafeToSpend(today: string): Promise<{
  safe: SafeToSpend;
  points: { date: string; balance: bigint }[];
  firstNegative: string | null;
  spendableCount: number;
}> {
  const [accounts, planned] = await Promise.all([listAccounts(), listPlanned()]);
  const spendableAccounts = accounts.filter((a) => a.isSpendable && !a.archived);
  const spendable = new Set(spendableAccounts.map((a) => a.id));
  const liquid = spendableAccounts.reduce((s, a) => s + a.balance, 0n);
  const safe = safeToSpend({ liquid, planned, spendable, today });
  const { points, firstNegative } = forecast({ liquid, planned, spendable, today, days: 30 });
  return { safe, points, firstNegative, spendableCount: spendableAccounts.length };
}
