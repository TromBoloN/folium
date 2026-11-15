import { describe, expect, it } from "vitest";
import { assessmentInputSchema } from "./schema";

const base = {
  courseId: "4f9b2c1e-8d3a-4b6f-9e2d-1a2b3c4d5e6f",
  name: "Midterm",
  weight: "30",
  maxScore: "",
  score: "",
  dueDate: "",
};

describe("assessmentInputSchema", () => {
  it("parses form strings; blank max is 100, blank score is ungraded", () => {
    expect(assessmentInputSchema.parse(base)).toEqual({
      courseId: base.courseId,
      name: "Midterm",
      weight: 30,
      maxScore: 100,
      score: null,
      dueDate: null,
    });
  });

  it("accepts a score up to the maximum", () => {
    expect(assessmentInputSchema.parse({ ...base, maxScore: "50", score: "50" }).score).toBe(50);
  });

  it("rejects a score above the maximum, on the score field", () => {
    const r = assessmentInputSchema.safeParse({ ...base, maxScore: "50", score: "51" });
    expect(r.error?.issues[0].path).toEqual(["score"]);
  });

  it.each([
    ["weight 0", { weight: "0" }],
    ["weight above 100", { weight: "101" }],
    ["weight not a number", { weight: "abc" }],
    ["three decimals", { weight: "10.125" }],
    ["max score 0", { maxScore: "0" }],
    ["negative score", { score: "-1" }],
    ["bad date", { dueDate: "2026-02-30" }],
    ["blank name", { name: "  " }],
    ["missing course", { courseId: "nope" }],
  ])("rejects %s", (_name, patch) => {
    expect(assessmentInputSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});
