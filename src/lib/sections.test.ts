import { describe, expect, it } from "vitest";
import { activeTabHref, isMoneyManagePath, isUnder, MONEY_TABS, SCHOOL_PATHS, SCHOOL_TABS } from "./sections";

describe("isUnder", () => {
  it("matches the prefix, nested routes and trailing slashes", () => {
    expect(isUnder("/courses", "/courses")).toBe(true);
    expect(isUnder("/courses/", "/courses")).toBe(true);
    expect(isUnder("/courses/abc/edit", "/courses")).toBe(true);
  });
  it("doesn't match similar prefixes", () => {
    expect(isUnder("/courses-archive", "/courses")).toBe(false);
    expect(isUnder("/coursesx/1", "/courses")).toBe(false);
    expect(isUnder("/", "/courses")).toBe(false);
  });
});

describe("School", () => {
  const inSchool = (path: string) => SCHOOL_PATHS.some((p) => isUnder(path, p));
  it("covers Courses, Tasks and Grades with their nested routes", () => {
    for (const path of ["/courses", "/courses/123", "/tasks/new", "/grades/abc/assessments/new", "/tasks/"]) {
      expect(inSchool(path)).toBe(true);
    }
  });
  it("leaves out everything else", () => {
    for (const path of ["/", "/money", "/settings", "/courses-archive", "/task", "/gradesheet"]) {
      expect(inSchool(path)).toBe(false);
    }
  });
  it("picks the tab for nested routes", () => {
    expect(activeTabHref("/courses/123/slots/new", SCHOOL_TABS)).toBe("/courses");
    expect(activeTabHref("/tasks/9", SCHOOL_TABS)).toBe("/tasks");
    expect(activeTabHref("/money", SCHOOL_TABS)).toBeNull();
  });
});

describe("Money", () => {
  it("keeps Overview exact and the rest by prefix (most specific wins)", () => {
    expect(activeTabHref("/money", MONEY_TABS)).toBe("/money");
    expect(activeTabHref("/money/", MONEY_TABS)).toBe("/money");
    expect(activeTabHref("/money/recurring/new", MONEY_TABS)).toBe("/money/recurring");
    expect(activeTabHref("/money/accounts", MONEY_TABS)).toBeNull();
    expect(activeTabHref("/money/transactions-old", MONEY_TABS)).toBeNull();
  });
  it("knows the Manage pages", () => {
    expect(isMoneyManagePath("/money/categories/1")).toBe(true);
    expect(isMoneyManagePath("/money/imports")).toBe(false);
  });
});
