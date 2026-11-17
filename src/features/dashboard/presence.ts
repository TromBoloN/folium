import type { WidgetId } from "./widget-ids";

/**
 * What the dashboard has to show. A widget appears as soon as it has one thing
 * to show (no thresholds) and stays away while it has none, so Today never
 * fills up with zeros and "nothing yet" cards. Decided before the grid
 * renders, so cards don't pop in or vanish as their data arrives.
 */
export type DashboardFacts = {
  courses: number;
  tasks: number;
  /** Any transaction in Money. */
  money: boolean;
  /** Listed classes today (cancelled ones included: they're news) or live ones tomorrow. */
  classesTodayOrTomorrow: number;
  /** Live classes or deadlines in this week. */
  weekItems: number;
  /** Open tasks with a deadline still ahead. */
  deadlinesAhead: number;
  dueToday: number;
  dueSoon: number;
  overdue: number;
  /** Courses with a grade so far. */
  graded: number;
};

/** Nothing anywhere: one welcome prompt instead of a grid of empty cards. */
export function isBlank(f: DashboardFacts): boolean {
  return f.courses === 0 && f.tasks === 0 && !f.money;
}

export function widgetHasData(id: WidgetId, f: DashboardFacts): boolean {
  switch (id) {
    case "next-up":
      return f.classesTodayOrTomorrow > 0 || f.deadlinesAhead > 0;
    case "stats":
      return f.dueToday > 0 || f.overdue > 0 || f.graded > 0;
    case "classes":
      return f.classesTodayOrTomorrow > 0;
    case "week":
      return f.weekItems > 0;
    case "due-soon":
      return f.dueSoon > 0;
    case "overdue":
      return f.overdue > 0;
    case "grades":
      return f.graded > 0;
    case "money":
      return f.money;
    case "quick-add":
      // A tool, not a stat: there as soon as there's anything to add tasks to.
      return f.courses > 0 || f.tasks > 0;
  }
}

/** The user's visible widgets, in their order, that have something to show. */
export function widgetsToShow(ids: readonly WidgetId[], f: DashboardFacts): WidgetId[] {
  return isBlank(f) ? [] : ids.filter((id) => widgetHasData(id, f));
}
