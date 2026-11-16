import { describe, expect, it } from "vitest";
import { normalisePayee, suggestCategory } from "./suggest-category";

const h = (payee: string | null, categoryId: string | null, occurredOn: string) => ({ payee, categoryId, occurredOn });

describe("suggestCategory", () => {
  it("returns null without history or without a matching payee", () => {
    expect(suggestCategory("gofood", [])).toBeNull();
    expect(suggestCategory("gofood", [h("indomaret", "shopping", "2026-11-01")])).toBeNull();
    expect(suggestCategory("   ", [h("", "food", "2026-11-01")])).toBeNull();
  });

  it("matches payees case-insensitively, trimmed and single-spaced", () => {
    expect(normalisePayee("  Go   Food ")).toBe("go food");
    expect(suggestCategory("GO  food", [h(" go food", "food", "2026-11-01")])).toBe("food");
  });

  it("the most frequent category wins", () => {
    const history = [
      h("gofood", "food", "2026-11-01"),
      h("gofood", "food", "2026-11-02"),
      h("gofood", "entertainment", "2026-11-10"),
    ];
    expect(suggestCategory("gofood", history)).toBe("food");
  });

  it("a tie goes to the most recently used", () => {
    const history = [
      h("grab", "transport", "2026-11-01"),
      h("grab", "food", "2026-11-09"),
      h("grab", "transport", "2026-11-03"),
      h("grab", "food", "2026-10-01"),
    ];
    expect(suggestCategory("grab", history)).toBe("food");
  });

  it("ignores rows without a category or payee", () => {
    const history = [h("gofood", null, "2026-11-10"), h(null, "food", "2026-11-10"), h("gofood", "food", "2026-11-01")];
    expect(suggestCategory("gofood", history)).toBe("food");
  });
});
