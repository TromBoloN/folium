# Grades

Code: `src/features/grades/`. Routes under `/grades`. Data: `courses.credits` and the `assessments` table (see [05-database.md](05-database.md)).

## Model

- A course has **credits** (SKS, 0–24, one decimal). 0 means "not counted in the GPA" (e.g. a study group).
- An **assessment** belongs to a course: name, **weight** (% of the course grade, >0–100), **max score** (default 100), **score** (empty = not graded yet; 0 ≤ score ≤ max, no extra credit), optional date (stored like a date-only deadline: end of that day in the user's zone).
- Weights of one course aren't forced to sum to 100 (the final exam may not be entered yet); the course page warns when they don't.

## Rules (`logic.ts`, tested in `logic.test.ts`)

| Function | Rule |
|---|---|
| `percentOf(a)` | `score / maxScore × 100`, null if ungraded |
| `courseGrade(list)` | **Grade so far** = Σ(weight × %) / Σ(graded weight). Also `gradedWeight`, `totalWeight`, `earned` (= Σ(weight × %) / total weight), `complete` |
| `courseResult(list, scale)` | `courseGrade` + the letter band for the percentage |
| `weightedGpa(entries)` | Σ(credits × points) / Σ(credits), over courses with credits > 0 **and** a grade. Ungraded courses are left out, not counted as 0 |
| `gpaBySemester(courses)` | GPA per `courses.semester` label + overall; the semester with active courses first, unlabeled last |
| `neededOnRemaining(list, target%)` | Solves (earned + remaining × x) / total ≥ target for x. Returns `secured` (x ≤ 0), `needed` (0–100), `out-of-reach` (> 100), `final` (nothing left), or `no-assessments` |

Because weights are normalised by the total entered, "what do I need" is relative to the assessments that exist. Add every assessment (even ungraded) for accurate answers.

## Grade scale (`scale.ts`)

A preference (`preferences.gradeScale`): bands of `{ letter, min %, points }`. Default: the Indonesian 4.0 scale (A ≥85 = 4.0, A- ≥80 = 3.75, B+ ≥75 = 3.5, B ≥70 = 3.0, B- ≥65 = 2.75, C+ ≥60 = 2.5, C ≥55 = 2.0, D ≥40 = 1.0, E ≥0 = 0). Validation (`gradeScaleSchema`): 2–15 bands, one starting at 0%, unique minimums and letters, points never rising for lower bands; stored highest band first. Edited in Settings (`GradeScaleEditor`, submitted as one JSON field). Like every setting, an invalid stored scale falls back to the default.

`bandFor(percent, scale)` picks the highest band whose minimum is reached (with a tiny tolerance for float noise).

## Pages

| Route | Shows |
|---|---|
| `/grades` | GPA this semester and overall, then each semester's courses with letter, %, points, credits and how much is graded |
| `/grades/[courseId]` | Grade so far, %, graded share, weight warning, "What do I need?" (GET form, `?target=<letter>`), assessments list |
| `/grades/[courseId]/assessments/new`, `/…/[assessmentId]/edit` | Assessment form |

Course pages link to their grades; the course form has the credits field. The dashboard has a **Grades** widget (this semester's GPA and the grade so far per active course), added only through `widget-ids.ts` + `registry.tsx`.
