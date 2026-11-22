/** Escape LIKE wildcards so "100%" searches for a literal percent sign. */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** A PostgREST filter value in double quotes (backslash and quote escaped). */
export function quotedFilter(value: string) {
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/** Escape LIKE wildcards, then quote for a PostgREST `or` filter. */
export function quotedLike(q: string) {
  return quotedFilter(likePattern(q));
}
