import type { TransactionFilters as Filters } from "../schemas";

const BASE = "/money/transactions";

/**
 * A /money/transactions URL from filters, leaving out empty ones (and the page
 * size: a new filter starts at the top). Plain module, not the client
 * component, so server pages can call it too.
 */
export function filtersHref(filters: Filters, change: Partial<Record<keyof Filters, string | undefined>> = {}) {
  const merged: Record<string, string | undefined> = { ...filters, ...change };
  const params = new URLSearchParams();
  for (const key of ["q", "account", "category", "kind", "month"] as const) {
    const v = merged[key];
    if (v) params.set(key, v);
  }
  const qs = params.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}
