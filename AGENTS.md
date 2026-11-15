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

## Workflow
- log real decisions in `docs/documentation/decisions.md`.
- Pass before finishing: `bun run typecheck`, `bunx biome check .`, `bun run test`, `bunx supabase test db`.
- dont commit anything
- End every message with a 1-line recommended commit message.