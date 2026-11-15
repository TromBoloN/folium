import { describe, expect, it } from "vitest";
import { layoutOverrides, moveItem, resolveLayout, visibleWidgets } from "./layout";

const KNOWN = ["classes", "overdue", "due-soon", "quick-add"];

describe("resolveLayout", () => {
  it("uses the registry order when nothing is stored", () => {
    for (const stored of [null, undefined, {}, "junk", 42, []]) {
      expect(resolveLayout(stored, KNOWN)).toEqual({ order: KNOWN, hidden: [] });
    }
  });

  it("applies a stored order", () => {
    const order = ["quick-add", "classes", "overdue", "due-soon"];
    expect(resolveLayout({ order }, KNOWN).order).toEqual(order);
  });

  it("ignores ids that no longer exist, in order and hidden", () => {
    const layout = resolveLayout(
      { order: ["old-widget", "overdue", "classes"], hidden: ["old-widget", "quick-add"] },
      KNOWN,
    );
    expect(layout.order).not.toContain("old-widget");
    expect(layout.hidden).toEqual(["quick-add"]);
  });

  it("keeps the first position of duplicate ids", () => {
    const layout = resolveLayout({ order: ["overdue", "classes", "overdue"], hidden: ["classes", "classes"] }, KNOWN);
    expect(layout.order).toEqual(["overdue", "classes", "due-soon", "quick-add"]);
    expect(layout.hidden).toEqual(["classes"]);
  });

  it("appends widgets added after the layout was saved", () => {
    const savedBeforeQuickAdd = { order: ["due-soon", "classes", "overdue"] };
    expect(resolveLayout(savedBeforeQuickAdd, KNOWN).order).toEqual(["due-soon", "classes", "overdue", "quick-add"]);
  });

  it("ignores non-string entries and wrong types", () => {
    expect(resolveLayout({ order: [1, null, "overdue"], hidden: "classes" }, KNOWN)).toEqual({
      order: ["overdue", "classes", "due-soon", "quick-add"],
      hidden: [],
    });
  });
});

describe("layoutOverrides", () => {
  it("stores nothing but the version for the default layout", () => {
    expect(layoutOverrides({ order: KNOWN, hidden: [] }, KNOWN)).toEqual({ version: 1 });
  });

  it("stores only what changed", () => {
    expect(layoutOverrides({ order: KNOWN, hidden: ["overdue"] }, KNOWN)).toEqual({ version: 1, hidden: ["overdue"] });
    const order = ["quick-add", ...KNOWN.slice(0, 3)];
    expect(layoutOverrides({ order, hidden: [] }, KNOWN)).toEqual({ version: 1, order });
  });

  it("cleans what it stores and round-trips", () => {
    const stored = layoutOverrides({ order: ["nope", "overdue"], hidden: ["nope"] }, KNOWN);
    expect(stored).toEqual({ version: 1, order: ["overdue", "classes", "due-soon", "quick-add"] });
    expect(resolveLayout(stored, KNOWN).order).toEqual(stored.order);
  });
});

describe("moveItem", () => {
  it("moves up and down by one", () => {
    expect(moveItem(KNOWN, "overdue", "up")).toEqual(["overdue", "classes", "due-soon", "quick-add"]);
    expect(moveItem(KNOWN, "overdue", "down")).toEqual(["classes", "due-soon", "overdue", "quick-add"]);
  });

  it("does nothing at the ends or for unknown ids", () => {
    expect(moveItem(KNOWN, "classes", "up")).toEqual(KNOWN);
    expect(moveItem(KNOWN, "quick-add", "down")).toEqual(KNOWN);
    expect(moveItem(KNOWN, "nope", "up")).toEqual(KNOWN);
  });
});

describe("visibleWidgets", () => {
  it("drops hidden widgets and keeps order", () => {
    expect(visibleWidgets({ order: ["quick-add", "classes", "overdue"], hidden: ["classes"] })).toEqual([
      "quick-add",
      "overdue",
    ]);
  });
});
