# Start here

Folium is a personal student dashboard: courses, a weekly timetable, tasks with deadlines, grades and GPA, and a customizable "Today" page. One student, their own data, their own look. Built with Next.js 16 (App Router, Cache Components), Supabase (Postgres, Auth, RLS), Tailwind v4 and TypeScript.

This folder is the project's documentation. Read this page first; it tells you which file answers which question, so you don't have to search the codebase.

## The docs

| File | Read it when you need to… |
|---|---|
| [01-product-overview.md](01-product-overview.md) | Understand what Folium is for, its principles, and which stages are done |
| [02-local-development.md](02-local-development.md) | Run the app, use the demo account, run commands, set up a hosted project |
| [03-architecture.md](03-architecture.md) | Understand how a request flows, the folder rules, and the Cache Components constraints |
| [04-codebase-map.md](04-codebase-map.md) | Find the file that does X, without searching |
| [05-database.md](05-database.md) | Know the tables, constraints, triggers, RLS, migrations and seed |
| [06-auth.md](06-auth.md) | Work on sign-up, sign-in, sessions, route protection |
| [07-settings-and-theming.md](07-settings-and-theming.md) | Change theme tokens, add a setting, understand first-paint theming |
| [08-courses-and-timetable.md](08-courses-and-timetable.md) | Work on courses, class times, the week view, overlap warnings |
| [09-tasks-and-deadlines.md](09-tasks-and-deadlines.md) | Work on tasks, subtasks, filters, quick add, due-date rules |
| [10-today-dashboard.md](10-today-dashboard.md) | Work on the dashboard, widgets, the layout editor |
| [11-dates-and-timezones.md](11-dates-and-timezones.md) | Touch anything involving "today", deadlines or times |
| [12-forms-and-server-actions.md](12-forms-and-server-actions.md) | Write a form or a server action the way the rest of the app does |
| [13-testing.md](13-testing.md) | Run or write unit, database (pgTAP) and end-to-end (Playwright) tests |
| [14-recipes.md](14-recipes.md) | Add a widget, a setting, a table, a feature, a page (step by step) |
| [15-known-issues-and-gotchas.md](15-known-issues-and-gotchas.md) | Avoid traps that already cost time once |
| [16-grades.md](16-grades.md) | Work on credits, assessments, course grades, GPA, the grade scale |
| [17-ui-states-audit.md](17-ui-states-audit.md) | Check which loading/empty/error state each view has, and where error boundaries sit |
| [security-review.md](security-review.md) | See what was audited (actions, RLS, redirects, secrets) and the findings |
| [decisions.md](decisions.md) | See why things are the way they are (dated decision records) |

The original product plan is in [../development/Folium-V1.md](../development/Folium-V1.md) (written under the working name "Padu").

## Where is…? (quick lookup)

| Looking for | Go to |
|---|---|
| A page / route | `src/app/` — see the route table in [03-architecture.md](03-architecture.md#routes) |
| Business logic (pure, tested) | `src/features/<feature>/*.ts` — `logic.ts`, `due.ts`, `layout.ts`, `today.ts`, `week.ts`, `scale.ts`, `schema.ts` |
| Grade maths (course grade, GPA, "what do I need") | `src/features/grades/logic.ts` |
| Database reads | `src/features/<feature>/queries.ts` |
| Database writes | `src/features/<feature>/actions.ts` (server actions) |
| Zod validation | `src/features/<feature>/schema.ts` (`schemas.ts` for auth) |
| UI for a feature | `src/features/<feature>/components/` |
| Shared UI primitives | `src/components/ui/` (shadcn style) and `src/components/` |
| Theme colours, fonts, density | `src/app/globals.css` + `src/features/settings/theme.ts` |
| Date/time helpers | `src/lib/dates.ts` (calendar dates, zones) and `src/features/tasks/due.ts` (deadlines) |
| Supabase clients | `src/lib/supabase/{server,client,proxy}.ts` |
| Route protection | `src/proxy.ts` → `src/lib/supabase/proxy.ts` |
| Who is signed in | `requireUser()` in `src/features/auth/queries.ts` |
| Schema | `supabase/migrations/*.sql`; generated types in `src/types/database.ts` |
| Demo data | `supabase/seed.sql` (account `demo@folium.test` / `folium-demo-2026`) |
| Error boundaries, not-found | `src/app/error.tsx`, `global-error.tsx`, `(app)/error.tsx`, `(app)/not-found.tsx`, `components/section-error-boundary.tsx` |
| Security headers | `next.config.ts` |
| Tests | `*.test.ts` next to the code, `supabase/tests/database/*.sql`, `e2e/*.spec.ts` |
| CI | `.github/workflows/ci.yml` |
| Agent instructions | `AGENTS.md` and `CLAUDE.md` at the repo root |

## Five rules that apply everywhere

1. **Every table is per user and protected by RLS.** Reads and writes go through the user's own Supabase client, so RLS is the real guard. See [05-database.md](05-database.md).
2. **Components never call Supabase.** Pages call `queries.ts`; forms call server actions in `actions.ts`. Actions validate with Zod and return `{ ok, error }` instead of throwing. See [12-forms-and-server-actions.md](12-forms-and-server-actions.md).
3. **No hardcoded colours, radii or fonts.** Use the theme tokens. Course colours are user data and are applied as the `--course` CSS variable.
4. **"Today" is always computed in the user's time zone** (`preferences.timeZone`, default `Asia/Makassar`), never the server's. See [11-dates-and-timezones.md](11-dates-and-timezones.md).
5. **Cache Components is on.** Anything that reads cookies, `searchParams`, `params` or the clock must sit inside `<Suspense>` (and call `await io()` before `new Date()`). See [03-architecture.md](03-architecture.md#cache-components-rules).
