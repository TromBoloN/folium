import { describe, expect, it } from "vitest";
import { courseGrade, courseResult, gpaBySemester, neededOnRemaining, percentOf, weightedGpa } from "./logic";
import { bandFor, DEFAULT_GRADE_SCALE, gradeScaleSchema, parseGradeScaleField } from "./scale";

const a = (weight: number, score: number | null, maxScore = 100) => ({ weight, score, maxScore });

describe("percentOf", () => {
  it("scales by the maximum score", () => {
    expect(percentOf({ score: 45, maxScore: 50 })).toBe(90);
    expect(percentOf({ score: 0, maxScore: 20 })).toBe(0);
  });

  it("is null when ungraded", () => {
    expect(percentOf({ score: null, maxScore: 100 })).toBeNull();
  });
});

describe("courseGrade", () => {
  it("has no grade without graded work", () => {
    expect(courseGrade([])).toEqual({ percent: null, gradedWeight: 0, totalWeight: 0, earned: 0, complete: false });
    expect(courseGrade([a(30, null), a(70, null)]).percent).toBeNull();
  });

  it("is the weighted average of graded work", () => {
    // 0.2·90 + 0.3·70 + 0.5·80 = 18 + 21 + 40 = 79
    const g = courseGrade([a(20, 90), a(30, 70), a(50, 80)]);
    expect(g.percent).toBeCloseTo(79);
    expect(g.complete).toBe(true);
    expect(g.earned).toBeCloseTo(79);
  });

  it("only counts graded weight for the current grade", () => {
    // Graded: 20% at 90, 30% at 70 → (1800 + 2100) / 50 = 78
    const g = courseGrade([a(20, 90), a(30, 70), a(50, null)]);
    expect(g.percent).toBeCloseTo(78);
    expect(g.gradedWeight).toBe(50);
    expect(g.totalWeight).toBe(100);
    expect(g.earned).toBeCloseTo(39); // (1800 + 2100) / 100
    expect(g.complete).toBe(false);
  });

  it("uses each assessment's own maximum", () => {
    // 45/50 = 90%, 7/10 = 70%, equal weights
    expect(courseGrade([a(50, 45, 50), a(50, 7, 10)]).percent).toBeCloseTo(80);
  });

  it("normalises weights that don't add up to 100", () => {
    // Weights 10 + 30 = 40; (10·100 + 30·60) / 40 = 70
    const g = courseGrade([a(10, 100), a(30, 60)]);
    expect(g.percent).toBeCloseTo(70);
    expect(g.earned).toBeCloseTo(70);
    expect(g.totalWeight).toBe(40);
  });

  it("treats a zero score as graded, not missing", () => {
    expect(courseGrade([a(50, 0), a(50, 100)]).percent).toBeCloseTo(50);
  });
});

describe("bandFor (default Indonesian 4.0 scale)", () => {
  it.each([
    [100, "A", 4],
    [85, "A", 4],
    [84.99, "A-", 3.75],
    [80, "A-", 3.75],
    [75, "B+", 3.5],
    [70, "B", 3],
    [65, "B-", 2.75],
    [60, "C+", 2.5],
    [55, "C", 2],
    [54.9, "D", 1],
    [40, "D", 1],
    [39.9, "E", 0],
    [0, "E", 0],
  ])("%s%% → %s (%s)", (percent, letter, points) => {
    expect(bandFor(percent, DEFAULT_GRADE_SCALE)).toMatchObject({ letter, points });
  });

  it("absorbs float noise at a boundary", () => {
    expect(bandFor(84.99999999999, DEFAULT_GRADE_SCALE).letter).toBe("A");
  });

  it("works with an unsorted custom scale", () => {
    const scale = [
      { letter: "F", min: 0, points: 0 },
      { letter: "P", min: 50, points: 1 },
    ];
    expect(bandFor(60, scale).letter).toBe("P");
    expect(bandFor(10, scale).letter).toBe("F");
  });
});

describe("courseResult", () => {
  it("attaches the band for the current percentage", () => {
    expect(courseResult([a(100, 86)], DEFAULT_GRADE_SCALE).band?.letter).toBe("A");
    expect(courseResult([a(100, null)], DEFAULT_GRADE_SCALE).band).toBeNull();
  });
});

describe("weightedGpa", () => {
  it("weights grade points by credits", () => {
    // (3·4 + 2·3 + 4·2.5) / 9 = (12 + 6 + 10) / 9 = 3.111…
    const { gpa, credits } = weightedGpa([
      { credits: 3, points: 4 },
      { credits: 2, points: 3 },
      { credits: 4, points: 2.5 },
    ]);
    expect(gpa).toBeCloseTo(3.1111, 4);
    expect(credits).toBe(9);
  });

  it("leaves out ungraded and zero-credit courses instead of counting them as 0", () => {
    const result = weightedGpa([
      { credits: 3, points: 4 },
      { credits: 3, points: null },
      { credits: 0, points: 0 },
    ]);
    expect(result).toEqual({ gpa: 4, credits: 3 });
  });

  it("is null when nothing counts", () => {
    expect(weightedGpa([])).toEqual({ gpa: null, credits: 0 });
    expect(weightedGpa([{ credits: 2, points: null }])).toEqual({ gpa: null, credits: 0 });
  });

  it("handles fractional credits", () => {
    expect(
      weightedGpa([
        { credits: 1.5, points: 4 },
        { credits: 0.5, points: 0 },
      ]).gpa,
    ).toBeCloseTo(3);
  });
});

describe("neededOnRemaining", () => {
  it("needs assessments to say anything", () => {
    expect(neededOnRemaining([], 85)).toEqual({ kind: "no-assessments" });
  });

  it("computes the average needed on what's left", () => {
    // Graded 40% at 70 → 2800. Target 80 over 100 → 8000. Need (8000 - 2800) / 60 = 86.67
    const r = neededOnRemaining([a(40, 70), a(60, null)], 80);
    expect(r.kind).toBe("needed");
    expect(r.kind === "needed" && r.percent).toBeCloseTo(86.667, 2);
  });

  it("needs the target itself when nothing is graded yet", () => {
    const r = neededOnRemaining([a(30, null), a(70, null)], 75);
    expect(r.kind === "needed" && r.percent).toBeCloseTo(75);
  });

  it("says secured when even zeros reach the target", () => {
    // Graded 90% of the weight at 100 → already 90 of 100.
    expect(neededOnRemaining([a(90, 100), a(10, null)], 85)).toEqual({ kind: "secured" });
  });

  it("says out of reach when more than 100% would be needed", () => {
    // Graded 50% at 40 → 2000. Target 85 → 8500. Need 6500 / 50 = 130.
    const r = neededOnRemaining([a(50, 40), a(50, null)], 85);
    expect(r.kind).toBe("out-of-reach");
    expect(r.kind === "out-of-reach" && r.percent).toBeCloseTo(130);
  });

  it("treats exactly 100% needed as still possible", () => {
    // Graded 50% at 70 → 3500; target 85 → 8500; need 5000/50 = 100.
    const r = neededOnRemaining([a(50, 70), a(50, null)], 85);
    expect(r).toEqual({ kind: "needed", percent: 100 });
  });

  it("reports the final result once everything is graded", () => {
    expect(neededOnRemaining([a(50, 80), a(50, 90)], 85)).toEqual({ kind: "final", reached: true, percent: 85 });
    expect(neededOnRemaining([a(50, 80), a(50, 89)], 85)).toMatchObject({ kind: "final", reached: false });
  });

  it("normalises when weights don't sum to 100", () => {
    // Weights 20 + 20: graded 20 at 50 → 1000; target 70 over 40 → 2800; need 1800/20 = 90
    const r = neededOnRemaining([a(20, 50), a(20, null)], 70);
    expect(r.kind === "needed" && r.percent).toBeCloseTo(90);
  });

  it("respects different maximum scores on graded work", () => {
    // 18/20 = 90% at weight 50 → 4500; target 80 → 8000; need 3500/50 = 70
    const r = neededOnRemaining([a(50, 18, 20), a(50, null, 40)], 80);
    expect(r.kind === "needed" && r.percent).toBeCloseTo(70);
  });
});

describe("gradeScaleSchema", () => {
  it("accepts the default scale", () => {
    expect(gradeScaleSchema.safeParse(DEFAULT_GRADE_SCALE).success).toBe(true);
  });

  it("sorts bands highest first", () => {
    const parsed = gradeScaleSchema.parse([
      { letter: "F", min: 0, points: 0 },
      { letter: "P", min: 50, points: 1 },
    ]);
    expect(parsed.map((b) => b.letter)).toEqual(["P", "F"]);
  });

  it.each([
    [
      "no band at 0%",
      [
        { letter: "A", min: 80, points: 4 },
        { letter: "B", min: 50, points: 3 },
      ],
    ],
    [
      "duplicate minimums",
      [
        { letter: "A", min: 50, points: 4 },
        { letter: "B", min: 50, points: 3 },
        { letter: "E", min: 0, points: 0 },
      ],
    ],
    [
      "duplicate letters",
      [
        { letter: "A", min: 50, points: 4 },
        { letter: "a", min: 0, points: 0 },
      ],
    ],
    [
      "points rising for lower bands",
      [
        { letter: "A", min: 50, points: 2 },
        { letter: "E", min: 0, points: 3 },
      ],
    ],
    ["a single band", [{ letter: "A", min: 0, points: 4 }]],
    [
      "out-of-range minimum",
      [
        { letter: "A", min: 120, points: 4 },
        { letter: "E", min: 0, points: 0 },
      ],
    ],
    [
      "negative points",
      [
        { letter: "A", min: 50, points: 4 },
        { letter: "E", min: 0, points: -1 },
      ],
    ],
    [
      "empty letter",
      [
        { letter: " ", min: 50, points: 4 },
        { letter: "E", min: 0, points: 0 },
      ],
    ],
  ])("rejects %s", (_name, scale) => {
    expect(gradeScaleSchema.safeParse(scale).success).toBe(false);
  });
});

describe("gpaBySemester", () => {
  const c = (semester: string | null, credits: number, points: number | null, archived = false) => ({
    semester,
    credits,
    points,
    archived,
  });

  it("computes a GPA per semester and overall", () => {
    const { semesters, overall } = gpaBySemester([
      c("2026 Ganjil", 3, 4),
      c("2026 Ganjil", 3, 3),
      c("2025 Genap", 2, 2, true),
    ]);
    expect(semesters.map((s) => [s.label, s.gpa, s.credits, s.courseCount])).toEqual([
      ["2026 Ganjil", 3.5, 6, 2],
      ["2025 Genap", 2, 2, 1],
    ]);
    // (12 + 9 + 4) / 8
    expect(overall.gpa).toBeCloseTo(3.125);
    expect(overall.credits).toBe(8);
  });

  it("puts the semester with active courses first, unlabeled courses last", () => {
    const { semesters } = gpaBySemester([
      c(null, 2, 4),
      c("2027 Genap", 3, 3, true),
      c("2026 Ganjil", 3, 4),
      c("2025 Genap", 3, 4, true),
    ]);
    expect(semesters.map((s) => s.label)).toEqual(["2026 Ganjil", "2027 Genap", "2025 Genap", null]);
  });

  it("keeps semesters with no graded work, with a null GPA", () => {
    const { semesters, overall } = gpaBySemester([c("2026 Ganjil", 3, null)]);
    expect(semesters[0]).toEqual({ label: "2026 Ganjil", gpa: null, credits: 0, courseCount: 1 });
    expect(overall.gpa).toBeNull();
  });
});

describe("parseGradeScaleField", () => {
  it("turns the editor's string rows into numbers", () => {
    expect(parseGradeScaleField(JSON.stringify([{ letter: "A", min: "85", points: "4" }]))).toEqual([
      { letter: "A", min: 85, points: 4 },
    ]);
  });

  it("makes blank numbers NaN so validation rejects them", () => {
    const parsed = parseGradeScaleField(JSON.stringify([{ letter: "A", min: "", points: "4" }]));
    expect(gradeScaleSchema.safeParse(parsed).success).toBe(false);
  });

  it("returns undefined for junk", () => {
    expect(parseGradeScaleField("not json")).toBeUndefined();
    expect(parseGradeScaleField(JSON.stringify({ a: 1 }))).toBeUndefined();
    expect(parseGradeScaleField(null)).toBeUndefined();
  });
});
