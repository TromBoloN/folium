# Backend decisions

Finance, data, domain rules, settings storage, server actions, auth and security, integrations, tooling and tests. Newest first; each entry says what was decided, why, what it costs, and its status. Index and open questions: [README.md](README.md).

## Contents

**Finance**

- [2026-11-16: "Match my real balance" rewrites the opening balance](#2026-11-16-match-my-real-balance-rewrites-the-opening-balance)
- [2026-11-16: Finance undo re-inserts the deleted row with the same id](#2026-11-16-finance-undo-re-inserts-the-deleted-row-with-the-same-id)
- [2026-11-16: The last-used account is a cookie](#2026-11-16-the-last-used-account-is-a-cookie)
- [2026-11-16: Typed amounts: separators depend on the suffix](#2026-11-16-typed-amounts-separators-depend-on-the-suffix)
- [2026-11-16: Finance logic takes "now" and the time zone as arguments](#2026-11-16-finance-logic-takes-now-and-the-time-zone-as-arguments)
- [2026-11-16: Money is integer rupiah (bigint), never floats](#2026-11-16-money-is-integer-rupiah-bigint-never-floats)
- [2026-11-16: Finance views run as the caller (`security_invoker`)](#2026-11-16-finance-views-run-as-the-caller-security_invoker)
- [2026-11-16: Planned transactions never count toward balances](#2026-11-16-planned-transactions-never-count-toward-balances)
- [2026-11-16: Finance defaults are seeded lazily and idempotently](#2026-11-16-finance-defaults-are-seeded-lazily-and-idempotently)
- [2026-11-16: Transactions are hard-deleted; undo re-inserts the same row](#2026-11-16-transactions-are-hard-deleted-undo-re-inserts-the-same-row)
- [2026-11-16: Category kind is enforced by a composite foreign key](#2026-11-16-category-kind-is-enforced-by-a-composite-foreign-key)

**Data model**

- [2026-11-16: Semesters stay free text, normalised on save](#2026-11-16-semesters-stay-free-text-normalised-on-save)
- [2026-11-15: Attendance is keyed by the original occurrence](#2026-11-15-attendance-is-keyed-by-the-original-occurrence)
- [2026-11-15: Schedule changes are one-date rows next to the weekly slots, merged by one function](#2026-11-15-schedule-changes-are-one-date-rows-next-to-the-weekly-slots-merged-by-one-function)
- [2026-11-15: Credits are `numeric(4,1)`; scores have no extra credit](#2026-11-15-credits-are-numeric41-scores-have-no-extra-credit)
- [2026-11-15: Deadlines are a date with an optional time](#2026-11-15-deadlines-are-a-date-with-an-optional-time)
- [2026-11-15: Subtasks are tasks with a parent, loaded separately](#2026-11-15-subtasks-are-tasks-with-a-parent-loaded-separately)
- [2026-11-15: Class times are wall-clock times in Asia/Makassar](#2026-11-15-class-times-are-wall-clock-times-in-asiamakassar)

**Domain rules**

- [2026-11-16: 50 minutes per SKS is a constant](#2026-11-16-50-minutes-per-sks-is-a-constant)
- [2026-11-15: Quick add is a tested plain-text grammar, not AI](#2026-11-15-quick-add-is-a-tested-plain-text-grammar-not-ai)
- [2026-11-15: Course grades normalise by the weights entered](#2026-11-15-course-grades-normalise-by-the-weights-entered)
- [2026-11-15: GPA counts only graded courses with credits](#2026-11-15-gpa-counts-only-graded-courses-with-credits)
- [2026-11-15: Overlapping classes are allowed and flagged, not blocked](#2026-11-15-overlapping-classes-are-allowed-and-flagged-not-blocked)

**Settings and preferences**

- [2026-11-15: The grade scale is a preference, default Indonesian 4.0](#2026-11-15-the-grade-scale-is-a-preference-default-indonesian-40)
- [2026-11-15: Time zone is a user preference](#2026-11-15-time-zone-is-a-user-preference)
- [2026-11-15: Settings store only overrides, merged per field](#2026-11-15-settings-store-only-overrides-merged-per-field)

**Server actions and data flow**

- [2026-11-15: Undo by putting things back, not by delaying the write](#2026-11-15-undo-by-putting-things-back-not-by-delaying-the-write)

**Auth and security**

- [2026-11-15: Password reset uses a token-hash recovery template](#2026-11-15-password-reset-uses-a-token-hash-recovery-template)
- [2026-11-15: Security headers in `next.config.ts`](#2026-11-15-security-headers-in-nextconfigts)
- [2026-11-15: Email confirmation uses a token-hash template](#2026-11-15-email-confirmation-uses-a-token-hash-template)

**Integrations**

- [2026-11-15: Calendar export is a download, not a feed](#2026-11-15-calendar-export-is-a-download-not-a-feed)

**Tooling, testing and docs**

- [2026-11-16: Docs consolidated into a few files plus a map](#2026-11-16-docs-consolidated-into-a-few-files-plus-a-map)
- [2026-11-15: The axe matrix is its own suite, on the demo account](#2026-11-15-the-axe-matrix-is-its-own-suite-on-the-demo-account)
- [2026-11-15: Accessibility is tested with axe across every theme](#2026-11-15-accessibility-is-tested-with-axe-across-every-theme)
- [2026-11-15: E2E tests run in CI against a production build](#2026-11-15-e2e-tests-run-in-ci-against-a-production-build)
- [2026-11-15: README screenshots live in `.github/screenshots`](#2026-11-15-readme-screenshots-live-in-githubscreenshots)
- [2026-11-15: Allow 127.0.0.1 as a dev origin](#2026-11-15-allow-127001-as-a-dev-origin)
- [2026-11-15: Biome replaces ESLint, Markdown excluded](#2026-11-15-biome-replaces-eslint-markdown-excluded)

## 2026-11-16: "Match my real balance" rewrites the opening balance

**Status.** Accepted.

**Decision.** Reconciling an account sets `opening_balance = real − (balance − opening_balance)` (`reconciledOpening` in `features/finance/schemas/money-math.ts`, tested), leaving every transaction as it is. The alternative, "Adjust", records the difference as an adjustment transaction dated today (`adjustmentFor`). The real balance and the opening balance may be negative.

**Why.** Students start tracking mid-month; the bank app's number is the truth. Opening balance is a snapshot, so it must be re-run after backfilling older transactions (the page says so). Don't compute balances in TypeScript to do this: read `account_balances`, then write the opening balance.

## 2026-11-16: Finance undo re-inserts the deleted row with the same id

**Status.** Accepted.

**Decision.** Deleting a transaction is a hard delete that returns the full row; the toast's Undo (8 seconds) calls `restoreTransaction`, which inserts that row again with the same `id` and `created_at`. Quick add's Undo deletes the new row by id.

**Why.** Same pattern as tasks: the database stays the source of truth, and the id survives so links and exports stay stable. No `deleted_at` (every balance would need a filter). If an account or category was deleted in between, Undo fails with a message instead of guessing.

## 2026-11-16: The last-used account is a cookie

**Status.** Accepted.

**Decision.** Saving a transaction (form or quick add) sets the `folium_last_account` cookie (httpOnly, a year); new transactions and quick add default to it if it's still an active account of the user (`lastUsedAccountId`), else the first active account.

**Why.** It works without JavaScript and needs no migration or settings write per save. It's per browser, not per account: a phone and a laptop can remember different accounts, which matches how people pay. Move it to preferences only if it must follow the user across devices.

## 2026-11-16: Typed amounts: separators depend on the suffix

**Status.** Accepted.

**Decision.** `parseAmount` (`features/finance/lib/parse-amount.ts`): with a suffix (k, rb, ribu, jt, juta) one "." or "," is a decimal separator ("1,5jt" = "1.5jt" = 1 500 000). Without a suffix, "." or "," is a thousands separator followed by exactly three digits, the same one throughout ("25.000", "1,250,000"); anything else ("25.5", "1,5", "1.000.5") is invalid. The result must be whole rupiah ("1.0001k" is rejected). Scaling uses BigInt on the digit strings, never `parseFloat`.

**Why.** Indonesians write both "1,5jt" and "1.5jt", and "25.000" means twenty-five thousand; sub-rupiah amounts don't exist, so a bare "25.5" is a typo, not 25½. Changing these rules changes what people's typed amounts mean: update the table in `parse-amount.test.ts` first.

## 2026-11-16: Finance logic takes "now" and the time zone as arguments

**Status.** Accepted.

**Decision.** Everything in `src/features/finance/lib` is pure: no I/O, no React, no `Date.now()` or `new Date()` for the current time, no server zone. Callers pass `now` and `timeZone` (the user's `preferences.timeZone`); dates are local `"YYYY-MM-DD"` strings from `localDateFor`, with calendar math in `addDays`.

**Why.** "Today" for money is the user's local day (16:00 UTC is already tomorrow in Makassar), and tests must be able to pin the clock and zone. A function that reads the clock or the server zone puts a late-evening expense on the wrong day.

## 2026-11-16: Money is integer rupiah (bigint), never floats

**Status.** Accepted.

**Decision.** Every amount (`amount`, `fee_amount`, `opening_balance`, balances) is a `bigint` of whole rupiah. Each account stores a `currency` (checked to be `IDR` for now).

**Why.** Floats round (0.1 + 0.2), and rupiah have no minor unit in practice. Sums in SQL and JS stay exact. Don't introduce `numeric`/`float` columns or JS division on stored amounts; format to "Rp" only when displaying. The currency column lets other currencies come later by dropping one constraint, not rewriting rows.

## 2026-11-16: Finance views run as the caller (`security_invoker`)

**Status.** Accepted.

**Decision.** `account_balances` is created `WITH (security_invoker = true)`, and only `authenticated` may select it.

**Why.** A plain view runs as its owner and bypasses RLS, so every user would see every balance. With `security_invoker` the RLS policies on `accounts` and `transactions` apply to whoever queries it (pgTAP proves another user sees nothing). Any new view over user data must do the same.

## 2026-11-16: Planned transactions never count toward balances

**Status.** Accepted.

**Decision.** `transactions.status` is `posted` or `planned`. Balances (`account_balances`) sum posted rows only; planned rows are for the future (expected rent, a scheduled transfer) and change nothing until the user posts them.

**Why.** A balance must match the real account. Any new total (budgets, reports) has to decide explicitly whether it includes planned rows; the default is no.

## 2026-11-16: Finance defaults are seeded lazily and idempotently

**Status.** Accepted.

**Decision.** Default accounts (Livin' by Mandiri, DANA, GoPay, Cash) and categories come from `ensure_finance_defaults()` (security invoker, uses `auth.uid()`), called when the finance pages load, not from the sign-up trigger. It takes an advisory lock per user and seeds only if the user has no accounts and no categories at all; archived rows count.

**Why.** `handle_new_user` never runs again for existing users, so a sign-up seed would miss everyone who already has an account. The lock makes two concurrent first loads safe, and counting archived rows means archiving a default never brings it back. Don't move this into the sign-up trigger or make it re-seed missing defaults.

## 2026-11-16: Transactions are hard-deleted; undo re-inserts the same row

**Status.** Accepted.

**Decision.** Deleting a transaction removes the row. Undo inserts it again with the same `id` (and values), like tasks. There is no `deleted_at`. Accounts and categories, in contrast, are archived (`archived_at`) once used: transaction foreign keys are `ON DELETE RESTRICT`.

**Why.** Soft delete would force every balance, report and query to filter `deleted_at` forever, and one forgotten filter shows wrong money. Restricting deletes of used accounts and categories keeps history intact.

## 2026-11-16: Category kind is enforced by a composite foreign key

**Status.** Accepted.

**Decision.** `transactions (category_id, user_id, kind) → categories (id, user_id, kind)`, and `categories (parent_id, user_id, kind) → categories (id, user_id, kind)`. Both are MATCH SIMPLE, so a NULL category or parent passes.

**Why.** One declarative constraint guarantees the same owner and the same kind: an income category can't go on an expense, and a subcategory can't sit under the other kind, with no trigger to keep in sync. Transfers and adjustments have no category (a named CHECK), which also keeps them outside the FK. Don't replace the composite key with a plain `category_id` FK.

## 2026-11-16: Docs consolidated into a few files plus a map

**Status.** Accepted, amended 2026-11-16: decisions split into `docs/decisions/` (backend, frontend, index); `MAP.md` moved to `docs/MAP.md`.

**Decision.** The 20 numbered docs became `README.md`, `MAP.md` (where things are), `docs/architecture.md`, `docs/local-development.md`, `docs/decisions.md`, `docs/gotchas.md` and `docs/security-review.md`. Per-feature docs, the file-by-file codebase map and the UI states audit were deleted; feature behaviour is described by the code, its tests and the one-line pointers in `MAP.md`. Screenshots left `docs/`.

**Why.** The per-feature docs and the file map drifted within a day of each change (the map still listed deleted files). Fewer, shorter documents that point at code stay true; decisions and gotchas are kept in full because code can't explain *why*.

## 2026-11-16: 50 minutes per SKS is a constant

**Status.** Accepted. Make it a preference if another campus needs it.

**Decision.** New class times default to 50 minutes per credit (`MINUTES_PER_CREDIT`), else 100.

**Why.** Common in Indonesia; it only prefills the end, which the user can change. Make it a preference if another campus needs it.

## 2026-11-16: Semesters stay free text, normalised on save

**Status.** Accepted. A semesters table can come later if semesters need dates of their own.

**Decision.** No semesters table. The course form suggests existing labels (`<datalist>`) and the server reuses an existing spelling when the typed label matches it ignoring case and spaces.

**Why.** "2026 Ganjil" and "2026 ganjil" no longer split a semester, without a migration. A table can come later if semesters need dates of their own.

## 2026-11-15: The axe matrix is its own suite, on the demo account

**Status.** Accepted.

**Decision.** `test:e2e` runs the functional specs (desktop + mobile, 2 workers). `test:a11y` runs the axe matrix as separate projects, signed in once as the seeded demo account via storageState, one test at a time.

**Why.** The matrix signed up and seeded a user per test and dominated run time and load, which made functional tests flaky. The demo account has richer data (changes, breaks, attendance). Sequential because the theme is per user.

## 2026-11-15: Calendar export is a download, not a feed

**Status.** Accepted. A subscribable feed is deferred (needs a per-user secret token).

**Decision.** `/courses/calendar.ics` is an authenticated one-off download with stable UIDs.

**Why.** A feed Google/Apple can poll must be readable without a session, which needs a per-user secret URL token and a server read path outside RLS. Deferred until needed; re-importing updates the same events.

## 2026-11-15: Attendance is keyed by the original occurrence

**Status.** Accepted.

**Decision.** `attendance` rows point at `(slot_id, original date)` or an extra session's `change_id`, never at a computed date.

**Why.** A moved class keeps its mark; cancelling makes it not count (stats only read live occurrences) without deleting the mark, so un-cancelling restores it.

## 2026-11-15: Schedule changes are one-date rows next to the weekly slots, merged by one function

**Status.** Accepted.

**Decision.** `timetable_slots` stays the default schedule. A `class_changes` row touches one date only (cancelled, moved, extra); `class_breaks` cancels regular classes over a range. Not generic calendar events. Every screen reads `buildSchedule()` (`schedule/occurrences.ts`), which merges slots, changes and breaks into the occurrences for a date range.

**Why.** The weekly pattern stays intact and editable, and a change shows next to what it replaced ("Moved from Fri 13:30"). One merge function means the cards, list, grid, Today widgets, overlap warnings, attendance and export can't disagree; it carries the heaviest tests.

**Rules.** An explicit change beats a break; extras always happen; a change whose slot no longer runs on its original date is ignored. "Every week from now on" splits the slot instead of rewriting history.

## 2026-11-15: Undo by putting things back, not by delaying the write

**Status.** Accepted.

**Decision.** Completing, rescheduling, editing and deleting a task save immediately. The action returns what undo needs (the previous status or fields, or a full snapshot of a deleted task and its steps), and "Undo" writes that back. A deleted task is re-inserted with its original id and `created_at`.

**Why.** A delayed delete (wait for the toast to expire, then delete) loses or resurrects data when the tab closes or the user navigates. Writing immediately keeps the database the source of truth.

**Cost.** Undo of a delete can't restore a course that was deleted in between (the task comes back without a course). Rows hide optimistically through `useOptimistic`, which lasts exactly as long as the action's transition.

## 2026-11-15: Quick add is a tested plain-text grammar, not AI

**Status.** Accepted. Extended 2026-11-15: the same grammar's date and time matchers power typed schedule commands.

**Decision.** `parseQuickAdd()` (`tasks/parse.ts`) reads dates, times, `#course` and `!priority` out of one line; the server re-parses in the user's zone. An unknown `#course` stays in the title.

**Why.** Predictable, instant, offline-capable and testable. The preview chips show exactly what will be saved before Enter.

## 2026-11-15: Course grades normalise by the weights entered

**Status.** Accepted.

**Decision.** A course's grade so far is Σ(weight × %) / Σ(graded weight). Weights are percentages of the course grade but are **not** forced to sum to 100; the course page warns when they don't. "What do I need?" solves for the average on ungraded work over the total weight entered.

**Why.** Students enter assessments as they appear; a hard 100% rule would block saving the first quiz. Normalising gives a sensible "so far" grade at every point.

**Cost.** Answers are only as complete as the assessments entered (see `neededOnRemaining` in `src/features/grades/logic.ts` and its tests).

## 2026-11-15: GPA counts only graded courses with credits

**Status.** Accepted.

**Decision.** GPA = Σ(credits × grade points) / Σ(credits) over courses with credits > 0 and at least one graded assessment. Ungraded courses are left out (not counted as 0). Grades in progress use the grade so far. Semester GPA groups by the free-text `courses.semester`; the semester containing active courses is shown first.

**Why.** Counting an ungraded course as 0 would make every new semester look like a failing one. The semester stays a label (open question in the plan) rather than a table.

## 2026-11-15: Credits are `numeric(4,1)`; scores have no extra credit

**Status.** Accepted. Extra credit would relax one named constraint.

**Decision.** `courses.credits` is `numeric(4,1)`, 0–24, default 0 (0 = not in the GPA). `assessments.score` is between 0 and `max_score` (checked in the DB and Zod); `weight` is >0–100.

**Why.** Half credits exist; numeric avoids float rounding. Extra credit can be added later by relaxing one named constraint.

## 2026-11-15: The grade scale is a preference, default Indonesian 4.0

**Status.** Accepted.

**Decision.** `preferences.gradeScale` holds `{ letter, min, points }` bands, validated by `gradeScaleSchema` (2–15 bands, one at 0%, unique minimums and letters, points never rising for lower bands) and merged over the default like every setting. The settings form submits it as one JSON field.

**Also.** `diffFromDefaults` now compares by value (JSON), because an array is never `===` its default and would otherwise always be stored.

## 2026-11-15: Password reset uses a token-hash recovery template

**Status.** Accepted locally. The hosted project still needs the template and setting (see Open decisions).

**Decision.** `/forgot-password` always answers "If an account exists…" (no enumeration, even on provider errors). The recovery email (`supabase/templates/recovery.html`) links to `/auth/confirm?token_hash=…&type=recovery&next=/update-password`, which signs the user in and lands on `/update-password` (also reachable from Settings).

**Security.** `secure_password_change = true`: changing a password needs a recent sign-in (the reset link counts). Mirror this and the template in the hosted project.

## 2026-11-15: Accessibility is tested with axe across every theme

**Status.** Accepted. Amended 2026-11-15: the matrix runs as its own suite (`test:a11y`) on the demo account.

**Decision.** `e2e/accessibility.spec.ts` runs axe (WCAG 2.2 A/AA) on every page, including forms with errors and not-found, in light and dark mode for all five presets (mobile layout for the default preset). Any violation fails the suite.

**Fix it found.** The light `--warning` (due-today labels, overlap text) had 3.74:1 contrast; darkened to `oklch(0.53 0.13 65)` (≈5.2:1).

## 2026-11-15: E2E tests run in CI against a production build

**Status.** Accepted. Amended 2026-11-15: the axe matrix is no longer part of `test:e2e`, so CI runs the functional specs only.

**Decision.** A third CI job starts the full local Supabase stack (Auth + Mailpit for sign-up emails), writes `.env.local` from `supabase status`, builds, serves on port 3000 (the configured `site_url`, so email links return to the app under test) and runs Playwright; failures upload traces.

## 2026-11-15: Security headers in `next.config.ts`

**Status.** Accepted. A script CSP with nonces is deferred.

**Decision.** Every response sends `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a permissions policy. A full script CSP is deferred (needs nonces, which conflict with the static shell). See [security-review.md](../security-review.md).

## 2026-11-15: README screenshots live in `.github/screenshots`

**Status.** Accepted, amended 2026-11-16 (see the update in the entry).

**Decision.** `bun run screenshots` (Playwright, demo account) writes to `.github/screenshots/`, not `docs/`, because `docs/` is git-ignored in this repo.

**Update (2026-11-16).** `docs/` is tracked now, but screenshots still don't belong there: the README's four images stay in `.github/screenshots/`, and design-review captures (`scripts/visual-check.mjs`) go to the git-ignored `screenshots/` folder.

## 2026-11-15: Allow 127.0.0.1 as a dev origin

**Status.** Accepted (development only).

**Decision.** `next.config.ts` sets `allowedDevOrigins: ["127.0.0.1"]`.

**Why.** Supabase's local `site_url` is `http://127.0.0.1:3000`, so after confirming an email you browse the app on 127.0.0.1. `next dev` treats that as cross-origin and blocks its HMR WebSocket, and without it Turbopack can't load client chunks: no client component hydrated in dev (forms fell back to full page posts, the dashboard editor didn't work). Dev-only; production is unaffected.

## 2026-11-15: Deadlines are a date with an optional time

**Status.** Accepted. Revisit if users actually change time zones.

**Decision.** `tasks.due_at` is one instant. A date-only deadline is stored as 23:59:59.999 on that date in the user's time zone, and `due_has_time = false` says to show only the date. A check constraint stops a time without a date.

**Why.** One column drives sorting, "overdue" and the list filters for both kinds of deadline, and the flag means a real 23:59 deadline isn't mistaken for "end of day".

**Cost.** Date-only deadlines are pinned to the zone in effect when saved. If a user later changes time zone, an old date-only deadline can show as the day before or after. Re-saving the task fixes it; revisit if people actually move zones.

**Rules** (pure and tested in `src/features/tasks/due.ts`): overdue once `due_at` has passed (never for done tasks); "today" means the local due date is today; "soon" means the next two days.

## 2026-11-15: Time zone is a user preference

**Status.** Accepted.

**Decision.** `preferences.timeZone` (IANA, default `Asia/Makassar`) decides "today", week boundaries and when date-only deadlines end. Stored in the settings JSON, so no migration.

## 2026-11-15: Subtasks are tasks with a parent, loaded separately

**Status.** Accepted.

**Decision.** Subtasks are rows in `tasks` with `parent_id`, one level deep (a trigger from the initial migration enforces it). The UI treats them as a checklist ("Steps"). They're loaded with a second query, because PostgREST can't embed the composite self-reference `(parent_id, user_id) → (id, user_id)`.

## 2026-11-15: Overlapping classes are allowed and flagged, not blocked

**Status.** Accepted. Since 2026-11-15 dated views flag only classes that really happen (after changes and breaks).

**Decision.** Saving a class time that overlaps another is allowed. Overlaps are shown with a small warning icon in the week view, the course list and the course page.

**Why.** Real timetables overlap: provisional schedules, sitting in on a second class, a lab that sometimes runs late. Blocking the save would force students to lie to the app.

**Rules.** Two slots clash when they're on the same weekday, their times overlap (back-to-back doesn't count), and their optional date ranges meet. Archived courses never clash. The week view only flags clashes that happen on that actual date. Logic is in `src/features/timetable/logic.ts`.

## 2026-11-15: Class times are wall-clock times in Asia/Makassar

**Status.** Accepted, amended: "today" and the week now use the user's time zone preference (default `Asia/Makassar`); see "Time zone is a user preference".

**Decision.** `timetable_slots` stores weekday plus `time` (no zone) and optional `date` bounds. They mean local time in the app's zone. "Today" and the current week are computed in `Asia/Makassar` (`src/lib/dates.ts`), never in the server's zone.

**Why.** A class at 08:00 is at 08:00 whatever the server's zone is, and Indonesia has no DST to complicate weekly repeats.

## 2026-11-15: Settings store only overrides, merged per field

**Status.** Accepted.

**Decision.** `user_settings.theme` and `.preferences` hold only the fields that differ from the defaults. Reading validates each field on its own and falls back to its default.

**Why.** Changing a default reaches everyone who never touched that setting. Adding a setting needs no migration, and one bad stored value can't reset the others.

## 2026-11-15: Email confirmation uses a token-hash template

**Status.** Accepted locally. The hosted project still needs the template (see Open decisions).

**Decision.** The confirmation email links to `/auth/confirm?token_hash=…&type=email` (template in `supabase/templates/confirmation.html`). The route also accepts `?code=` from Supabase's default template.

**Why.** Token-hash links work on any device. PKCE `?code=` links only work in the browser that started sign-up, and students often open email on their phone.

**Cost.** Hosted projects need the same template set in the Supabase dashboard.

## 2026-11-15: Biome replaces ESLint, Markdown excluded

**Status.** Accepted.

**Decision.** Biome lints and formats code, with Markdown excluded from formatting.

**Why.** One fast tool for lint and format, as AGENTS.md specifies. Docs are written by hand and shouldn't be reflowed.
