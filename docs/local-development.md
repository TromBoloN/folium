# Local development

## Prerequisites

- [Bun](https://bun.sh) (package manager and script runner; `bun.lock` is committed)
- Docker (for the local Supabase stack)
- Node 20+ (Next.js and Playwright run on it)

The Supabase CLI is used through `bunx supabase …`; nothing needs installing globally.

## First run

```bash
bun install
bunx supabase start          # Postgres, Auth, Studio, Mailpit… prints the local keys
cp .env.example .env.local   # then fill in the two values below
bunx supabase db reset       # applies every migration, then runs supabase/seed.sql
bun dev                      # http://127.0.0.1:3000
```

`.env.local` needs only public values (validated by `src/lib/env.ts`):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from `bunx supabase status`>
```

Never put the secret / service-role key in the app or in any `NEXT_PUBLIC_` variable.

## Demo account

`supabase/seed.sql` creates **`demo@folium.test` / `folium-demo-2026`**:

- 6 active courses + a study group + 1 archived course (last semester), with credits, lecturers and two lecturer contacts;
- 19 weekly class times (one date-ranged lab, one deliberate overlap, one online class with a meeting link);
- this week's schedule changes: a cancelled class with a note, a moved class, a room change next week, a Saturday makeup session; a "Midterm week" break in two weeks with two exams as extra sessions;
- six weeks of attendance for two courses (two misses);
- assessments with some scores (Grades shows a GPA for this and the archived semester);
- 30 tasks with 27 steps spread over overdue / today / soon / later / no deadline / done.

Dates are relative to "today" in Asia/Makassar (changes sit on weekdays of the current week), so re-seed whenever it goes stale.

- `bun run db:seed` rebuilds only the demo account (other local users are untouched).
- `bunx supabase db reset` also runs the seed, but wipes the whole local database.

## Local services

| Service | URL |
|---|---|
| App | http://127.0.0.1:3000 |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit (all auth emails land here) | http://127.0.0.1:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Local Supabase never sends real email. Sign-up confirmation links appear in Mailpit.

## Commands

| Command | What it does |
|---|---|
| `bun dev` | Dev server (Turbopack) |
| `bun run build` / `bun run start` | Production build / serve it |
| `bun run typecheck` | `next typegen` (route types like `PageProps`) then `tsc --noEmit` |
| `bun run lint` / `bun run format` | Biome check / Biome check with fixes (Markdown is excluded) |
| `bun run test` / `bun run test:watch` | Vitest unit tests |
| `bun run test:db` | pgTAP database tests (RLS, constraints, triggers) |
| `bun run test:e2e` | Playwright functional suite, desktop + mobile; needs Supabase + a running app (see [architecture.md](architecture.md#testing)) |
| `bun run test:a11y` | axe matrix (every page × light/dark × presets) as the demo account; run `bun run db:seed` first |
| `bun run db:types` | Regenerate `src/types/database.ts` from the local schema (writes via a temp file) |
| `bun run db:seed` | Rebuild the demo account |
| `bun run screenshots` | The four README screenshots of the demo account → `.github/screenshots/` (app must be running) |
| `node scripts/visual-check.mjs <phase>` | Design-review captures of every main page × theme × width → `screenshots/<phase>/` (git-ignored) |
| `bunx supabase migration new <name>` | New migration file |
| `bunx supabase migration up` | Apply pending migrations, keep data |
| `bunx supabase db reset` | Rebuild the local DB from migrations + seed (wipes data) |

Before finishing any change: `bun run typecheck`, `bunx biome check .`, `bun run test`, `bun run test:db`.

If the browser keeps reloading between `/` and `/login` after a reseed, it holds a session for the old demo user; reload once (the proxy now clears it) or clear the site's cookies. See [gotchas.md](gotchas.md).

## Config files worth knowing

| File | Notes |
|---|---|
| `next.config.ts` | `cacheComponents: true`; `allowedDevOrigins: ["127.0.0.1"]` (dev only, see [gotchas.md](gotchas.md)); security headers; `/courses/timetable` → `/courses?view=week` redirect |
| `supabase/config.toml` | Email confirmations on, min password 8, `secure_password_change`, redirect URLs, confirmation + recovery templates, seed path |
| `supabase/templates/confirmation.html`, `recovery.html` | Sign-up and password-reset emails with token-hash links to `/auth/confirm` |
| `biome.json` | Lint + format; ignores `*.md`, `src/types/database.ts` |
| `vitest.config.mts` | `src/**/*.test.ts`, `@` alias to `src` |
| `playwright.config.ts` | `e2e/`; projects `desktop` + `mobile` (functional, 2 workers, 1 in CI) and `a11y` + `a11y-mobile` (axe, demo account via `playwright/.auth/`); `E2E_BASE_URL` |
| `.github/workflows/ci.yml` | Job 1: typecheck, Biome, unit tests, build. Job 2: pgTAP. Job 3: Playwright e2e against a production build with the local Supabase stack |

## Setting up a hosted Supabase project

The local `config.toml` does not reach a hosted project. In the Supabase dashboard:

1. Authentication → Providers → Email: **confirm email on**, minimum password length **8**, **secure password change on**.
2. Authentication → Email templates: Confirm signup ← `supabase/templates/confirmation.html`; Reset password ← `supabase/templates/recovery.html` (links must keep the `token_hash` form).
3. Authentication → URL configuration: Site URL = your deployed URL; add it (with `/**`) to redirect URLs.
4. Authentication → SMTP: a real provider (e.g. Resend) before real users; the built-in sender is rate-limited.
5. Push the schema: `bunx supabase link --project-ref <ref>` then `bunx supabase db push`. **Do not** run the seed against production.
6. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the hosting provider (e.g. Vercel).

After that first push, CI applies new migrations for you: the `migrate` job in `.github/workflows/ci.yml` runs `supabase db push` on every push to `main`, after typecheck, lint, unit tests, build and the pgTAP tests pass. It needs three repository secrets (GitHub → Settings → Secrets and variables → Actions); without them it skips:

- `SUPABASE_ACCESS_TOKEN`: a personal access token (supabase.com/dashboard/account/tokens).
- `SUPABASE_PROJECT_ID`: the project ref (the `<ref>` in `https://<ref>.supabase.co`).
- `SUPABASE_DB_PASSWORD`: the database password (Project Settings → Database).

Vercel deploys in parallel, so for a few minutes new code can run against the old schema. Write migrations that the current code tolerates (add columns before using them; remove them a release later).

### Money reminders (Vercel Cron)

Bills show in-app without any of this. For email (opt-in per user under Settings → Money emails):

- Locally: set `CRON_SECRET`, `SUPABASE_SECRET_KEY` (from `bunx supabase status`) and `MAILPIT_URL=http://127.0.0.1:54324` in `.env.local`, restart `bun dev`, then `curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/reminders` and read the email in Mailpit.
- Vercel: add `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY` and `EMAIL_FROM` (server-only, never `NEXT_PUBLIC_`). `vercel.json` schedules the route daily at 00:00 UTC (08:00 WITA). Check your plan's cron limits.

Once a migration has been pushed anywhere, never edit it; fix forward with a new migration.
