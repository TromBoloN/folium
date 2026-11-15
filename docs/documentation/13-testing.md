# Testing

Test where bugs hide: pure logic, the database's security rules, and a few real-browser flows. Components are not unit tested.

| Layer | Tool | Where | Run | CI |
|---|---|---|---|---|
| Logic | Vitest | `src/**/*.test.ts` (next to the code) | `bun run test` | yes |
| Database | pgTAP | `supabase/tests/database/*.test.sql` | `bun run test:db` | yes (separate job) |
| End to end | Playwright | `e2e/*.spec.ts` | `bun run test:e2e` | yes (job 3) |
| Accessibility | Playwright + axe | `e2e/accessibility.spec.ts` | `bun run test:a11y` (after `bun run db:seed`) | — |
| Types / lint / build | tsc, Biome, next build | — | `bun run typecheck`, `bun run lint`, `bun run build` | yes |

## Unit tests (296)

Pure modules only, with explicit `now` and time zone arguments so they're deterministic:
`lib/dates`, `settings/schema`, `settings/theme`, `auth/schemas`, `courses/schema`, `timetable/logic`, `timetable/week`, `tasks/due`, `tasks/schema`, `dashboard/layout`, `dashboard/today`, `grades/logic` (+ scale), `grades/schema`, `schedule/occurrences` (the merge every screen reads), `schedule/command`, `schedule/attendance`, `schedule/format`, `schedule/ics`.

## Database tests (88)

`rls.test.sql`: two users; B can't read, update, delete or insert A's rows, or link a task to A's course. `schema_rules.test.sql`: sign-up trigger with oversized metadata, exact grants per role, settings JSON size cap, one-level subtasks and cycles, due time needs a date. Tests insert into `auth.users` directly and switch role with `set local role authenticated` + `request.jwt.claims`. Scope counts to the test's own users (the local DB may hold other data).

## End-to-end tests (desktop and mobile Chrome, 2 workers; 1 in CI)

| Spec | Covers |
|---|---|
| `tasks.spec.ts` | Quick add, grouping by due state, completing; rejected form keeps typed values |
| `dashboard.spec.ts` | Sign up → task on the dashboard; "Now"/"Next"; customize (hide, buttons, keyboard drag) persisted |
| `password-reset.spec.ts` | Reset via emailed link, mismatch error, old password rejected; unknown address gets the same answer; `/update-password` needs a session |
| `grades.spec.ts` | Assessments → grade → "what do I need" → GPA → widget; edit/delete; grade scale validation; another user sees not found |
| `schedule.spec.ts` | Cancel with undo, move this week only, Ctrl+K command, break range, remembered view, timetable redirect, .ics |

**Accessibility** (`bun run test:a11y`, projects `a11y` + `a11y-mobile`): axe WCAG 2.2 A/AA on every page (and forms with errors, not-found), light + dark × 5 presets on desktop, default preset on mobile. `a11y.setup.ts` signs in once as the seeded demo account (storageState in `playwright/.auth/`, ignored by git); tests run one at a time because the theme is a per-user setting, and the theme is reset afterwards. Run `bun run db:seed` first.

Requirements: local Supabase running (sign-up reads the confirmation email from Mailpit) and the app running. Against a production build (closest to real):

```bash
bun run build && bun run start -p 3001
E2E_BASE_URL=http://127.0.0.1:3001 bun run test:e2e
```

`signUp()` follows the email link (which points at the configured site URL, port 3000), then returns to `E2E_BASE_URL`. Client components: wait for hydration before clicking (the dashboard editor exposes `form[data-ready]`). Times in tests are computed in Asia/Makassar to match the default user zone.

In CI (job 3) the workflow starts the full Supabase stack, writes `.env.local` from `supabase status`, builds, serves on port 3000 (the `site_url`, so email links come back) and uploads traces on failure.

Waiting rules that keep the suite stable: wait for the URL after client-side navigation before typing (the login and reset pages both have an "Email" field); `waitForContent()` waits until no `Loading…` skeleton remains; for dnd-kit keyboard moves, wait for each live-region announcement ("Due soon is now at position 2 of 5.").

## Visual check

`node scripts/visual-check.mjs <phase>` (app on `BASE_URL`, default `http://127.0.0.1:3100`; run `bun run db:seed` first) signs in as the demo account and saves `docs/screenshots/<phase>/<page>-<preset>-<mode>-<width>.png` for every main page in {light, dark} × {1440, 390} × {green, violet}. It sets the theme in the database and restores it afterwards. Look at the images; nothing is compared automatically.

`e2e/quick-actions.spec.ts` covers the one-line quick add with parsing and undo, complete/undo, rescheduling an overdue task, adding/opening/renaming in sheets, search, and the first-run checklist. Use `waitForHydration(page)` before clicks that should go through client code.
