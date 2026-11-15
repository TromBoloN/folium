/**
 * Dashboard layout stored in user_settings.dashboard_layout, following the
 * settings pattern: only the user's overrides are stored, and reading merges
 * them over the registry's defaults.
 *
 * Stored shape (every key optional): { version: 1, order: string[], hidden: string[] }
 *  - ids that no longer exist are ignored
 *  - duplicate ids keep their first position
 *  - widgets added to the registry later are appended, so existing users see them
 */
export const LAYOUT_VERSION = 1;

export type ResolvedLayout = { order: string[]; hidden: string[] };
export type StoredLayout = { version: number; order?: string[]; hidden?: string[] };

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Stored overrides (any shape, possibly junk) -> a complete, valid layout for these widget ids. */
export function resolveLayout(stored: unknown, knownIds: readonly string[]): ResolvedLayout {
  const raw = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const known = new Set(knownIds);
  const order: string[] = [];
  for (const id of stringList(raw.order)) {
    if (known.has(id) && !order.includes(id)) order.push(id);
  }
  for (const id of knownIds) {
    if (!order.includes(id)) order.push(id);
  }
  const hidden = [...new Set(stringList(raw.hidden).filter((id) => known.has(id)))];
  return { order, hidden };
}

/** What to store: only what differs from the default. A default layout stores as { version }. */
export function layoutOverrides(layout: ResolvedLayout, knownIds: readonly string[]): StoredLayout {
  const clean = resolveLayout(layout, knownIds);
  const stored: StoredLayout = { version: LAYOUT_VERSION };
  if (clean.order.some((id, i) => id !== knownIds[i])) stored.order = clean.order;
  if (clean.hidden.length > 0) stored.hidden = clean.hidden;
  return stored;
}

/** Move one id up or down by one place. Out-of-range moves return the list unchanged. */
export function moveItem(order: readonly string[], id: string, direction: "up" | "down"): string[] {
  const from = order.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The widgets to render, in order. */
export function visibleWidgets(layout: ResolvedLayout): string[] {
  return layout.order.filter((id) => !layout.hidden.includes(id));
}
