import { describe, expect, it } from "vitest";
import { pageArea } from "./page-area";

describe("pageArea", () => {
  it("maps each section to its area", () => {
    expect(pageArea("/")).toBe("today");
    expect(pageArea("/courses")).toBe("courses");
    expect(pageArea("/courses/abc")).toBe("courses");
    expect(pageArea("/tasks")).toBe("tasks");
    expect(pageArea("/grades/x")).toBe("grades");
    expect(pageArea("/money/transactions")).toBe("money");
    expect(pageArea("/settings")).toBe("settings");
    expect(pageArea("/themes")).toBe("settings");
  });

  it("doesn't match look-alike prefixes", () => {
    expect(pageArea("/courses-archive")).toBe("other");
    expect(pageArea("/nowhere")).toBe("other");
  });
});
