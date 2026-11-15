import { describe, expect, it } from "vitest";
import { quickAddSchema, taskFiltersSchema, taskInputSchema } from "./schema";

const base = {
  title: "Problem set 3",
  notes: "",
  courseId: "",
  dueDate: "",
  dueTime: "",
  priority: "medium",
  status: "todo",
};

describe("taskInputSchema", () => {
  it("turns blank optional fields into null", () => {
    expect(taskInputSchema.parse(base)).toEqual({
      title: "Problem set 3",
      notes: null,
      courseId: null,
      dueDate: null,
      dueTime: null,
      priority: "medium",
      status: "todo",
    });
  });

  it("accepts a date with or without a time", () => {
    expect(taskInputSchema.parse({ ...base, dueDate: "2026-11-20" }).dueTime).toBeNull();
    expect(taskInputSchema.parse({ ...base, dueDate: "2026-11-20", dueTime: "14:30" }).dueTime).toBe("14:30");
  });

  it("rejects a time without a date, on the date field", () => {
    expect(taskInputSchema.safeParse({ ...base, dueTime: "14:30" }).error?.issues[0].path).toEqual(["dueDate"]);
  });

  it("rejects impossible dates, unknown priorities and statuses", () => {
    expect(taskInputSchema.safeParse({ ...base, dueDate: "2026-02-30" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, priority: "critical" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, status: "blocked" }).success).toBe(false);
  });

  it("requires a title", () => {
    expect(taskInputSchema.safeParse({ ...base, title: "   " }).error?.issues[0].path).toEqual(["title"]);
  });
});

describe("quickAddSchema", () => {
  it("needs only a title", () => {
    expect(quickAddSchema.parse({ title: " Read chapter 4 " })).toEqual({ title: "Read chapter 4", courseId: null });
  });
});

describe("taskFiltersSchema", () => {
  it("defaults to open tasks due any time", () => {
    expect(taskFiltersSchema.parse({})).toEqual({ status: "open", due: "any", course: undefined });
  });

  it("ignores junk in the URL instead of failing", () => {
    expect(taskFiltersSchema.parse({ status: "nope", due: ["today", "week"], course: "x" })).toEqual({
      status: "open",
      due: "any",
      course: undefined,
    });
  });
});
