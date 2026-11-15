# Folium

Personal student dashboard (courses, timetable, tasks, customizable "Today" view).
Prioritize daily utility, fast workflows, and customization (themes, preferences, widgets).

## Stack & Commands
Package manager: `bun`. Stack: Next.js App Router, strict TS, Tailwind v4 (CSS-variable tokens), shadcn/ui, dnd-kit, date-fns, Supabase (Postgres, Auth, RLS, pgTAP), Zod, Vitest, Biome.

- `bun dev` — dev server
- `bun run typecheck` | `bunx biome check .` | `bun run test` — verify code
- `bunx supabase start` / `stop` — local DB (Docker)
- `bunx supabase migration new <name>` | `migration up` | `db reset` — migrations
- `bunx supabase test db` — RLS pgTAP tests
- `bunx supabase gen types typescript --local > src/types/database.ts` — run after every migration

## Boundaries
- `src/app/` — thin routes/layouts only
- `src/features/<name>/` — `components/`, `actions/`, `schemas/`, `queries/`
- `src/lib/supabase/` — browser, server, proxy clients
- `src/lib/env.ts` — Zod env validation
- `src/types/database.ts` — generated; never edit manually
- `supabase/tests/database/` — pgTAP RLS tests

## Rules
- **Schema & RLS:** New migrations only; never edit applied migrations or Studio schema. Every table needs `user_id`, `created_at`, `updated_at`, RLS + policies in the same migration, and a pgTAP cross-user isolation test.
- **Data & actions:** Components never import Supabase directly—use feature `queries/` and `actions/`. Server actions validate with Zod and return `{ ok, error }` (never throw).
- **Auth & secrets:** Server identity via `getUser()` or `getClaims()`, never `getSession()`. Never put secret or `service_role` keys in client code or `NEXT_PUBLIC_*`.
- **UI & tokens:** Mobile-first; always handle empty, loading, and error states. Use CSS-variable theme tokens only—no hardcoded colors, radii, or fonts.
- **Domain:** Use `text` + named `CHECK` constraints (not Postgres enums) for statuses/priorities. Merge versioned JSON settings over defaults on read. Store UTC timestamps; display/interpret in `Asia/Makassar`.

## Current stage
Stages 1–6 of the v1 plan are done (foundation, auth + settings, courses + timetable, tasks, Today dashboard, polish: password reset, error/not-found pages, axe accessibility suite, e2e in CI, security review, demo seed, README screenshots), plus grades (credits, assessments, grade scale, GPA, Grades widget). Next: deploy to a hosted Supabase project + Vercel. Read `docs/documentation/00-start-here.md` before exploring the code.

## Workflow
- log real decisions in `docs/documentation/decisions.md`.
- Pass before finishing: `bun run typecheck`, `bunx biome check .`, `bun run test`, `bunx supabase test db`.
- dont commit anything
- End every message with a 1-line recommended commit message.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
