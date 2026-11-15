/**
 * Widget ids and their default order. Kept apart from the registry (which
 * imports server components) so the layout logic and actions can use it.
 * Adding a widget: add its id here and its entry in registry.tsx.
 */
export const WIDGET_IDS = ["classes", "due-soon", "overdue", "quick-add", "grades"] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];
