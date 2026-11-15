# UI states audit (empty, loading, error)

Every list and data view, checked on 2026-11-15. "Boundary" = the nearest error boundary renders a retryable error UI; queries throw on database errors, so a failed load always lands in one.

## Error boundaries

| Where | File | Covers |
|---|---|---|
| Signed-in pages | `src/app/(app)/error.tsx` | Any failure inside the app shell; navigation stays usable |
| Each dashboard widget | `SectionErrorBoundary` (`src/components/section-error-boundary.tsx`, built with `catchError` from `next/error`) | One failing widget shows "X couldn't load" + retry; the others keep working |
| Auth pages | `src/app/error.tsx` | Login, sign-up, password reset |
| Root layout | `src/app/global-error.tsx` | The root layout itself failing (e.g. settings can't load); renders its own `<html>` |
| Not found (signed in) | `src/app/(app)/not-found.tsx` | `notFound()` from any app page, shown inside the shell |
| Not found (anything else) | `src/app/not-found.tsx` | Unknown URLs |

Error UIs never show raw error messages (they can contain internals); details go to the console/server log.

## Lists and views

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Today: greeting | `GreetingSkeleton` | — | (app) boundary |
| Today: Today's classes | widget skeleton | "No classes today. See the week" | widget boundary |
| Today: Due soon | widget skeleton | "Nothing due in the next few days." | widget boundary |
| Today: Overdue | widget skeleton | "Nothing overdue. You're all caught up." | widget boundary |
| Today: Grades | widget skeleton | "Record assessment scores to see your grades." | widget boundary |
| Today: all widgets hidden | — | "All widgets are hidden" + Customize | — |
| Courses list | `ListSkeleton` | "No courses yet" + Add; "All your courses are archived." | (app) boundary |
| Timetable | skeleton | "Your timetable is empty" + link; "No classes this week."; per-day "No classes." | (app) boundary |
| Course detail: class times | `ListSkeleton` | "No class times yet" + Add | boundary; not found |
| Tasks list | `ListSkeleton` | "No open tasks" (first use) / "Nothing here" + reset (filters) | (app) boundary |
| Task detail: steps | `ListSkeleton` | no list, just "Add a step…" | boundary; not found; inline action errors |
| Grades overview | `ListSkeleton` | "No courses yet" + Add a course; per course "No assessments"; GPA "–" with "No graded courses yet" | (app) boundary |
| Course grades: assessments | `ListSkeleton` | "No assessments yet" + Add | boundary; not found |
| Settings | skeleton | — | boundary; inline save errors |
| Every form | `FormSkeleton` | — | field errors + form error, typed values kept |
| One-click actions (archive, delete, complete, toggle) | button disabled while pending | — | inline error under the button (`ActionForm`) |

## Gaps closed in this pass

- Dashboard widgets used to share the page's error boundary (one failure blanked the dashboard); each now has its own.
- Added `src/app/error.tsx` (auth pages had no boundary) and `global-error.tsx` (root layout failures).
- `notFound()` in signed-in pages now renders inside the app shell instead of the bare root page.
