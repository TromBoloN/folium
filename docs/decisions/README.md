# Decisions

Short records of real choices: what was decided, why, and what it costs. Split by side, newest first within each file, every entry with a status:

- [backend.md](backend.md): finance, data model, domain rules, settings storage, server actions, auth and security, integrations, tooling and tests.
- [frontend.md](frontend.md): rendering and routing, app shell and navigation, the Today dashboard, theme and motion, forms and interaction.

**Status values.** *Accepted*: in force. *Amended*: in force, changed later as the status line says. *Accepted locally*: done in this repo, still to mirror elsewhere. *Deferred*/*open*: not decided or not built yet; see Open decisions below.

Add a decision at the top of its area's file with a date, **Status**, **Decision**, **Why** and, if any, **Cost**. Traps and bugs that aren't choices go in [../gotchas.md](../gotchas.md).

## Contents by area

### Backend

**Finance**

- [2026-11-16: Bills never create tasks; tasks are for class assignments](backend.md#2026-11-16-bills-never-create-tasks-tasks-are-for-class-assignments)
- [2026-11-16: Debts are transaction kinds, not a separate ledger](backend.md#2026-11-16-debts-are-transaction-kinds-not-a-separate-ledger)
- [2026-11-16: Recurring rules generate planned rows lazily](backend.md#2026-11-16-recurring-rules-generate-planned-rows-lazily)
- [2026-11-16: Safe to spend: spendable accounts, payday from planned income](backend.md#2026-11-16-safe-to-spend-spendable-accounts-payday-from-planned-income)
- [2026-11-16: Reminders: in-app first, email by Vercel Cron](backend.md#2026-11-16-reminders-in-app-first-email-by-vercel-cron)
- [2026-11-16: CSV import dedupes by key and undoes by batch](backend.md#2026-11-16-csv-import-dedupes-by-key-and-undoes-by-batch)
- [2026-11-16: Budgets: parent includes children; rollover is one month](backend.md#2026-11-16-budgets-parent-includes-children-rollover-is-one-month)
- [2026-11-16: Money categories live under /money](backend.md#2026-11-16-money-categories-live-under-money)
- [2026-11-16: Sparklines work backwards from `account_balances`](backend.md#2026-11-16-sparklines-work-backwards-from-account_balances)
- [2026-11-16: Spending charts leave out transfers and adjustments](backend.md#2026-11-16-spending-charts-leave-out-transfers-and-adjustments)
- [2026-11-16: Transaction filters are GET parameters first, JavaScript second](backend.md#2026-11-16-transaction-filters-are-get-parameters-first-javascript-second)
- [2026-11-16: "Match my real balance" rewrites the opening balance](backend.md#2026-11-16-match-my-real-balance-rewrites-the-opening-balance)
- [2026-11-16: Finance undo re-inserts the deleted row with the same id](backend.md#2026-11-16-finance-undo-re-inserts-the-deleted-row-with-the-same-id)
- [2026-11-16: The last-used account is a cookie](backend.md#2026-11-16-the-last-used-account-is-a-cookie)
- [2026-11-16: Typed amounts: separators depend on the suffix](backend.md#2026-11-16-typed-amounts-separators-depend-on-the-suffix)
- [2026-11-16: Finance logic takes "now" and the time zone as arguments](backend.md#2026-11-16-finance-logic-takes-now-and-the-time-zone-as-arguments)
- [2026-11-16: Money is integer rupiah (bigint), never floats](backend.md#2026-11-16-money-is-integer-rupiah-bigint-never-floats)
- [2026-11-16: Finance views run as the caller (`security_invoker`)](backend.md#2026-11-16-finance-views-run-as-the-caller-security_invoker)
- [2026-11-16: Planned transactions never count toward balances](backend.md#2026-11-16-planned-transactions-never-count-toward-balances)
- [2026-11-16: Finance defaults are seeded lazily and idempotently](backend.md#2026-11-16-finance-defaults-are-seeded-lazily-and-idempotently)
- [2026-11-16: Transactions are hard-deleted; undo re-inserts the same row](backend.md#2026-11-16-transactions-are-hard-deleted-undo-re-inserts-the-same-row)
- [2026-11-16: Category kind is enforced by a composite foreign key](backend.md#2026-11-16-category-kind-is-enforced-by-a-composite-foreign-key)

**Data model**

- [2026-11-16: A class can be rescheduled without a date yet (`postponed`)](backend.md#2026-11-16-a-class-can-be-rescheduled-without-a-date-yet-postponed)
- [2026-11-16: Semesters stay free text, normalised on save](backend.md#2026-11-16-semesters-stay-free-text-normalised-on-save)
- [2026-11-15: Attendance is keyed by the original occurrence](backend.md#2026-11-15-attendance-is-keyed-by-the-original-occurrence)
- [2026-11-15: Schedule changes are one-date rows next to the weekly slots, merged by one function](backend.md#2026-11-15-schedule-changes-are-one-date-rows-next-to-the-weekly-slots-merged-by-one-function)
- [2026-11-15: Credits are `numeric(4,1)`; scores have no extra credit](backend.md#2026-11-15-credits-are-numeric41-scores-have-no-extra-credit)
- [2026-11-15: Deadlines are a date with an optional time](backend.md#2026-11-15-deadlines-are-a-date-with-an-optional-time)
- [2026-11-15: Subtasks are tasks with a parent, loaded separately](backend.md#2026-11-15-subtasks-are-tasks-with-a-parent-loaded-separately)
- [2026-11-15: Class times are wall-clock times in Asia/Makassar](backend.md#2026-11-15-class-times-are-wall-clock-times-in-asiamakassar)

**Domain rules**

- [2026-11-16: 50 minutes per SKS is a constant](backend.md#2026-11-16-50-minutes-per-sks-is-a-constant)
- [2026-11-15: Quick add is a tested plain-text grammar, not AI](backend.md#2026-11-15-quick-add-is-a-tested-plain-text-grammar-not-ai)
- [2026-11-15: Course grades normalise by the weights entered](backend.md#2026-11-15-course-grades-normalise-by-the-weights-entered)
- [2026-11-15: GPA counts only graded courses with credits](backend.md#2026-11-15-gpa-counts-only-graded-courses-with-credits)
- [2026-11-15: Overlapping classes are allowed and flagged, not blocked](backend.md#2026-11-15-overlapping-classes-are-allowed-and-flagged-not-blocked)

**Settings and preferences**

- [2026-11-15: The grade scale is a preference, default Indonesian 4.0](backend.md#2026-11-15-the-grade-scale-is-a-preference-default-indonesian-40)
- [2026-11-15: Time zone is a user preference](backend.md#2026-11-15-time-zone-is-a-user-preference)
- [2026-11-15: Settings store only overrides, merged per field](backend.md#2026-11-15-settings-store-only-overrides-merged-per-field)

**Server actions and data flow**

- [2026-11-15: Undo by putting things back, not by delaying the write](backend.md#2026-11-15-undo-by-putting-things-back-not-by-delaying-the-write)

**Auth and security**

- [2026-11-15: Password reset uses a token-hash recovery template](backend.md#2026-11-15-password-reset-uses-a-token-hash-recovery-template)
- [2026-11-15: Security headers in `next.config.ts`](backend.md#2026-11-15-security-headers-in-nextconfigts)
- [2026-11-15: Email confirmation uses a token-hash template](backend.md#2026-11-15-email-confirmation-uses-a-token-hash-template)

**Integrations**

- [2026-11-15: Calendar export is a download, not a feed](backend.md#2026-11-15-calendar-export-is-a-download-not-a-feed)

**Tooling, testing and docs**

- [2026-11-16: Hosted migrations are applied by CI after the tests pass](backend.md#2026-11-16-hosted-migrations-are-applied-by-ci-after-the-tests-pass)
- [2026-11-16: Docs consolidated into a few files plus a map](backend.md#2026-11-16-docs-consolidated-into-a-few-files-plus-a-map)
- [2026-11-15: The axe matrix is its own suite, on the demo account](backend.md#2026-11-15-the-axe-matrix-is-its-own-suite-on-the-demo-account)
- [2026-11-15: Accessibility is tested with axe across every theme](backend.md#2026-11-15-accessibility-is-tested-with-axe-across-every-theme)
- [2026-11-15: E2E tests run in CI against a production build](backend.md#2026-11-15-e2e-tests-run-in-ci-against-a-production-build)
- [2026-11-15: README screenshots live in `.github/screenshots`](backend.md#2026-11-15-readme-screenshots-live-in-githubscreenshots)
- [2026-11-15: Allow 127.0.0.1 as a dev origin](backend.md#2026-11-15-allow-127001-as-a-dev-origin)
- [2026-11-15: Biome replaces ESLint, Markdown excluded](backend.md#2026-11-15-biome-replaces-eslint-markdown-excluded)

### Frontend

**Rendering and routing**

- [2026-11-15: Add and edit happen in sheets (intercepted routes), with no catch-all in the slot](frontend.md#2026-11-15-add-and-edit-happen-in-sheets-intercepted-routes-with-no-catch-all-in-the-slot)
- [2026-11-15: Client-wide data goes through an external store, not context](frontend.md#2026-11-15-client-wide-data-goes-through-an-external-store-not-context)
- [2026-11-15: Per-widget error boundaries with `catchError`](frontend.md#2026-11-15-per-widget-error-boundaries-with-catcherror)
- [2026-11-15: Not-found inside Suspense returns status 200](frontend.md#2026-11-15-not-found-inside-suspense-returns-status-200)
- [2026-11-15: Root layout blocks to apply the saved theme](frontend.md#2026-11-15-root-layout-blocks-to-apply-the-saved-theme)

**App shell, navigation and PWA**

- [2026-11-16: School is a route group with one tab bar; one paths constant](frontend.md#2026-11-16-school-is-a-route-group-with-one-tab-bar-one-paths-constant)
- [2026-11-15: The Courses view is remembered in preferences, the URL wins](frontend.md#2026-11-15-the-courses-view-is-remembered-in-preferences-the-url-wins)
- [2026-11-15: Installable app now; reminders not yet](frontend.md#2026-11-15-installable-app-now-reminders-not-yet)
- [2026-11-15: Grades is a fifth top-level section](frontend.md#2026-11-15-grades-is-a-fifth-top-level-section)

**Today dashboard**

- [2026-11-15: Today is a bento grid with fixed size hints per widget](frontend.md#2026-11-15-today-is-a-bento-grid-with-fixed-size-hints-per-widget)
- [2026-11-15: Dashboard widgets come from a registry; the layout stores overrides only](frontend.md#2026-11-15-dashboard-widgets-come-from-a-registry-the-layout-stores-overrides-only)

**Theme and motion**

- [2026-11-16: A custom accent is adjusted per mode](frontend.md#2026-11-16-a-custom-accent-is-adjusted-per-mode)
- [2026-11-15: Visual redesign uses CSS and View Transitions, no animation library](frontend.md#2026-11-15-visual-redesign-uses-css-and-view-transitions-no-animation-library)
- [2026-11-15: Motion is a theme setting; the OS reduced-motion setting always wins](frontend.md#2026-11-15-motion-is-a-theme-setting-the-os-reduced-motion-setting-always-wins)
- [2026-11-15: Theme tokens are re-declared on any `[data-preset]` element](frontend.md#2026-11-15-theme-tokens-are-re-declared-on-any-data-preset-element)
- [2026-11-15: Theme tokens come from one hue, light and dark via `light-dark()`](frontend.md#2026-11-15-theme-tokens-come-from-one-hue-light-and-dark-via-light-dark)
- [2026-11-16: Translations are gettext-style, keyed by the English text](frontend.md#2026-11-16-translations-are-gettext-style-keyed-by-the-english-text)
- [2026-11-15: Language preference is saved but `lang` stays `en`](frontend.md#2026-11-15-language-preference-is-saved-but-lang-stays-en) (superseded)

**Forms and interaction**

- [2026-11-16: One class-time form adds several weekdays](frontend.md#2026-11-16-one-class-time-form-adds-several-weekdays)
- [2026-11-16: Forms share primitives and only enhance a real form](frontend.md#2026-11-16-forms-share-primitives-and-only-enhance-a-real-form)
- [2026-11-15: Settings apply instantly; the action is called directly](frontend.md#2026-11-15-settings-apply-instantly-the-action-is-called-directly)
- [2026-11-15: Forms echo submitted values back on error](frontend.md#2026-11-15-forms-echo-submitted-values-back-on-error)

## Open decisions

Questions that need a choice before code. Each lists the options known so far.

### Reminders for classes and deadlines

**Status.** Open. Money reminders are decided ([backend.md: Reminders: in-app first, email by Vercel Cron](backend.md#2026-11-16-reminders-in-app-first-email-by-vercel-cron)); classes and task deadlines still have none.

**Needs deciding.** Whether to reuse the same cron, `notification_log` and preferences for deadline and class reminders, or add Web Push (VAPID keys, a `push_subscriptions` table with RLS and pgTAP). Quiet hours should follow `preferences.timeZone`.

### Hosted setup (Supabase project and hosting)

**Status.** Open. Everything runs on the local Supabase stack; nothing is deployed.

**Needs deciding.** The hosting provider (Vercel is the default assumption), the hosted Supabase project and region (close to `Asia/Makassar`), the SMTP provider for auth email (the built-in sender is rate-limited), the production URL for Site URL and redirect URLs, and who runs `supabase db push` (by hand or from CI). The seed must never run against production. Steps known so far: [../local-development.md](../local-development.md#setting-up-a-hosted-supabase-project).

**Context.** [backend.md: Email confirmation uses a token-hash template](backend.md#2026-11-15-email-confirmation-uses-a-token-hash-template), [backend.md: Password reset uses a token-hash recovery template](backend.md#2026-11-15-password-reset-uses-a-token-hash-recovery-template).

### Auth email templates in the hosted dashboard

**Status.** Open. The confirmation and recovery templates (`supabase/templates/`) and `secure_password_change` live in `supabase/config.toml`, which doesn't reach a hosted project.

**Needs deciding.** Paste them into the dashboard by hand (simple, but drifts from the repo), push them with the Supabase CLI's config push or the Management API from CI (one source of truth, needs an access token in CI), or keep the default templates (would break the token-hash links that work on any device). Whichever is chosen, a template change must be mirrored, or sign-up links break silently.

**Context.** Same entries as hosted setup.

### Also deferred (decided not to build yet)

- A script CSP with nonces ([backend.md: Security headers](backend.md#2026-11-15-security-headers-in-nextconfigts)).
- A subscribable calendar feed ([backend.md: Calendar export](backend.md#2026-11-15-calendar-export-is-a-download-not-a-feed)).
- A semesters table ([backend.md: Semesters stay free text](backend.md#2026-11-16-semesters-stay-free-text-normalised-on-save)).
- Minutes per credit as a preference ([backend.md: 50 minutes per SKS](backend.md#2026-11-16-50-minutes-per-sks-is-a-constant)).
- Indonesian quick-add words ("besok", "#makan") and translating the seeded money categories ([frontend.md: Translations](frontend.md#2026-11-16-translations-are-gettext-style-keyed-by-the-english-text)).
