/** Lowercase, trimmed, single-spaced: how payees are compared. */
export function normalisePayee(payee: string): string {
  return payee.trim().toLowerCase().replace(/\s+/g, " ");
}

export type CategoryHistory = { payee: string | null; categoryId: string | null; occurredOn: string };

/**
 * The category this payee is usually filed under: the most frequent one in the
 * history for the same (normalised) payee; a tie goes to the one used most
 * recently. Null without matching history.
 */
export function suggestCategory(payee: string, history: readonly CategoryHistory[]): string | null {
  const key = normalisePayee(payee);
  if (!key) return null;
  const stats = new Map<string, { count: number; last: string }>();
  for (const h of history) {
    if (!h.categoryId || !h.payee || normalisePayee(h.payee) !== key) continue;
    const s = stats.get(h.categoryId) ?? { count: 0, last: "" };
    s.count += 1;
    if (h.occurredOn > s.last) s.last = h.occurredOn;
    stats.set(h.categoryId, s);
  }
  let best: string | null = null;
  let bestStats = { count: 0, last: "" };
  for (const [id, s] of stats) {
    if (s.count > bestStats.count || (s.count === bestStats.count && s.last > bestStats.last)) {
      best = id;
      bestStats = s;
    }
  }
  return best;
}
