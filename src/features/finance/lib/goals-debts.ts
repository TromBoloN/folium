import type { IsoDate } from "./local-date";
import { daysBetween } from "./safe-to-spend";
import { splitEvenly } from "./split-evenly";

/**
 * Goals: progress is the linked savings account's balance. Pace compares it
 * with a straight line from when the goal was made to its date.
 */
export type GoalPace = {
  saved: bigint;
  remaining: bigint;
  percent: number;
  /** Per month to reach the target by its date; null without a date or when done. */
  monthlyNeeded: bigint | null;
  status: "done" | "ahead" | "behind" | "no-date" | "past";
};

export function goalPace(input: {
  target: bigint;
  saved: bigint;
  createdOn: IsoDate;
  targetOn: IsoDate | null;
  today: IsoDate;
}): GoalPace {
  const saved = input.saved > 0n ? input.saved : 0n;
  const remaining = input.target > saved ? input.target - saved : 0n;
  const percent = input.target > 0n ? Math.min(100, Number((saved * 100n) / input.target)) : 0;
  if (remaining === 0n) return { saved, remaining, percent: 100, monthlyNeeded: null, status: "done" };
  if (!input.targetOn) return { saved, remaining, percent, monthlyNeeded: null, status: "no-date" };
  const daysLeft = daysBetween(input.today, input.targetOn);
  if (daysLeft <= 0) return { saved, remaining, percent, monthlyNeeded: remaining, status: "past" };
  // Whole months left (nearest), at least one, so "next week" still means "this month".
  const monthsLeft = BigInt(Math.max(1, Math.round(daysLeft / 30.4375)));
  const monthlyNeeded = (remaining + monthsLeft - 1n) / monthsLeft;
  const total = Math.max(1, daysBetween(input.createdOn, input.targetOn));
  const elapsed = Math.min(total, Math.max(0, daysBetween(input.createdOn, input.today)));
  const expected = (input.target * BigInt(elapsed)) / BigInt(total);
  return { saved, remaining, percent, monthlyNeeded, status: saved >= expected ? "ahead" : "behind" };
}

/**
 * Splitting a bill: you pay the whole thing, your own share is a normal
 * expense, and each friend's share is a lend to them. Shares come from
 * splitEvenly, so they add up to exactly the total; you take the first
 * (largest) share when you're included.
 */
export function splitBill(
  total: bigint,
  friends: number,
  includeMe: boolean,
): { mine: bigint; theirs: bigint[] } | null {
  const parts = friends + (includeMe ? 1 : 0);
  if (friends < 1 || total <= 0n || BigInt(parts) > total) return null;
  const shares = splitEvenly(total, parts);
  return includeMe ? { mine: shares[0], theirs: shares.slice(1) } : { mine: 0n, theirs: shares };
}

/** "Budi owes you Rp 45.000" / "You owe Budi Rp 45.000" / "Settled". */
export function personBalanceLabel(name: string, balance: bigint, format: (n: bigint) => string): string {
  if (balance > 0n) return `${name} owes you ${format(balance)}`;
  if (balance < 0n) return `You owe ${name} ${format(-balance)}`;
  return "Settled";
}

/** The transaction that settles a person's balance: they repay you, or you pay them back. */
export function settlementFor(balance: bigint): { kind: "repay" | "payback"; amount: bigint } | null {
  if (balance > 0n) return { kind: "repay", amount: balance };
  if (balance < 0n) return { kind: "payback", amount: -balance };
  return null;
}
