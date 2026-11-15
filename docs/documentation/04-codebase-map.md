# Codebase map

Every source file, one line each. Tests sit next to the file they test (`*.test.ts`).

## Root

| File | Purpose |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | Instructions for coding agents (rules, commands). `next dev` appends a Next.js block to `AGENTS.md`; commit it. |
| `next.config.ts` | `cacheComponents`, `allowedDevOrigins` |
| `biome.json` | Lint/format config |
| `vitest.config.mts` | Unit test config |
| `playwright.config.ts` | E2E config (desktop + mobile projects) |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| `components.json` | shadcn/ui config |
| `.env.example` | The two public env vars |
| `.github/workflows/ci.yml` | CI: app job + database job |

## `src/app` (routes)

| File | Purpose |
|---|---|
| `layout.tsx` | Root layout: fonts, theme attributes on `<html>` from settings, `instant = false` |
| `globals.css` | Theme tokens, presets, fonts, density, `dark:` variant, `swatch` utility |
| `not-found.tsx` | 404 UI (outside the shell) |
| `error.tsx` | Error boundary for auth pages |
| `global-error.tsx` | Replaces the root layout when it fails |
| `(auth)/forgot-password/page.tsx` | Request a reset link |
| `(auth)/update-password/page.tsx` | Set a new password (signed in) |
| `(app)/not-found.tsx` | Not found inside the app shell |
| `(app)/grades/page.tsx` | GPA overview by semester |
| `(app)/grades/[courseId]/page.tsx` | Course grade, needed calculator, assessments |
| `(app)/grades/[courseId]/assessments/new/page.tsx`, `…/[assessmentId]/edit/page.tsx` | Assessment forms |
| `(auth)/layout.tsx` | Centered card for auth pages |
| `(auth)/login/page.tsx` | Login; reads `?next` and `?error` inside Suspense |
| `(auth)/signup/page.tsx` | Sign-up |
| `auth/confirm/route.ts` | Completes email confirmation, redirects to `next` or `/login?error=confirm_failed` |
| `(app)/layout.tsx` | Wraps pages in `AppShell` |
| `(app)/error.tsx` | Error boundary with retry |
| `(app)/page.tsx` | Today dashboard and `?edit=1` editor |
| `(app)/courses/page.tsx` | Course list + "Add course" |
| `(app)/courses/timetable/page.tsx` | Week view |
| `(app)/courses/new/page.tsx` | New course (suggests an unused colour) |
| `(app)/courses/[id]/page.tsx` | Course detail, actions, class times with overlap warnings |
| `(app)/courses/[id]/edit/page.tsx` | Edit course |
| `(app)/courses/[id]/slots/new/page.tsx` | New class time |
| `(app)/courses/[id]/slots/[slotId]/edit/page.tsx` | Edit class time |
| `(app)/tasks/page.tsx` | Task list: quick add, filters, grouped list |
| `(app)/tasks/new/page.tsx` | New task form |
| `(app)/tasks/[id]/page.tsx` | Task detail with steps |
| `(app)/tasks/[id]/edit/page.tsx` | Edit task (due shown in the user's zone) |
| `(app)/settings/page.tsx` | Settings form + account card |

## `src/features/auth`

| File | Purpose |
|---|---|
| `schemas.ts` | Sign-in/up and password schemas, `MIN_PASSWORD_LENGTH`, `EMAIL_OTP_TYPES`, `safeNextPath()` (blocks open redirects, incl. control characters) |
| `queries.ts` | `requireUser()` |
| `actions.ts` | `signIn`, `signUp`, `signOut`, `requestPasswordReset`, `updatePassword`; friendly errors; no account enumeration |
| `components/forgot-password-form.tsx`, `update-password-form.tsx` | Password reset forms |
| `components/login-form.tsx`, `signup-form.tsx` | Forms with `useActionState` |
| `components/sign-out-button.tsx` | Form-based sign out |
| `components/form-error.tsx` | Alert text |

## `src/features/settings`

| File | Purpose |
|---|---|
| `schema.ts` | Theme + preferences schemas, defaults, `mergeOverDefaults`, `diffFromDefaults`, `resolveSettings`, `SETTINGS_VERSION` |
| `theme.ts` | `themeAttributes()` (what goes on `<html>`), preset labels |
| `queries.ts` | `getSettings()` (cached; defaults when signed out or on error) |
| `actions.ts` | `updateSettings` (stores only overrides) |
| `components/settings-form.tsx` | Appearance + preferences form (time zone list passed from the server) |

## `src/features/courses`

| File | Purpose |
|---|---|
| `schema.ts` | Course schema, `COURSE_COLORS`, `nextCourseColor()`, `Course` type |
| `queries.ts` | `listCourses()`, `getCourse()`, `listActiveSlots()`, `listCourseOptions()` |
| `actions.ts` | `createCourse`, `updateCourse`, `setCourseArchived`, `deleteCourse` |
| `components/course-form.tsx` | Course form |
| `components/color-field.tsx` | Palette + custom colour picker |
| `components/course-list.tsx` | List with schedule summary and overlap warnings; archived section |
| `components/course-actions.tsx` | Tasks link, edit, archive, delete (confirm via `<details>`) |
| `components/course-tabs.tsx` | Courses / Timetable switcher |

## `src/features/timetable`

| File | Purpose |
|---|---|
| `logic.ts` | Pure: weekdays, time parsing/formatting, sorting, `appliesOn`, overlap detection (`findConflicts`), `weekDates`, `layoutDay` |
| `week.ts` | Pure: `buildWeek()` turns slots into a displayable week (per-date overlaps, grid hours, labels) |
| `format.ts` | Time ranges, date ranges, slot descriptions for warnings |
| `schema.ts` | Class time schema (end after start, range order) |
| `types.ts` | `TimetableSlot` (slot + its course) |
| `actions.ts` | `createSlot`, `updateSlot`, `deleteSlot` (overlaps allowed) |
| `components/week-view.tsx` | Week header/nav, picks agenda (mobile) or grid (desktop) |
| `components/day-agenda.tsx` | Mobile day tabs (client; arrow keys) |
| `components/week-grid.tsx` | Desktop time grid; overlapping blocks cascade |
| `components/slot-form.tsx` | Class time form |
| `components/slot-list.tsx` | Class times on the course page |
| `components/overlap-warning.tsx` | Warning icon/text |

## `src/features/tasks`

| File | Purpose |
|---|---|
| `due.ts` | Pure: `dueAtFrom`, `dueParts`, `dayBounds`, `dueState`, `dueWindowRange`, `formatDue`, `compareTasks`, `SOON_DAYS` |
| `schema.ts` | Task, quick-add, subtask and URL-filter schemas; status/priority lists and labels |
| `queries.ts` | `listTasks(filters, ctx)`, `getTask(id)`, `listOpenTasks()` (cached, for widgets) |
| `actions.ts` | `createTask`, `quickAddTask`, `updateTask`, `setTaskStatus`, `deleteTask`, `addSubtask`, `toggleSubtask`, `deleteSubtask` |
| `components/task-list.tsx` | Grouped (open) or flat list |
| `components/task-row.tsx` | One task: checkbox, title, course, due, priority, step progress |
| `components/task-checkbox.tsx` | Complete/reopen form button |
| `components/due-label.tsx` | Coloured due label |
| `components/quick-add.tsx` | Title-only add (respects course filter) |
| `components/task-filters.tsx` | Due chips, status and course selects (URL-driven) |
| `components/task-form.tsx` | Full task form |
| `components/subtask-list.tsx`, `add-subtask.tsx` | Steps checklist |
| `components/task-actions.tsx` | Done/reopen, edit, delete |

## `src/features/grades`

| File | Purpose |
|---|---|
| `logic.ts` | Pure: `percentOf`, `courseGrade`, `courseResult`, `weightedGpa`, `gpaBySemester`, `neededOnRemaining`, formatters |
| `scale.ts` | `GradeBand`, `DEFAULT_GRADE_SCALE` (Indonesian 4.0), `gradeScaleSchema`, `bandFor`, `parseGradeScaleField` |
| `schema.ts` | Assessment form schema |
| `queries.ts` | `listGradebook()`, `getCourseGradebook()` |
| `actions.ts` | `createAssessment`, `updateAssessment`, `deleteAssessment` |
| `components/assessment-form.tsx`, `assessment-list.tsx` | Assessment CRUD UI |
| `components/needed-calculator.tsx` | "What do I need?" (GET form) |
| `components/course-grade-row.tsx`, `gpa-summary.tsx` | Overview rows and GPA stats |
| `components/grade-scale-editor.tsx` | Settings editor for the scale |

## `src/features/dashboard`

| File | Purpose |
|---|---|
| `widget-ids.ts` | Widget ids in default order (`WIDGET_IDS`), `WidgetSize` |
| `registry.tsx` | `WIDGETS`: id → title, description, icon, component, size, frame, link, skeleton size |
| `now.ts` | Pure: `nextUp`, `countdownText`, timeline positions, `nowOffset`, `weekLoad` |
| `layout.ts` | Pure: `resolveLayout`, `layoutOverrides`, `moveItem`, `visibleWidgets` |
| `today.ts` | Pure: `selectTodaysClasses`, `classMoment` (now/next), `greeting` |
| `queries.ts` | `getDashboardLayout()`, `getDisplayName()` |
| `actions.ts` | `saveDashboardLayout` |
| `widgets/next-up-widget.tsx`, `next-up-hero.tsx` | Hero: live countdown to the class on now/next (client part ticks) |
| `widgets/stats-widget.tsx` | Due today / overdue / GPA stat tiles |
| `widgets/classes-widget.tsx`, `day-timeline.tsx` | Today's classes on a time axis with a moving now line |
| `widgets/week-widget.tsx` | Week strip: class dots, deadline bars, load shading |
| `widgets/task-widgets.tsx` | Due soon and Overdue |
| `widgets/quick-add-widget.tsx` | Quick add |
| `widgets/grades-widget.tsx` | This semester's GPA and grade so far per course |
| `components/widget-frame.tsx` | Grid item + tile per size hint, skeleton, empty text |
| `components/greeting.tsx` | Greeting + date in the user's zone |
| `components/dashboard-editor.tsx` | Edit mode (dnd-kit + up/down buttons) |

## `src/components` and `src/lib`

| File | Purpose |
|---|---|
| `components/app-shell/app-shell.tsx` | Ambient, sidebar (logo, nav, user chip) + main + bottom nav; `data-wide` widens main |
| `components/app-shell/app-nav.tsx` | Sidebar nav and bottom nav; the active pill slides via a named view transition |
| `components/app-shell/page-transition.tsx` | Crossfade on route change (`<ViewTransition>` keyed by pathname) |
| `components/motion/ambient.tsx`, `motion-runtime.tsx` | Fixed ambient glow; tab-hidden flag + delegated spotlight pointer handler |
| `components/leaf-mark.tsx` | Logo mark |
| `components/app-shell/nav-items.ts` | The four top-level sections |
| `components/action-form.tsx` | `ActionForm` (one-button actions with inline error) + `SubmitButton` |
| `components/section-error-boundary.tsx` | Per-section error boundary (`catchError`) |
| `components/empty-state.tsx`, `page-header.tsx`, `back-link.tsx`, `skeletons.tsx` | Shared page parts |
| `components/ui/*` | Tile, StatTile, CountUp, ProgressRing, Pill, CourseStripe, Button, Card, Input, Label, Field, NativeSelect, Textarea, ChoiceGroup, Badge, Checkbox, DropdownMenu |
| `lib/env.ts` | Zod-validated public env |
| `lib/supabase/server.ts`, `client.ts`, `proxy.ts` | Supabase clients; proxy routing rules |
| `lib/dates.ts` | Civil dates, `todayIn`, `addDays`, `isoWeekday`, `formatDate`, time zone validation/list, `minutesNowIn` |
| `lib/color.ts` | Luminance, readable text colour, `toOklch` |
| `lib/motion.ts`, `lib/use-now.ts` | `motionLevel()` for client code; `useNow` minute ticker in the user's zone |
| `lib/action-result.ts` | `ActionResult`, `FormState`, `fieldErrorsFrom`, `formValues` |
| `lib/utils.ts` | `cn()` |
| `proxy.ts` | Next proxy entry (matcher) |
| `types/database.ts` | Generated Supabase types |

## `supabase/` and `e2e/`

| File | Purpose |
|---|---|
| `supabase/migrations/20261115051844_initial_schema.sql` | Five tables, RLS, grants, triggers, sign-up bootstrap |
| `supabase/migrations/20261115064528_task_due_time.sql` | `tasks.due_has_time`, subtask index |
| `supabase/migrations/20261115075519_grades.sql` | `courses.credits`, `assessments` table + RLS |
| `supabase/tests/database/grades.test.sql` | Credits, assessment constraints, isolation |
| `supabase/templates/recovery.html` | Password reset email |
| `scripts/screenshots.mjs` | README screenshots (`bun run screenshots`) |
| `e2e/password-reset.spec.ts`, `e2e/grades.spec.ts`, `e2e/accessibility.spec.ts` | Reset flow, grades flow, axe on every page/theme |
| `supabase/tests/database/rls.test.sql` | Cross-user isolation |
| `supabase/tests/database/schema_rules.test.sql` | Sign-up trigger, grants, JSON size, one-level subtasks, due time |
| `supabase/seed.sql` | Demo account and data |
| `supabase/templates/confirmation.html` | Confirmation email |
| `supabase/config.toml` | Local stack config |
| `e2e/helpers.ts` | `signUp()` via Mailpit, `localDate()` |
| `e2e/tasks.spec.ts`, `e2e/dashboard.spec.ts` | End-to-end flows |
