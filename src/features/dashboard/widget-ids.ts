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
  "money",
  "quick-add",
] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

/**
 * Off by default on new or reset layouts so Today stays calm (Next up, Today's
 * classes and Due soon are on; the rest stay one checkbox away in Customize).
 */
export const DEFAULT_HIDDEN_WIDGETS: readonly WidgetId[] = ["stats", "week", "overdue", "grades", "money", "quick-add"];

/**
 * Off by default on new or reset layouts so Today stays calm (Next up, Today's
 * classes and Due soon are on; the rest stay one checkbox away in Customize).
 */
export const DEFAULT_HIDDEN_WIDGETS: readonly WidgetId[] = [
  "stats",
  "week",
  "overdue",
  "grades",
  "money",
  "quick-add",
];

/**
 * Fixed size hint per widget, which decides its footprint in the bento grid
 * (not user-resizable). In the 12-column layout: hero and wide take 8 columns,
 * small takes 4, tall takes 4 columns and two rows.
 */
export type WidgetSize = "hero" | "wide" | "tall" | "small";
