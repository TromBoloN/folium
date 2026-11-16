# Map

Where to look before you change something. One section per feature: its routes, its files, and the rule that matters. Paths are under `src/` unless they start with another folder (relative to the repo root). Tests sit next to the file they test (`x.ts` → `x.test.ts`). How it fits together: [architecture.md](architecture.md).

## Find it fast

| Looking for | Go to |
|---|---|
| A page | `app/(app)/<route>/page.tsx` (signed in), `app/(auth)/…` (login, sign-up, password) |
| The sheet version of a page | `app/(app)/@modal/(.)<route>/page.tsx` (same screen component, wrapped in `<Sheet>`) |
| Reads / writes / validation | `features/<name>/queries.ts` / `actions.ts` / `schema.ts` |
| Business rules (pure, tested) | `features/<name>/*.ts` that aren't queries/actions |
| Shared UI | `components/ui/` (primitives), `components/form/` (form pieces), `components/` (shell, sheet, toasts) |
| Theme tokens, utilities, motion | `app/globals.css` (+ `features/settings/theme.ts`) |
| Theme packs (whole looks) | `features/themes/` — guide: [themes.md](themes.md) |
| Dates and time zones | `lib/dates.ts`, `features/tasks/due.ts` |
| Who's signed in | `requireUser()` in `features/auth/queries.ts`; routing in `lib/supabase/proxy.ts` |
| Schema | `supabase/migrations/*.sql` → generated `types/database.ts` |
| Demo data | `supabase/seed.sql` (`demo@folium.test` / `folium-demo-2026`) |
| Tests | `*.test.ts`, `supabase/tests/database/*.sql`, `e2e/*.spec.ts` |

## Shell and shared UI

- `app/layout.tsx`: fonts, theme attributes on `<html>` from settings (`instant = false`), PWA metadata. `app/(app)/layout.tsx`: app shell + `@modal` slot.
- `components/app-shell/`: `app-shell.tsx` (sidebar, main, bottom nav, providers), `app-nav.tsx` + `nav-items.ts` (Today, School, Money, Themes, Settings: five tabs on phones; School lights up for `SCHOOL_PATHS`), `section-tabs.tsx` (the shared tab bar for School and Money). `src/lib/sections.ts`: `SCHOOL_TABS`/`SCHOOL_PATHS`, `MONEY_TABS`, `isUnder` (one source for sidebar and tabs), `page-transition.tsx`, `use-page-path.ts` (the page under an open sheet).
- `components/sheet.tsx`: `Sheet` (native `<dialog>`, side/bottom sheet), `useSheet()` (`close`, `setTint`), `SheetFormBridge`, `CancelButton`.
- `components/toast/toaster.tsx`: `useToast()` with an optional action (Undo).
- `components/form/`: `FormSection` + `MoreDetails`, `ChipGroup`, `Stepper`, `FormFooter`. `components/ui/field.tsx` (self-checking field), `ui/control.ts` (the shared control look), `ui/native-select.tsx` (+ the "Selects" block in `globals.css`).
- `components/action-form.tsx`: one-button actions. `section-error-boundary.tsx`: per-widget errors. `empty-state.tsx`, `page-header.tsx`, `skeletons.tsx`.
- Motion: `components/motion/` (`Ambient`: the fixed background the theme pack draws on, hosting `<ThemeEffects>`; `MotionRuntime` sets `data-hydrated` and `data-tab-hidden`, spotlight), `lib/use-now.ts` (minute ticker).
- Translations: `lib/i18n/` (`core.ts`: `makeT`, `plural`, `translateLoose`; `server.ts`: `getI18n`/`getT`; `client.tsx`: `I18nProvider`, `useI18n`/`useT`, `<Tr>`, `<TrL>`; `rich.tsx`; `id/*.ts`: the Indonesian dictionary keyed by English text, `id/patterns.ts` for messages with values).
- PWA: `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `lib/pwa/brand.tsx`, `public/sw.js` (offline page only), `components/pwa/`.

## Themes — `features/themes/`

Route `/themes` ("Available soon"; in development it also lists every pack with an Apply button). A theme is a **pack**: `packs/<id>/manifest.ts` + `packs/<id>/theme.css` (every selector under `[data-theme="<id>"]`) + optional `effects.tsx`. `registry.ts` (`THEMES`, `THEME_PACK_IDS` → the `theme.pack` setting, `getManifest`, `visibleThemes`), `manifest.ts` (types), `packs/index.css` (imported after `globals.css` in `app/layout.tsx`), `effects.tsx` (`<ThemeEffects>`, lazy per pack, off with motion off / reduced motion / Save-Data), `fonts.ts` (theme fonts, `preload: false`), `lint.ts` + `packs.test.ts` (scoping, keyframes, colours-in-tokens, contrast). `packs/default/` is today's look. Saving: `setThemePack` in `features/settings/actions.ts`. **Everything else (token contract, skinnable parts, mobile budget, recipes): [themes.md](themes.md).**

## Auth — `features/auth/`

Routes `/login`, `/signup`, `/forgot-password`, `/update-password`, `app/auth/confirm/route.ts`. `actions.ts` (sign in/up/out, reset, update password; no account enumeration), `schemas.ts` (`safeNextPath`, password rules; keep `MIN_PASSWORD_LENGTH` in sync with `supabase/config.toml`), `queries.ts` (`requireUser`). Email templates: `supabase/templates/`.

## Settings — `features/settings/`

Route `/settings`. `schema.ts` (theme incl. `pack` + preferences, defaults, merge/diff, `SETTINGS_VERSION`), `theme.ts` (`themeAttributes`, `accentTokens`), `queries.ts` (`getSettings`, cached, never throws), `actions.ts` (`updateSettings`; `rememberCoursesView`), `components/settings-form.tsx` (applies instantly, saves after 500 ms, Undo). Preferences include time zone, week start, time format, grade scale, `coursesView`, `attendanceTarget`.

## School (Courses, Tasks, Grades)

Routes live in `app/(app)/(school)/` (a route group: URLs unchanged) with one `layout.tsx` showing the School tab bar. Tasks is for class assignments only; bills never create tasks.

## Courses — `features/courses/`

Routes `/courses` (`?view=cards|day|week&week=&semester=`), `/courses/new`, `/courses/[id]`, `/courses/[id]/edit`, `/courses/rollover`. `schema.ts` (course input, `courseRow`, colours, `whatsappLink`, `canonicalSemester`, `semesterLabels`, `nextSemesterName`), `queries.ts` (`listCourses` cached, `getCourse`, `listActiveSlots`, `listCourseOptions`), `actions.ts` (CRUD, archive, `startNewSemester`). Components: `course-list.tsx` (cards + stats), `course-form.tsx` (live preview, tints the sheet), `semester-switch.tsx`, `rollover-form.tsx`, `course-actions.tsx` ("⋯" menu). The course page (`app/(app)/courses/[id]/page.tsx`) also shows Coming up and attendance.

## Timetable (weekly slots) — `features/timetable/`

Routes `/courses/[id]/slots/new`, `/courses/[id]/slots/[slotId]/edit`, `/courses/timetable/new` (`?weekday&start&week`). `logic.ts` (weekdays, times, `appliesOn`, overlaps/`findConflicts`, `layoutDay`, `weekDates`, `suggestedDuration` = 50 min per SKS, `commonStartTimes`), `week.ts` (`buildWeek`: runs `buildSchedule` for one week, adds lanes, chips, ghosts, attendance), `schema.ts`, `actions.ts` (`createSlot` takes several weekdays). Components: `slot-form.tsx` (weekday chips, start chips, mini week + overlap warning), `slot-screens.tsx` (`slotFormContext`), `week-grid.tsx`, `day-agenda.tsx`, `week-view.tsx`, `add-slot-overlay.tsx`, `slot-list.tsx`.

## Schedule (what really happens) — `features/schedule/`

**The rule:** every screen gets classes from `buildSchedule` (`occurrences.ts`) through `getSchedule` / `getScheduleInput` (`queries.ts`). Never merge slots, changes and breaks elsewhere.

Routes `/courses/class/[key]` (class sheet; key `s.<slot>.<originalDate>` or `x.<change>`), `/courses/extra/new`, `/courses/breaks/new`, `/courses/calendar.ics` (route handler). Files: `occurrences.ts` (merge + helpers `isLive`, `nextOccurrence`, `isPast`, `changesByCourse`, keys), `format.ts` (chip texts, `RowItem`, labels), `command.ts` (typed commands: "cancel physics tomorrow", `resolveCommand`), `attendance.ts` (stats vs target), `ics.ts`, `schema.ts`, `actions.ts` (cancel, move/room with once/forward, undo, extras, breaks, attendance, `runScheduleCommand`). Components: `class-screen.tsx` + `class-actions.tsx` (Did you attend? / Changed?), `by-day-view.tsx` + `occurrence-row.tsx` + `attendance-quick.tsx`, `view-switch.tsx`, `week-toolbar.tsx`, `week-rail.tsx`, `change-chips.tsx` (the one look for changes), `attendance-panel.tsx`, `extra-form.tsx`, `break-form.tsx`, `command-preview.ts`.

## Tasks — `features/tasks/`

Routes `/tasks` (`?status&due&course`), `/tasks/new`, `/tasks/[id]`, `/tasks/[id]/edit` (all also as sheets). `due.ts` (deadline rules: `dueState`, `dueWindowRange`, `formatDue`, `compareTasks`, `movedDue`), `parse.ts` (quick-add grammar, `matchCourse`; date/time matchers reused by schedule commands), `schema.ts`, `queries.ts` (`listTasks`, `getTask`, `listOpenTasks` cached), `actions.ts` (CRUD, steps, `quickAddTask`, `patchTask`, `removeTask`/`restoreTask` for Undo). Components: `task-ops.tsx` (optimistic changes + Undo), `task-row.tsx` + `task-row-frame.tsx` (swipe, quick move), `task-menu.tsx`, `task-form.tsx`, `quick-add.tsx` + `parse-preview.tsx`, `client-data-store.ts` (courses/zone for client code; not context), `task-screens.tsx`.

## Grades — `features/grades/`

Routes `/grades`, `/grades/[courseId]` (`?target=`), assessment new/edit (also sheets). `logic.ts` (grade so far, `weightedGpa` over graded courses with credits, `gpaBySemester`, `neededOnRemaining`), `scale.ts` (grade bands, default Indonesian 4.0, validation, `bandFor`), `schema.ts`, `queries.ts`, `actions.ts` (CRUD, `setAssessmentScore`). Components: `assessment-form.tsx`, `assessment-list.tsx` + `score-input.tsx` (inline score with Undo), `needed-calculator.tsx`, `grade-scale-editor.tsx`.

## Today dashboard — `features/dashboard/`

Route `/` (`?edit=1` = layout editor). `widget-ids.ts` (ids in default order), `registry.tsx` (`WIDGETS`: title, icon, component, size, link), `layout.ts` (`resolveLayout`: unknown ids dropped, new ids appended, junk → defaults; only overrides stored), `now.ts` (hero `nextUp`, timeline maths, `weekLoad`), `today.ts` (`classMoment`, `greeting`), `widgets/` (one file per widget; `hero-class.ts` turns occurrences into widget data), `components/` (`dashboard-editor.tsx` with dnd-kit + up/down buttons, `onboarding.tsx` first-run checklist, `attendance-prompt.tsx` "Did you go?", `widget-frame.tsx`, `greeting.tsx`). Each widget has its own Suspense and error boundary.

## Money (finance) — `features/finance/`

**The rules:** amounts are bigint rupiah (read as `::text`, never floats); balances come only from the `account_balances` view; planned rows never count toward balances; transfers, adjustments and the debt kinds (`lend`, `repay`, `borrow`, `payback`) are never spending or income; pure logic in `lib/` takes `now`/`today` and `timeZone` as arguments.

**Shell.** `app/(app)/money/layout.tsx` + `components/money-chrome.tsx`: one header (Add transaction, gear menu: Accounts, Categories, Import and export), a tab bar (`TABS`: Overview, Transactions, Recurring, Budgets, Goals, Debts, Reports; add a tab only when its page exists) and the quick-add bar on the tabs. Full-page forms (`/money/new`, `/money/[id]/edit`) get no chrome.

**Routes.**
- `/money`: quick add, total + account cards (7-day sparklines), safe to spend + 30-day forecast, upcoming bills, budgets closest to the limit, month overview, spending by category, recent. `?month=YYYY-MM`, `?quick=` prefills the bar.
- `/money/transactions`: pill filters `?q&account&category&kind&month` (`category=none` = uncategorised), `?limit=` for Load more.
- `/money/new` (`?kind=&account=&to=`), `/money/[id]/edit` (also sheets).
- `/money/recurring` (bills by Overdue / This week / Later this month, Mark paid), `/money/recurring/new?template=` (subscription, kos, ukt, data, service, allowance, sinking), `/money/recurring/[id]` (edit, pause, delete).
- `/money/budgets?month=`, `/money/goals`, `/money/debts` (balances per person, Mark settled, split a bill), `/money/reports`.
- Manage: `/money/accounts` (+ `/new`, `/[id]` with `#reconcile`), `/money/categories` (+ `/[id]`; `/settings/categories` redirects), `/money/import` (CSV import with undo, exports, delete all).
- `/money/export.csv`, `/money/export.json`, `/api/cron/reminders` (Vercel Cron, `CRON_SECRET`).

**Files.**
- `lib/`: `parse-amount`, `format-idr`, `split-evenly`, `local-date`, `parse-quick-transaction`, `quick-line`, `suggest-category`, `to-csv`, `balance-series`, `rollup-by-category`, `compare-months`, `money-palette`, `filters-href`, `recurrence` (due dates, clamping), `rule-templates`, `budgets`, `safe-to-spend` (+ forecast), `goals-debts` (pace, splitBill, settlement), `reports`, `csv-import`, `reminders`. Tests: `*.test.ts` beside them (`phase2.test.ts` for the planning helpers).
- `schemas/`: transaction/account/category forms, `planning.ts` (rules, budgets, goals), `money-math.ts`.
- `queries/`: `index.ts` (defaults, accounts, categories, transactions, filters), `planning.ts` (rules + lazy generation, bills, budgets, goals, course spending; bills never touch tasks), `people.ts`, `budget-progress.ts`, `safe-to-spend.ts`, `imports.ts` (+ JSON backup), `today.ts`.
- `actions/`: `transactions.ts` (save, quick add, delete/restore), `accounts.ts`, `categories.ts`, `planning.ts` (rules, mark paid, budgets, goals), `debts.ts` (people, settle, split), `data.ts` (CSV import, undo, delete all).
- `reminders-job.ts` (the cron's work); `src/lib/email.ts` (Resend / Mailpit), `src/lib/supabase/admin.ts` (secret key, cron only).
- Components: `money-chrome`, `quick-add-bar`, `money-overview`, `planning-cards`, `bills`, `budget-list`, `spending-by-category`, `transaction-list` (shared row), `transaction-form`, `transaction-filters`, `rule-form`, `import-form`, `toast-form` (one-click actions with a toast), `money-icon`, `appearance-fields`, `course-spending` (on the course page). Today widget: `features/dashboard/widgets/money-widget.tsx`.

**Database.** `supabase/migrations/*_finance*.sql` (1a ledger; recurring; budgets, goals, spendable; debts + `person_balances`; import batches, task/course links, `notification_log`). Tests: `supabase/tests/database/finance.test.sql`, `finance_phase2.test.sql`. Demo money (dev only, not in `db reset` or CI): `bun run db:seed && bun run db:seed:finance`.

## Search and command palette — `features/search/`

`actions.ts` (`searchEverything`), `components/palette-provider.tsx` (Ctrl/⌘K search, N add), `command-palette.tsx` (add with parsing, search, schedule commands, navigation), `palette-buttons.tsx` (sidebar button, mobile + button).

## Database — `supabase/`

`migrations/` (initial schema; task due time; grades; schedule changes; attendance and links; finance; bills-never-create-tasks cleanup), `tests/database/` (`rls`, `schema_rules`, `grades`, `schedule`), `seed.sql` (demo account; safe to re-run, never against production), `templates/` (auth emails), `config.toml`.

## How do I…

**Add a dashboard widget.** Add the id to `widget-ids.ts` (position = default order), write `widgets/<name>-widget.tsx` (async server component loading its own data; `await io()` before the clock; a `WidgetEmpty` when empty), add a `WIDGETS` entry in `registry.tsx`. Saved layouts get it appended automatically.

**Add a setting.** Field + default in `settings/schema.ts` (no migration), read it in `updateSettings`, add the control to `settings-form.tsx` with `value("<name>", saved)`. Theme settings also extend `themeAttributes()` and `globals.css`. Bump `SETTINGS_VERSION` + `upgrade()` only if an existing field changes meaning.

**Add a table.** `bunx supabase migration new <name>`; in the same file: `user_id … default auth.uid()`, timestamps + `set_updated_at` trigger, named CHECKs, composite FKs, RLS enabled, `revoke all … from anon, authenticated`, explicit grants, one policy per operation. A pgTAP isolation test in `supabase/tests/database/`. `migration up`, `bun run db:types`, maybe extend the seed.

**Add a feature.** `features/<name>/` with `schema.ts`, `queries.ts` (`import "server-only"`), `actions.ts` (`"use server"`, the action contract), pure logic + tests, `components/`. Thin routes in `app/(app)/<name>/` (school pages in `app/(app)/(school)/`). A nav entry goes in `nav-items.ts` (the bottom nav fits five); a tab in `src/lib/sections.ts`. Add its pages to `e2e/accessibility.spec.ts`.

**Add a page.** Static parts (header) in the page, data in a Suspense'd async child that calls `requireUser()`, awaits `params`/`searchParams`, and calls `notFound()` when needed. Give it loading, empty and error states. `bun run typecheck` regenerates `PageProps`. For a sheet version, add `app/(app)/@modal/(.)<route>/page.tsx` rendering the same screen with `variant="sheet"`.

**Add a form.** Build it from `Field`, `FormSection`, `ChipGroup`, `FormFooter`; follow the form contract in [architecture.md](architecture.md#forms-and-server-actions); include `SheetFormBridge` if it can open in a sheet.

**Add or change text.** Write it in English through `t("…")` (server: `await getT()`; client: `useT()`; either side: `<Tr k="…" />`) and add the Indonesian to the matching `lib/i18n/id/*.ts`; `bun run typecheck` lists any key without one. Text passed to `Field`/`PageHeader`/`EmptyState`/`StatTile` props or returned by a server action is translated where it's shown: add it to `id/loose.ts` or `id/messages.ts`. Format dates with the `intl` from `getI18n()`/`useI18n()`.

**Change a theme colour.** Edit the token in `globals.css` (both halves of `light-dark()`). A new preset: add it to `PRESETS` (`settings/schema.ts`), a label in `theme.ts`, and a `[data-preset="…"] { --hue; --chroma }` rule.

**Show a class anywhere.** Load `getSchedule(range)`, filter with `isLive`/`isListed`, label with `occurrenceChips` and render chips with `ChangeChips`. Don't read `timetable_slots` for dated views.
