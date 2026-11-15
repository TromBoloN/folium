import { bandFor, type GradeBand } from "./scale";

/**
 * Grade maths. Pure functions; every rule here is unit tested in logic.test.ts.
 *
 * Model:
 * - An assessment's percentage is score / maxScore × 100.
 * - Weights are percentages of the course grade. They are normalised by the
 *   total weight entered, so a course whose weights don't add up to 100 (e.g.
 *   the final exam isn't entered yet) still gets a sensible grade. The UI warns
 *   when the total isn't 100.
 * - The current grade only counts graded work: Σ(weight × %) / Σ(graded weight).
 * - GPA is the credit-weighted mean of course grade points, over courses that
 *   have credits and at least one graded assessment.
 */

export type Assessment = { weight: number; maxScore: number; score: number | null };

export function percentOf(a: Pick<Assessment, "maxScore" | "score">): number | null {
  if (a.score === null || a.maxScore <= 0) return null;
  return (a.score / a.maxScore) * 100;
}

export type CourseGrade = {
  /** Weighted average of graded work, 0–100; null if nothing is graded. */
  percent: number | null;
  /** Sum of the weights of graded assessments. */
  gradedWeight: number;
  /** Sum of all weights entered. */
  totalWeight: number;
  /** Graded work's contribution to the final grade, in points of 100 (weights normalised). */
  earned: number;
  /** True when every assessment has a score. */
  complete: boolean;
};

export function courseGrade(assessments: readonly Assessment[]): CourseGrade {
  let gradedWeight = 0;
  let totalWeight = 0;
  let weighted = 0;
  for (const a of assessments) {
    totalWeight += a.weight;
    const pct = percentOf(a);
    if (pct === null) continue;
    gradedWeight += a.weight;
    weighted += a.weight * pct;
  }
  return {
    percent: gradedWeight > 0 ? weighted / gradedWeight : null,
    gradedWeight,
    totalWeight,
    earned: totalWeight > 0 ? weighted / totalWeight : 0,
    complete: assessments.length > 0 && gradedWeight === totalWeight,
  };
}

export type CourseResult = CourseGrade & { band: GradeBand | null };

export function courseResult(assessments: readonly Assessment[], scale: readonly GradeBand[]): CourseResult {
  const grade = courseGrade(assessments);
  return { ...grade, band: grade.percent === null ? null : bandFor(grade.percent, scale) };
}

export type GpaEntry = { credits: number; points: number | null };

/**
 * Credit-weighted GPA. Courses without credits or without a grade yet are left
 * out (they don't count as zero). Returns null when nothing counts.
 */
export function weightedGpa(entries: readonly GpaEntry[]): { gpa: number | null; credits: number } {
  let credits = 0;
  let total = 0;
  for (const e of entries) {
    if (e.points === null || e.credits <= 0) continue;
    credits += e.credits;
    total += e.credits * e.points;
  }
  return { gpa: credits > 0 ? total / credits : null, credits };
}

export type Needed =
  | { kind: "no-assessments" }
  /** Already guaranteed: even zero on everything left reaches the target. */
  | { kind: "secured" }
  /** Average percentage needed on the remaining (ungraded) work. */
  | { kind: "needed"; percent: number }
  /** Would need more than 100% on the remaining work. */
  | { kind: "out-of-reach"; percent: number }
  /** Everything is graded: the final grade either reached the target or didn't. */
  | { kind: "final"; reached: boolean; percent: number };

/**
 * What average score on the remaining assessments reaches `targetPercent`?
 * Solves (earnedWeighted + remainingWeight × x) / totalWeight ≥ target for x.
 */
export function neededOnRemaining(assessments: readonly Assessment[], targetPercent: number): Needed {
  const grade = courseGrade(assessments);
  if (grade.totalWeight <= 0) return { kind: "no-assessments" };
  const remainingWeight = grade.totalWeight - grade.gradedWeight;
  const weighted = grade.earned * grade.totalWeight;

  if (remainingWeight <= 0) {
    const percent = grade.percent ?? 0;
    return { kind: "final", reached: percent + 1e-9 >= targetPercent, percent };
  }
  const needed = (targetPercent * grade.totalWeight - weighted) / remainingWeight;
  if (needed <= 0) return { kind: "secured" };
  if (needed > 100 + 1e-9) return { kind: "out-of-reach", percent: needed };
  return { kind: "needed", percent: needed };
}

/** 84.999 → "85.0"; for display only. */
export function formatPercent(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function formatGpa(value: number): string {
  return value.toFixed(2);
}

export type GpaCourse = { semester: string | null; credits: number; points: number | null; archived: boolean };

export type SemesterGpa = { label: string | null; gpa: number | null; credits: number; courseCount: number };

/**
 * GPA per semester label plus overall. Semesters with an active course come
 * first (that's "this semester"), then the rest by label, newest-looking first;
 * courses without a semester label are grouped last.
 */
export function gpaBySemester(courses: readonly GpaCourse[]): {
  semesters: SemesterGpa[];
  overall: ReturnType<typeof weightedGpa>;
} {
  const groups = new Map<string | null, GpaCourse[]>();
  for (const c of courses) groups.set(c.semester, [...(groups.get(c.semester) ?? []), c]);

  const semesters = [...groups.entries()].map(([label, list]) => ({
    label,
    ...weightedGpa(list),
    courseCount: list.length,
    active: list.some((c) => !c.archived),
  }));
  semesters.sort((x, y) => {
    if (x.label === null || y.label === null) return x.label === null ? 1 : -1;
    if (x.active !== y.active) return x.active ? -1 : 1;
    return y.label.localeCompare(x.label);
  });

  return {
    semesters: semesters.map(({ active: _active, ...s }) => s),
    overall: weightedGpa(courses),
  };
}
