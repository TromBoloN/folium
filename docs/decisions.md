# Decisions

Short records of real choices, newest first. Each says what was decided, why, and what it costs.

## 2026-11-15: Add and edit happen in sheets (intercepted routes), with no catch-all in the slot

**Decision.** `src/app/(app)/@modal` intercepts `/tasks/new`, `/tasks/[id]`, `/tasks/[id]/edit`, `/courses/new`, `/courses/[id]/slots/new`, `/courses/timetable/new` and the assessment new/edit routes, showing them in a `<Sheet>` (a native modal `<dialog>`) over the current page. Hard loads and shared links still render the full pages. Page bodies live in shared "screen" components with a `page | sheet` variant. A form inside a sheet sends `_sheet=1`; its action then returns `{ ok }` instead of redirecting, and the form closes the sheet, refreshes the page underneath and shows a toast.

**Why.** Small actions shouldn't cost a page load and a trip back, and URLs stay real (back closes the sheet, links are shareable).

**No `[...catchAll]` in the slot.** Next's docs suggest a catch-all page returning null so the slot clears on navigation. With Next 16.4 that page put the client router into an endless segment-prefetch loop (about 190 requests a second for one link, `/tasks?due=today`). Instead the slot only has `default.tsx`, and `<Sheet>` hides itself once `usePathname()` moves away from the URL it opened on. The page crossfade and nav pill key on `usePagePath()` (the main slot's segments), so opening a sheet doesn't remount the page behind it.

## 2026-11-15: Undo by putting things back, not by delaying the write

**Decision.** Completing, rescheduling, editing and deleting a task save immediately. The action returns what undo needs (the previous status or fields, or a full snapshot of a deleted task and its steps), and "Undo" writes that back. A deleted task is re-inserted with its original id and `created_at`.

**Why.** A delayed delete (wait for the toast to expire, then delete) loses or resurrects data when the tab closes or the user navigates. Writing immediately keeps the database the source of truth.

**Cost.** Undo of a delete can't restore a course that was deleted in between (the task comes back without a course). Rows hide optimistically through `useOptimistic`, which lasts exactly as long as the action's transition.

## 2026-11-15: Client-wide data goes through an external store, not context

**Decision.** Courses and preferences the client needs everywhere (row menus, quick-add parsing) are loaded once in the shell and handed to a `useSyncExternalStore` store (`client-data-store.ts`), not to React context.

**Why.** The data arrives just after hydration starts. A context update reaching a Suspense boundary that is still hydrating makes React discard the server HTML and client-render it (seen as a hidden duplicate of the page content and failed e2e tests under load). Components only subscribe to an external store after they hydrate, so the update can't do that.

## 2026-11-15: Settings apply instantly; the action is called directly

**Decision.** Changing a setting re-themes `<html>` at once (the same `themeAttributes()` the server uses) and saves 500 ms after the last change by calling `updateSettings` directly, with an "Undo" toast. The Save button only renders without JavaScript.

**Why.** The preview already showed the result, so a separate Save step was friction. Calling the action directly (not via a form submission) avoids React's automatic reset of uncontrolled fields after a form action, which would snap fields back mid-edit.

## 2026-11-15: Quick add is a tested plain-text grammar, not AI

**Decision.** `parseQuickAdd()` (`tasks/parse.ts`) reads dates, times, `#course` and `!priority` out of one line; the server re-parses in the user's zone. An unknown `#course` stays in the title.

**Why.** Predictable, instant, offline-capable and testable. The preview chips show exactly what will be saved before Enter.

## 2026-11-15: Installable app now; reminders not yet

**Decision.** Folium ships a web app manifest, generated icons and a minimal service worker (offline fallback page only; no caching of personal data). Push or email reminders are not built.

**Why.** Reminders need infrastructure choices that aren't code-only: a scheduler (Supabase pg_cron or an external cron), a sender (an email provider, or Web Push with VAPID keys and a subscriptions table and migration), and per-user opt-in settings. Those should be decided first.

## 2026-11-15: Visual redesign uses CSS and View Transitions, no animation library

**Decision.** The "rich and alive" redesign (bento Today page, layered surfaces, serif display font, motion) is built with CSS animations on `transform`/`opacity` and React's `<ViewTransition>` (the browser View Transitions API). Motion (Framer Motion) was not added. The only new download is Fraunces via `next/font`.

**Why.** Every animation we need is either an entrance (CSS keyframes, staggered by a `--i` variable), a loop (two allowed: the "now" dot and the ambient glow), or a layout change between two React states: the nav pill sliding between items and a checked-off task collapsing while the rows below close up. View Transitions animate those last ones as snapshots on the compositor, with no layout measuring and no extra JS bundle. Where they're unsupported the UI just switches instantly.

**Cost.** Layout animations only run in browsers with View Transitions (Chromium, recent Safari and Firefox). Rows only collapse when the list re-renders after the server action, so there's a short pending state first (the checkbox fills and the row dims while saving).

## 2026-11-15: Motion is a theme setting; the OS reduced-motion setting always wins

**Decision.** `theme.motion` is `full | subtle | off` (default `full`, no migration: settings merge over defaults). It's applied as `data-motion` on `<html>`. `subtle` keeps fades and drops movement, loops and count-ups; `off` and `prefers-reduced-motion: reduce` turn every animation and view transition off in CSS. Client code reads the same rule from `motionLevel()`.

**Why.** Some people find motion distracting without having turned on the OS setting; others want it everywhere but on one device. Animations are entrances and feedback, never information, so turning them off loses nothing.

## 2026-11-15: Today is a bento grid with fixed size hints per widget

**Decision.** Each registry entry has a fixed `size` (`hero`, `wide`, `tall`, `small`) and `frame` (`tile` or `bare`). The grid is a container query grid (1 column, 2 from `@xl`, 12 from `@4xl`) with `grid-auto-flow: dense`; tiles keep their content height, except the day timeline, which stretches to fill its two-row slot because a time axis can be any height. Sizes aren't user-resizable; order and visibility still come from the saved layout.

**Why.** Varied tile sizes give the page hierarchy, and fixed sizes keep the layout predictable and the default order balanced (rows add up to 12 columns). Container queries rather than viewport breakpoints, because the space next to the sidebar is what matters.

**Also.** The existing `classes` widget became the day timeline, keeping its id and title so saved layouts and links keep working, instead of adding a second "today's classes" widget. New ids (`next-up`, `stats`, `week`) are appended for users who saved a layout before they existed.

## 2026-11-15: Theme tokens are re-declared on any `[data-preset]` element

**Decision.** The token block in `globals.css` applies to `:root, [data-preset]`, not just `:root`. A custom accent also sets `--hue` (its OKLCH hue) inline on `<html>`.

**Why.** Custom properties built from `var(--hue)` resolve where they're declared, so a nested element with another `data-preset` didn't re-theme its contents. Re-declaring makes the settings preview and the preset cards real miniatures of each theme. Setting `--hue` from a custom accent tints the neutrals and the ambient glow to match, instead of keeping the preset's hue under a different accent.

**Cost.** The handful of nested `[data-preset]` elements each recompute the token set (negligible).

## 2026-11-15: Course grades normalise by the weights entered

**Decision.** A course's grade so far is Σ(weight × %) / Σ(graded weight). Weights are percentages of the course grade but are **not** forced to sum to 100; the course page warns when they don't. "What do I need?" solves for the average on ungraded work over the total weight entered.

**Why.** Students enter assessments as they appear; a hard 100% rule would block saving the first quiz. Normalising gives a sensible "so far" grade at every point.

**Cost.** Answers are only as complete as the assessments entered (see `neededOnRemaining` in `src/features/grades/logic.ts` and its tests).

## 2026-11-15: GPA counts only graded courses with credits

**Decision.** GPA = Σ(credits × grade points) / Σ(credits) over courses with credits > 0 and at least one graded assessment. Ungraded courses are left out (not counted as 0). Grades in progress use the grade so far. Semester GPA groups by the free-text `courses.semester`; the semester containing active courses is shown first.

**Why.** Counting an ungraded course as 0 would make every new semester look like a failing one. The semester stays a label (open question in the plan) rather than a table.

## 2026-11-15: Credits are `numeric(4,1)`; scores have no extra credit

**Decision.** `courses.credits` is `numeric(4,1)`, 0–24, default 0 (0 = not in the GPA). `assessments.score` is between 0 and `max_score` (checked in the DB and Zod); `weight` is >0–100.

**Why.** Half credits exist; numeric avoids float rounding. Extra credit can be added later by relaxing one named constraint.

## 2026-11-15: The grade scale is a preference, default Indonesian 4.0

**Decision.** `preferences.gradeScale` holds `{ letter, min, points }` bands, validated by `gradeScaleSchema` (2–15 bands, one at 0%, unique minimums and letters, points never rising for lower bands) and merged over the default like every setting. The settings form submits it as one JSON field.

**Also.** `diffFromDefaults` now compares by value (JSON), because an array is never `===` its default and would otherwise always be stored.

## 2026-11-15: Password reset uses a token-hash recovery template

**Decision.** `/forgot-password` always answers "If an account exists…" (no enumeration, even on provider errors). The recovery email (`supabase/templates/recovery.html`) links to `/auth/confirm?token_hash=…&type=recovery&next=/update-password`, which signs the user in and lands on `/update-password` (also reachable from Settings).

**Security.** `secure_password_change = true`: changing a password needs a recent sign-in (the reset link counts). Mirror this and the template in the hosted project.

## 2026-11-15: Per-widget error boundaries with `catchError`

**Decision.** Each dashboard widget is wrapped in `SectionErrorBoundary`, built with Next's `catchError` (works with `redirect`/`notFound`, supports `retry`). Added `src/app/error.tsx` (auth pages), `global-error.tsx` (root layout) and `(app)/not-found.tsx` (not-found inside the shell). Error UIs never show raw error messages.

## 2026-11-15: Accessibility is tested with axe across every theme

**Decision.** `e2e/accessibility.spec.ts` runs axe (WCAG 2.2 A/AA) on every page, including forms with errors and not-found, in light and dark mode for all five presets (mobile layout for the default preset). Any violation fails the suite.

**Fix it found.** The light `--warning` (due-today labels, overlap text) had 3.74:1 contrast; darkened to `oklch(0.53 0.13 65)` (≈5.2:1).

## 2026-11-15: E2E tests run in CI against a production build

**Decision.** A third CI job starts the full local Supabase stack (Auth + Mailpit for sign-up emails), writes `.env.local` from `supabase status`, builds, serves on port 3000 (the configured `site_url`, so email links return to the app under test) and runs Playwright; failures upload traces.

## 2026-11-15: Security headers in `next.config.ts`

**Decision.** Every response sends `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a permissions policy. A full script CSP is deferred (needs nonces, which conflict with the static shell). See [security-review.md](security-review.md).

## 2026-11-15: Grades is a fifth top-level section

**Decision.** "Grades" joins the sidebar and the bottom nav (now five columns). It's used weekly, like Tasks; hiding it under Courses would bury the GPA.

## 2026-11-15: README screenshots live in `.github/screenshots`

**Decision.** `bun run screenshots` (Playwright, demo account) writes to `.github/screenshots/`, not `docs/`, because `docs/` is git-ignored in this repo.

**Update (2026-11-16).** `docs/` is tracked now, but screenshots still don't belong there: the README's four images stay in `.github/screenshots/`, and design-review captures (`scripts/visual-check.mjs`) go to the git-ignored `screenshots/` folder.

## 2026-11-15: Dashboard widgets come from a registry; the layout stores overrides only

**Decision.** `src/features/dashboard/widget-ids.ts` lists widget ids in default order, and `registry.tsx` maps each id to its title, icon and server component. The dashboard renders whatever the user's layout lists, each widget in its own `<Suspense>`. Adding a widget: one id plus one registry entry; no dashboard code changes.

**Layout format** (`user_settings.dashboard_layout`): `{ version: 1, order?: string[], hidden?: string[] }`, storing only what differs from the default. Reading (`resolveLayout`) drops unknown ids and duplicates, and appends registry ids missing from a saved order, so a widget added later appears for users who already saved a layout. Tested in `layout.test.ts`.

**Editing** happens on `/?edit=1` with dnd-kit (pointer, touch with a press delay, and keyboard sensors with spoken announcements) plus move up/down buttons for phones. Nothing is saved until "Save layout".

## 2026-11-15: Allow 127.0.0.1 as a dev origin

**Decision.** `next.config.ts` sets `allowedDevOrigins: ["127.0.0.1"]`.

**Why.** Supabase's local `site_url` is `http://127.0.0.1:3000`, so after confirming an email you browse the app on 127.0.0.1. `next dev` treats that as cross-origin and blocks its HMR WebSocket, and without it Turbopack can't load client chunks: no client component hydrated in dev (forms fell back to full page posts, the dashboard editor didn't work). Dev-only; production is unaffected.

## 2026-11-15: Deadlines are a date with an optional time

**Decision.** `tasks.due_at` is one instant. A date-only deadline is stored as 23:59:59.999 on that date in the user's time zone, and `due_has_time = false` says to show only the date. A check constraint stops a time without a date.

**Why.** One column drives sorting, "overdue" and the list filters for both kinds of deadline, and the flag means a real 23:59 deadline isn't mistaken for "end of day".

**Cost.** Date-only deadlines are pinned to the zone in effect when saved. If a user later changes time zone, an old date-only deadline can show as the day before or after. Re-saving the task fixes it; revisit if people actually move zones.

**Rules** (pure and tested in `src/features/tasks/due.ts`): overdue once `due_at` has passed (never for done tasks); "today" means the local due date is today; "soon" means the next two days.

## 2026-11-15: Time zone is a user preference

**Decision.** `preferences.timeZone` (IANA, default `Asia/Makassar`) decides "today", week boundaries and when date-only deadlines end. Stored in the settings JSON, so no migration.

## 2026-11-15: Forms echo submitted values back on error

**Decision.** Every form action returns the submitted values on failure, and the form uses them as each field's `defaultValue`, remounting with a `key` so selects pick them up.

**Why.** React 19 resets uncontrolled fields when a form action finishes, even when it returns an error, so a rejected save would wipe what the user typed. Checked in a real browser (Playwright) for course, class-time, settings and task forms.

## 2026-11-15: Subtasks are tasks with a parent, loaded separately

**Decision.** Subtasks are rows in `tasks` with `parent_id`, one level deep (a trigger from the initial migration enforces it). The UI treats them as a checklist ("Steps"). They're loaded with a second query, because PostgREST can't embed the composite self-reference `(parent_id, user_id) → (id, user_id)`.

## 2026-11-15: Overlapping classes are allowed and flagged, not blocked

**Decision.** Saving a class time that overlaps another is allowed. Overlaps are shown with a small warning icon in the week view, the course list and the course page.

**Why.** Real timetables overlap: provisional schedules, sitting in on a second class, a lab that sometimes runs late. Blocking the save would force students to lie to the app.

**Rules.** Two slots clash when they're on the same weekday, their times overlap (back-to-back doesn't count), and their optional date ranges meet. Archived courses never clash. The week view only flags clashes that happen on that actual date. Logic is in `src/features/timetable/logic.ts`.

## 2026-11-15: Class times are wall-clock times in Asia/Makassar

**Decision.** `timetable_slots` stores weekday plus `time` (no zone) and optional `date` bounds. They mean local time in the app's zone. "Today" and the current week are computed in `Asia/Makassar` (`src/lib/dates.ts`), never in the server's zone.

**Why.** A class at 08:00 is at 08:00 whatever the server's zone is, and Indonesia has no DST to complicate weekly repeats.

## 2026-11-15: Not-found inside Suspense returns status 200

**Decision.** Course pages call `notFound()` inside `<Suspense>`, so the response streams the not-found UI with a `noindex` tag but keeps status 200.

**Why.** The page shell (header, back link) streams before the course loads. Getting a real 404 would mean blocking the whole page on the query. The pages are private, so the status code has no SEO impact; RLS already guarantees nothing of another user's course is returned.

## 2026-11-15: Known Next.js dev-mode bug on no-JavaScript form errors

**Observed.** In `next dev` only, submitting a form with JavaScript off, when the action returns an error state, can end in a 500 with `InvariantError: Received an underlying cookies object that does not match either cookies or mutableCookies`. The check lives in `makeUntrackedCookiesWithDevWarnings` (`next/dist/server/request/cookies.js`), which production doesn't use. The same requests pass against `next start`.

**Action.** None in app code. Re-test after upgrading Next.

## 2026-11-15: Root layout blocks to apply the saved theme

**Decision.** The root layout reads the user's settings and puts the theme on `<html>` as data attributes, with `export const instant = false`.

**Why.** The plan requires the saved theme on the server render, with no flash of the wrong colours. With Cache Components, a session read outside `<Suspense>` isn't allowed unless the segment opts out of instant validation, and `<html>` can't be wrapped in `<Suspense>`.

**Cost.** Every full page load waits for one `getClaims()` and one `user_settings` query before streaming. Client-side navigations don't re-render the root layout, so they aren't affected. `instant = false` on the root also turns off static-shell validation app-wide; deeper pages can still opt in with `instant = true`.

**Alternative considered.** A cookie copy of the theme plus an inline script that sets the attributes before paint (the next-themes approach). It keeps a static shell, but the server render no longer carries the theme and there are two sources of truth. Revisit if first-load latency becomes a problem.

## 2026-11-15: Theme tokens come from one hue, light and dark via `light-dark()`

**Decision.** Every colour token in `globals.css` is `light-dark(<light>, <dark>)` built from `--hue` and `--chroma`. A preset only sets those two numbers. Mode sets `color-scheme` (`light`, `dark`, or `light dark` for system).

**Why.** One token block instead of a duplicated dark block, "system" mode with no JavaScript, and presets that are two numbers. A custom accent is an inline `--primary` override with a contrast-checked foreground.

**Cost.** Needs `light-dark()` (all evergreen browsers since 2024).

## 2026-11-15: Settings store only overrides, merged per field

**Decision.** `user_settings.theme` and `.preferences` hold only the fields that differ from the defaults. Reading validates each field on its own and falls back to its default.

**Why.** Changing a default reaches everyone who never touched that setting. Adding a setting needs no migration, and one bad stored value can't reset the others.

## 2026-11-15: Language preference is saved but `lang` stays `en`

**Decision.** The language setting is stored, but `<html lang>` stays `en`.

**Why.** `lang` must match the page text, or screen readers pronounce English as Indonesian. Apply the preference when translations ship.

## 2026-11-15: Email confirmation uses a token-hash template

**Decision.** The confirmation email links to `/auth/confirm?token_hash=…&type=email` (template in `supabase/templates/confirmation.html`). The route also accepts `?code=` from Supabase's default template.

**Why.** Token-hash links work on any device. PKCE `?code=` links only work in the browser that started sign-up, and students often open email on their phone.

**Cost.** Hosted projects need the same template set in the Supabase dashboard.

## 2026-11-15: Biome replaces ESLint, Markdown excluded

**Decision.** Biome lints and formats code, with Markdown excluded from formatting.

**Why.** One fast tool for lint and format, as AGENTS.md specifies. Docs are written by hand and shouldn't be reflowed.

## 2026-11-15: Schedule changes are one-date rows next to the weekly slots, merged by one function

**Decision.** `timetable_slots` stays the default schedule. A `class_changes` row touches one date only (cancelled, moved, extra); `class_breaks` cancels regular classes over a range. Not generic calendar events. Every screen reads `buildSchedule()` (`schedule/occurrences.ts`), which merges slots, changes and breaks into the occurrences for a date range.

**Why.** The weekly pattern stays intact and editable, and a change shows next to what it replaced ("Moved from Fri 13:30"). One merge function means the cards, list, grid, Today widgets, overlap warnings, attendance and export can't disagree; it carries the heaviest tests.

**Rules.** An explicit change beats a break; extras always happen; a change whose slot no longer runs on its original date is ignored. "Every week from now on" splits the slot instead of rewriting history.

## 2026-11-15: Attendance is keyed by the original occurrence

**Decision.** `attendance` rows point at `(slot_id, original date)` or an extra session's `change_id`, never at a computed date.

**Why.** A moved class keeps its mark; cancelling makes it not count (stats only read live occurrences) without deleting the mark, so un-cancelling restores it.

## 2026-11-15: Calendar export is a download, not a feed

**Decision.** `/courses/calendar.ics` is an authenticated one-off download with stable UIDs.

**Why.** A feed Google/Apple can poll must be readable without a session, which needs a per-user secret URL token and a server read path outside RLS. Deferred until needed; re-importing updates the same events.

## 2026-11-15: The Courses view is remembered in preferences, the URL wins

**Decision.** `preferences.coursesView` stores the last chosen view (saved on click); `?view=` overrides it. The settings form keeps the stored value instead of posting it.

**Why.** Shareable links open the same view, and a stale settings tab can't reset it.

## 2026-11-15: The axe matrix is its own suite, on the demo account

**Decision.** `test:e2e` runs the functional specs (desktop + mobile, 2 workers). `test:a11y` runs the axe matrix as separate projects, signed in once as the seeded demo account via storageState, one test at a time.

**Why.** The matrix signed up and seeded a user per test and dominated run time and load, which made functional tests flaky. The demo account has richer data (changes, breaks, attendance). Sequential because the theme is per user.

## 2026-11-16: A custom accent is adjusted per mode

**Decision.** A custom accent isn't used as-is: `accentTokens()` keeps its hue but clamps lightness per mode (light 0.42–0.56 with white text, dark 0.72–0.86 with dark text), through `light-dark()`.

**Why.** A dark accent (navy) made the primary button, logo and active nav icon nearly invisible in dark mode; a light one (yellow) failed with white text in light mode. UI components need about 3:1 against their background, and the main action should be the brightest thing, like the presets.

## 2026-11-16: Forms share primitives and only enhance a real form

**Decision.** All forms use `src/components/form/` (FormSection, MoreDetails, ChipGroup, Stepper, FormFooter), the shared control look and a self-checking `Field`. Chips are real radio/checkbox inputs; previews and helpers read and set real inputs.

**Why.** One change improves every form and keeps them consistent. Everything still submits without JavaScript, as before.

## 2026-11-16: One class-time form adds several weekdays

**Decision.** The weekday chips are checkboxes on create; `createSlot` inserts one slot per picked day. Editing stays one slot (radio).

**Why.** "Mon and Wed 07:30" is one thought; the data model (one slot per weekday) stays simple and every slot remains editable on its own.

## 2026-11-16: Semesters stay free text, normalised on save

**Decision.** No semesters table. The course form suggests existing labels (`<datalist>`) and the server reuses an existing spelling when the typed label matches it ignoring case and spaces.

**Why.** "2026 Ganjil" and "2026 ganjil" no longer split a semester, without a migration. A table can come later if semesters need dates of their own.

## 2026-11-16: 50 minutes per SKS is a constant

**Decision.** New class times default to 50 minutes per credit (`MINUTES_PER_CREDIT`), else 100.

**Why.** Common in Indonesia; it only prefills the end, which the user can change. Make it a preference if another campus needs it.

## 2026-11-16: Docs consolidated into a few files plus a map

**Decision.** The 20 numbered docs became `README.md`, `MAP.md` (where things are), `docs/architecture.md`, `docs/local-development.md`, `docs/decisions.md`, `docs/gotchas.md` and `docs/security-review.md`. Per-feature docs, the file-by-file codebase map and the UI states audit were deleted; feature behaviour is described by the code, its tests and the one-line pointers in `MAP.md`. Screenshots left `docs/`.

**Why.** The per-feature docs and the file map drifted within a day of each change (the map still listed deleted files). Fewer, shorter documents that point at code stay true; decisions and gotchas are kept in full because code can't explain *why*.

