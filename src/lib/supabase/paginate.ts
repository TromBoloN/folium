export const PAGE_SIZE = 1000;

/**
 * Fetch every page from a PostgREST query (which caps single reads at 1,000 rows).
 * Callers must apply a deterministic `.order(...)` so pages never skip or repeat rows.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  errorPrefix: string,
  max = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; out.length < max; from += PAGE_SIZE) {
    const size = Math.min(PAGE_SIZE, max - out.length);
    const { data, error } = await fetchPage(from, from + size - 1);
    if (error) throw new Error(`${errorPrefix}: ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < size) break;
  }
  return out;
}
