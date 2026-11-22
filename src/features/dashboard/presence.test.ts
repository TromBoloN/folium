import { describe, expect, it } from "vitest";
import { type DashboardFacts, isBlank, widgetsToShow } from "./presence";
import { WIDGET_IDS } from "./widget-ids";

const none: DashboardFacts = {
  courses: 0,
  tasks: 0,
  money: false,
  classesTodayOrTomorrow: 0,
  weekItems: 0,
  deadlinesAhead: 0,
  dueToday: 0,
  dueSoon: 0,
  overdue: 0,
  graded: 0,
};

describe("dashboard presence", () => {
  it("shows nothing (one welcome prompt) when there's nothing at all", () => {
    expect(isBlank(none)).toBe(true);
    expect(widgetsToShow(WIDGET_IDS, none)).toEqual([]);
  });

  it("a course with no data yet shows only quick add, no empty stats", () => {
    expect(widgetsToShow(WIDGET_IDS, { ...none, courses: 1 })).toEqual(["quick-add"]);
  });

  it("a widget appears with its first data point", () => {
    const shown = widgetsToShow(WIDGET_IDS, { ...none, courses: 1, overdue: 1 });
    expect(shown).toEqual(["stats", "due-soon", "overdue", "quick-add"]);
    expect(widgetsToShow(WIDGET_IDS, { ...none, money: true })).toEqual(["money"]);
  });

  it("keeps the user's order and hidden widgets", () => {
    const full = { ...none, courses: 2, classesTodayOrTomorrow: 1, weekItems: 1, graded: 1 };
    expect(widgetsToShow(["grades", "classes"], full)).toEqual(["grades", "classes"]);
  });
});
