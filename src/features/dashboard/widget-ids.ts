/**
 * Widget ids and their default order. Kept apart from the registry (which
 * imports server components) so the layout logic and actions can use it.
 * Adding a widget: add its id here and its entry in registry.tsx. Users who
 * saved a layout before a widget existed get it appended (see layout.ts).
 */
export const WIDGET_IDS = [
  "next-up",
  "stats",
  "classes",
  "week",
  "due-soon",
  "overdue",
  "grades",
  "quick-add",
] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

/**
 * Fixed size hint per widget, which decides its footprint in the bento grid
 * (not user-resizable). In the 12-column layout: hero and wide take 8 columns,
 * small takes 4, tall takes 4 columns and two rows.
 */
export type WidgetSize = "hero" | "wide" | "tall" | "small";
