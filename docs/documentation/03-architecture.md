# Architecture

## Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, strict TypeScript, **Cache Components on** |
| Styling | Tailwind v4 with CSS-variable theme tokens (`src/app/globals.css`), shadcn-style components in `src/components/ui` |
| Data and auth | Supabase Postgres with RLS, Supabase Auth via `@supabase/ssr` (cookie sessions) |
| Validation | Zod v4 at every boundary (env, forms, settings JSON, URL filters) |
| Dates | Own helpers in `src/lib/dates.ts` + `@date-fns/tz` for zone conversion |
| Drag and drop | dnd-kit (dashboard editor) |
| Tooling | Biome (lint/format), Vitest, pgTAP, Playwright, GitHub Actions |

## Folder rules

```
src/
  app/                 routes and layouts only; keep thin
    (auth)/            /login, /signup (centered card layout)
    (app)/             signed-in area, wrapped in the app shell
    auth/confirm/      email confirmation route handler
  features/<name>/     everything for one feature
    schema.ts          Zod schemas + types (validation)
    queries.ts         reads ("server-only"), used by pages
    actions.ts         writes ("use server"), used by forms
    *.ts               pure logic, unit tested next to it (*.test.ts)
    components/        the feature's UI
  components/          shared UI (app shell, empty state, page header…)
    ui/                primitives (button, input, field, native-select…)
  lib/                 cross-feature helpers (dates, env, supabase clients…)
  types/database.ts    GENERATED from the schema; never edit
```

Features: `auth`, `settings`, `courses`, `timetable`, `tasks`, `grades`, `dashboard`. Features may import each other's `queries`, `schema`, pure logic and components (e.g. the dashboard reuses `TaskRow` and `listActiveSlots`).

## Request lifecycle

1. **Proxy** (`src/proxy.ts` → `src/lib/supabase/proxy.ts`) runs on every request except static assets. It refreshes the Supabase session cookies (`getClaims()`), sends logged-out visitors to `/login?next=…`, and sends signed-in visitors away from `/login` and `/signup`. It is routing only, not authorization.
2. **Root layout** (`src/app/layout.tsx`) reads the user's settings (`getSettings()`) and puts the theme on `<html>` as `data-*` attributes, so the first paint is already themed. Because it reads the session outside `<Suspense>`, it exports `instant = false` (see [decisions.md](decisions.md)).
3. **Group layout** `(app)/layout.tsx` wraps pages in the app shell (sidebar on desktop, bottom nav on phones).
4. **Page** renders a static shell (header, tabs) and puts anything user-specific inside `<Suspense>` components that call `requireUser()` and the feature's queries.
5. **Mutations** are server actions called from `<form action>`. They re-check identity, validate with Zod, write through the user's Supabase client (RLS applies), `revalidatePath`, and either `redirect` or return a `FormState`.

## Routes

| Route | File | Notes |
|---|---|---|
| `/` | `(app)/page.tsx` | Today dashboard; `?edit=1` shows the layout editor |
| `/login`, `/signup` | `(auth)/…/page.tsx` | `?next=` (same-site paths only), `?error=confirm_failed` |
| `/auth/confirm` | `auth/confirm/route.ts` | Accepts `token_hash`+`type` or `code` |
| `/courses` | `(app)/courses/page.tsx` | Course list (archived folded away) |
| `/courses/timetable` | `(app)/courses/timetable/page.tsx` | Week view; `?week=YYYY-MM-DD` |
| `/courses/new`, `/courses/[id]`, `/courses/[id]/edit` | `(app)/courses/…` | Course CRUD and detail (class times) |
| `/courses/[id]/slots/new`, `/courses/[id]/slots/[slotId]/edit` | `(app)/courses/[id]/slots/…` | Class time forms |
| `/tasks` | `(app)/tasks/page.tsx` | `?status=open|done|all&due=any|overdue|today|week&course=<uuid>` |
| `/tasks/new` | `(app)/tasks/new/page.tsx` | `?course=<uuid>` preselects a course |
| `/tasks/[id]`, `/tasks/[id]/edit` | `(app)/tasks/[id]/…` | Detail with steps; edit form |
| `/settings` | `(app)/settings/page.tsx` | Theme, preferences, grade scale, account (change password) |
| `/grades` | `(app)/grades/page.tsx` | GPA per semester and overall |
| `/grades/[courseId]` | `(app)/grades/[courseId]/page.tsx` | Course grade, `?target=<letter>` for "what do I need" |
| `/grades/[courseId]/assessments/new`, `/…/[assessmentId]/edit` | `(app)/grades/[courseId]/assessments/…` | Assessment forms |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | Public; sends the reset email |
| `/update-password` | `(auth)/update-password/page.tsx` | Signed-in only (reset link or Settings) |

Error handling: `(app)/error.tsx` (signed-in pages), `src/app/error.tsx` (auth pages), `global-error.tsx` (root layout), per-widget `SectionErrorBoundary` (`catchError`), `(app)/not-found.tsx` (inside the shell) and `src/app/not-found.tsx`. Boundaries use `retry()`, this Next version's name. Full list: [17-ui-states-audit.md](17-ui-states-audit.md).

## Cache Components rules

Cache Components is enabled, which changes how server code must be written. These rules come from `node_modules/next/dist/docs/` (read them before using an API you're unsure of; this Next version differs from older ones).

- Anything that reads **cookies, headers, `searchParams` or `params`** must be inside `<Suspense>`. Pattern used everywhere: the page component renders the static parts and a `<Suspense fallback={…}>` around an async child that does the reading.
- Before reading the **clock** (`new Date()`), call `await io()` from `next/cache`, inside a `<Suspense>` component.
- `notFound()` inside `<Suspense>` streams the not-found UI with status 200 (plus `noindex`), not 404.
- Error boundaries receive `retry` (not `reset`).
- `usePathname()` in client components is fine; `useSearchParams()` would need Suspense, so pages pass parsed search params down as props instead.

## Data access layer

- `src/lib/supabase/server.ts`: `createClient()` per request, typed with `Database`. Never stored in a module variable.
- `requireUser()` (`src/features/auth/queries.ts`): the one identity check. Calls `getUser()` (verified with the auth server), cached per request with React `cache`, redirects to `/login`.
- Queries rely on RLS for row filtering, so they don't need to add `user_id` filters (inserts get `user_id` from the column default `auth.uid()`).
- Cross-user references are impossible by construction: child rows use composite foreign keys `(parent_id, user_id) → (id, user_id)`.
- Never use `getSession()` on the server; never use the secret key in the app.
