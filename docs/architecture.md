# Architecture

How Folium is put together and the rules every change follows. Where things are: [MAP.md](MAP.md). Why: [decisions/](decisions/README.md). Traps: [gotchas.md](gotchas.md).

## Stack

Next.js 16 App Router + React 19 (**Cache Components on**), strict TypeScript · Supabase Postgres with RLS and Auth via `@supabase/ssr` cookie sessions · Tailwind v4 with CSS-variable tokens (`src/app/globals.css`), shadcn-style primitives · Zod v4 at every boundary (env, forms, settings JSON, URL params) · own date helpers + `@date-fns/tz` · dnd-kit (dashboard editor) · Biome, Vitest, pgTAP, Playwright + axe, GitHub Actions.

## Folders

```
src/app/                 routes and layouts only (thin); (auth)/, (app)/ (signed in, app shell), (app)/@modal (sheets)
src/features/<name>/     schema.ts (Zod) · queries.ts ("server-only" reads) · actions.ts ("use server" writes)
                         pure logic *.ts with *.test.ts next to it · components/
src/components/          app shell, sheet, toasts, form/ (form pieces), ui/ (primitives)
src/lib/                 dates, env, Supabase clients, colour, helpers
src/types/database.ts    GENERATED (`bun run db:types`); never edit
supabase/                migrations, tests/database (pgTAP), seed.sql, templates, config.toml
e2e/                     Playwright specs
```

Features may import each other's queries, schemas, pure logic and components (the dashboard reuses `TaskRow` and `getSchedule`). Components never call Supabase.

## Request lifecycle

1. **Proxy** (`src/proxy.ts` → `lib/supabase/proxy.ts`): refreshes session cookies with `getClaims()`; logged-out → `/login?next=…`; signed-in users leave `/login` and `/signup` (only after `getUser()` confirms the account still exists). Routing only, not authorization.
2. **Root layout** reads settings and puts the theme on `<html>` as `data-*` attributes and inline tokens: themed on first paint, no client script. It reads the session outside Suspense, so it exports `instant = false`.
3. **`(app)/layout.tsx`** wraps pages in the app shell and renders the `@modal` slot.
4. **Page** renders static parts; anything user-specific sits in `<Suspense>` children that call `requireUser()` and feature queries.
5. **Mutations** are server actions: re-check identity, validate, write through the user's client (RLS applies), `revalidatePath`, then redirect or return a result.

**Sheets**: add/edit/detail screens are intercepted routes in `(app)/@modal/(.)…` rendering the same screen component as the full page inside `<Sheet>`. Refresh or a shared link opens the full page. No catch-all page in the slot (prefetch loop); a sheet hides itself when the pathname changes.

## Cache Components rules

- Reading cookies, headers, `searchParams` or `params` must happen inside `<Suspense>` (page renders the shell + a Suspense'd async child).
- Call `await io()` (from `next/cache`) before `new Date()` in server code, inside Suspense.
- `notFound()` inside Suspense streams the not-found UI with status 200 + `noindex` (fine: pages are private).
- Error boundaries receive `retry`, not `reset`. `useSearchParams()` would need Suspense, so pages pass params down as props.
- Read `node_modules/next/dist/docs/` before using an API you're unsure of; this Next differs from older versions.

## Data and security

- Every table: `user_id` (default `auth.uid()`), `created_at`, `updated_at` (`set_updated_at` trigger), RLS with one policy per operation `(select auth.uid()) = user_id` for `authenticated`; `anon` gets nothing; grants are explicit. Statuses/priorities are `text` + named CHECK constraints, never enums.
- Child rows use **composite foreign keys** `(parent_id, user_id) → parent(id, user_id)` (and `(slot_id, course_id, user_id)` for schedule rows), so nobody can reference another user's row, even with a forged id.
- Queries rely on RLS (no `user_id` filters); inserts take `user_id` from the default.
- Tables: `profiles`, `user_settings` (theme / preferences / dashboard_layout JSON, overrides only, ≤64 KB each), `courses`, `timetable_slots` (weekly class times), `class_changes` (one-date cancelled / moved / extra), `class_breaks` (date ranges with no regular classes), `attendance` (keyed by the original occurrence), `tasks` (with one-level steps via `parent_id`), `assessments`.
- Triggers: `handle_new_user` (security definer; creates profile + settings, truncates provider metadata), `tasks_sync_completed_at`, `tasks_enforce_one_level`.
- PostgREST can't embed the composite self-reference on `tasks`; steps load in a second query.
- Schema changes only through new migration files (`bunx supabase migration new`); never edit an applied one; every table gets RLS + policies in the same migration and a pgTAP isolation test. Then `bun run db:types`.
- Security headers in `next.config.ts`; findings in [security-review.md](security-review.md).

## Auth

Email + password with confirmation (Supabase Auth). Sign-up always answers "Check your email"; forgot-password always answers "If an account exists" (no enumeration). Emails (`supabase/templates/`) link to `/auth/confirm?token_hash=…` (works on any device; `?code=` also accepted). `?next=` is checked by `safeNextPath()` (same-site paths only). `/update-password` needs a session; `secure_password_change` may ask to sign in again.

Identity in pages and actions: **`requireUser()`** (`features/auth/queries.ts`, `getUser()`, cached per request, redirects to `/login`). Never `getSession()` on the server; never the secret key in the app. Local emails land in Mailpit. Hosted setup: [local-development.md](local-development.md#setting-up-a-hosted-supabase-project).

## Dates and time zones

1. The user's zone (`preferences.timeZone`, default `Asia/Makassar`) decides "today", week boundaries and when a date-only deadline ends. Never the server's zone.
2. Instants are stored in UTC (`timestamptz`).
3. Calendar dates are `"YYYY-MM-DD"` strings (`CivilDate`), compared as strings, with arithmetic through UTC so they never shift.
4. Class times are local wall-clock (`time` + ISO weekday 1 = Monday).
5. A date-only deadline is stored as 23:59:59.999 local with `due_has_time = false`; one `due_at` drives sorting, filters and "overdue". It stays pinned to the zone in effect when saved.

Helpers: `lib/dates.ts` (`todayIn`, `minutesNowIn`, `addDays`, `isoWeekday`, `formatDate`, `isCivilDate`, zone validation/list) and `features/tasks/due.ts` (`dueAtFrom`, `dueParts`, `dayBounds`, `dueState`, `formatDue`). DST is covered by tests. Client widgets get the server's `now` as `initialNow`, then `useNow` ticks per minute.

## The schedule: one merge function

Weekly slots are the default timetable; `class_changes` touch one date; `class_breaks` cancel regular classes over a range. **Every screen** (course cards, by-day list, week grid, Today hero/timeline/week strip, overlap warnings, attendance, `.ics` export, typed commands) reads `buildSchedule(input, range)` in `features/schedule/occurrences.ts` via `getSchedule` / `getScheduleInput`. Never merge slots and changes anywhere else. Rules: an explicit change beats a break; extras always happen; a change whose slot no longer runs on its date is ignored. Occurrences are `SlotTiming`s for their own date, so the weekly helpers (sort, lanes, conflicts, now/next) work on them.

## Settings and theming

Settings are JSON holding only overrides of the defaults (`features/settings/schema.ts`): read with `mergeOverDefaults` (each field validated alone, bad ones fall back), written with `diffFromDefaults`. Adding a setting needs no migration; bump `SETTINGS_VERSION` only when a field changes meaning. `getSettings()` never throws.

Every colour derives from `--hue`/`--chroma` as `light-dark()` tokens; `data-mode` sets `color-scheme`, so "system" needs no JS. Presets set two numbers; a custom accent goes through `accentTokens()` (lightness clamped per mode). **No hardcoded colours, radii or fonts**; course colours are data, applied as `--course`/`--tint` CSS variables. Motion: only `transform`/`opacity`; `data-motion="off"` and the OS reduced-motion setting turn it off.

## Forms and server actions

Every write is a server action (`features/<name>/actions.ts`):

1. `await requireUser()`; 2. `values = formValues(formData)` (echoed back on error); 3. parse with Zod, on failure `{ ok: false, error, fieldErrors: fieldErrorsFrom(issues), values }`; 4. write via `createClient()`, mapping Postgres codes (`23503` reference not yours / gone, `23514` check failed) to friendly text and logging the raw error; 5. `revalidatePath`, then `redirect` or `{ ok: true }`. Actions **return** errors (`ActionResult`/`FormState` in `lib/action-result.ts`), never throw. From a sheet (`_sheet` field, `fromSheet()`) they return instead of redirecting.

A form: `useActionState(action, null)`, `key={JSON.stringify(state)}` (remount so selects/chips take new defaults), `noValidate`, uncontrolled inputs with `defaultValue={state.values?.[name] ?? default}` (React 19 resets uncontrolled fields after an action, even on error). Built from shared pieces: `Field` (label, hint, error ids, checks itself on blur), `FormSection`, `MoreDetails`, `ChipGroup` (real radios/checkboxes), `Stepper`, `FormFooter` (sticky Cancel/Save), `SheetFormBridge` (toast + close in a sheet), the `CONTROL` look in `ui/control.ts`. Previews and helpers only read/set real inputs: **every form still submits without JavaScript.** One-button actions use `ActionForm` + `SubmitButton`; destructive confirms use `<details>`.

Optimistic actions with Undo (tasks, schedule changes, attendance, settings) write immediately and Undo writes the previous values back.

## Errors, loading, empty

Every data view has a Suspense skeleton, an empty state and an error boundary: `(app)/error.tsx` (inside the shell), `src/app/error.tsx` (auth pages), `global-error.tsx` (root layout), one `SectionErrorBoundary` per dashboard widget, `(app)/not-found.tsx`. Error UIs never show raw messages.

## Testing

| Layer | Where | Run |
|---|---|---|
| Pure logic (Vitest) | `src/**/*.test.ts`, next to the code, explicit `now` and zone | `bun run test` |
| Database (pgTAP) | `supabase/tests/database/*.test.sql`: cross-user isolation, constraints, triggers, grants | `bun run test:db` |
| End to end (Playwright) | `e2e/*.spec.ts`, desktop + mobile Chrome, fresh users via Mailpit | `bun run test:e2e` |
| Accessibility (axe, WCAG 2.2 AA) | `e2e/accessibility.spec.ts`, every page × light/dark × presets, as the demo account | `bun run test:a11y` |

Unit-test what can break silently: dates and deadlines, the schedule merge, parsers (quick add, schedule commands), grades/GPA, layouts, settings merging, `.ics`. pgTAP tests insert into `auth.users`, switch role with `set local role authenticated` + `request.jwt.claims`, and count only their own users' rows.

E2E needs the local Supabase stack and a running app (`E2E_BASE_URL`, default `:3000`; the confirmation link always goes to `:3000`, `signUp()` comes back). Wait for hydration (`waitForHydration`, `form[data-ready]`) before clicks that need client code; wait for the URL after navigating before typing; for dnd-kit keyboard moves wait for each announcement. The a11y suite signs in once (`e2e/a11y.setup.ts`, state in git-ignored `playwright/.auth/`) and runs one test at a time because the theme is per user; run `bun run db:seed` first.

CI (`.github/workflows/ci.yml`): typecheck, Biome, unit tests and build; pgTAP; Playwright against a production build with the local Supabase stack.

Before finishing any change: `bun run typecheck`, `bunx biome check .`, `bun run test`, `bunx supabase test db`.
