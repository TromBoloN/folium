/**
 * Spending by category for one period: child categories roll up into their
 * parent, the biggest `top` stay, the rest become "Other". Only posted
 * expenses count; transfers and adjustments are moves, not spending.
 * Percentages are whole numbers that always sum to exactly 100
 * (largest-remainder), and empty input gives no slices (never NaN).
 */

export type SpendRow = { kind: string; status: string; categoryId: string | null; amount: bigint };
export type RollupCategory = { id: string; name: string; parentId: string | null; color: string };

export const UNCATEGORISED = "none";
export const OTHER = "other";

export type Slice = {
  /** A category id, UNCATEGORISED or OTHER. */
  id: string;
  name: string;
  color: string | null;
  amount: bigint;
  percent: number;
};

export function rollupByCategory(
  rows: readonly SpendRow[],
  categories: readonly RollupCategory[],
  top = 5,
): { total: bigint; slices: Slice[] } {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string, bigint>();
  for (const row of rows) {
    if (row.kind !== "expense" || row.status !== "posted" || row.amount <= 0n) continue;
    const category = row.categoryId ? byId.get(row.categoryId) : undefined;
    const parent = category?.parentId ? byId.get(category.parentId) : undefined;
    const key = (parent ?? category)?.id ?? UNCATEGORISED;
    sums.set(key, (sums.get(key) ?? 0n) + row.amount);
  }

  const groups = [...sums]
    .map(([id, amount]) => {
      const c = byId.get(id);
      return { id, name: c?.name ?? "Uncategorised", color: c?.color ?? null, amount };
    })
    .sort((a, b) => (a.amount === b.amount ? a.name.localeCompare(b.name) : a.amount > b.amount ? -1 : 1));

  const total = groups.reduce((sum, g) => sum + g.amount, 0n);
  if (total === 0n) return { total, slices: [] };

  // "Other" only when it folds two or more groups; a single leftover keeps its own name.
  const keep = groups.length > top + 1 ? groups.slice(0, top) : groups;
  const rest = groups.slice(keep.length);
  const shown = rest.length
    ? [...keep, { id: OTHER, name: "Other", color: null, amount: rest.reduce((s, g) => s + g.amount, 0n) }]
    : keep;

  const percents = largestRemainder(
    shown.map((g) => g.amount),
    total,
  );
  return { total, slices: shown.map((g, i) => ({ ...g, percent: percents[i] })) };
}

/** Whole percentages of `total` that sum to exactly 100: floor each, then give the leftover points to the largest remainders. */
export function largestRemainder(amounts: readonly bigint[], total: bigint): number[] {
  if (total <= 0n || amounts.length === 0) return amounts.map(() => 0);
  const floors = amounts.map((a) => (a * 100n) / total);
  const remainders = amounts.map((a, i) => ({ i, r: (a * 100n) % total }));
  let left = 100n - floors.reduce((s, f) => s + f, 0n);
  remainders.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of remainders) {
    if (left <= 0n) break;
    floors[i] += 1n;
    left -= 1n;
  }
  return floors.map(Number);
}
