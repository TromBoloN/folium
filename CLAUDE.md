# Folium — Claude Code Instructions

Personal student dashboard (courses, timetable, tasks, customizable "Today" view). Prioritize real daily utility, fast workflows, and customizable themes, preferences, and widgets.

## Commands
- `bun dev` — run dev server
- `bun run typecheck` | `bunx biome check .` | `bun run test` — typecheck, lint/format, unit tests
- `bunx supabase start` / `stop` — local Supabase (Docker)
- `bunx supabase migration new <name>` | `migration up` | `db reset` — migrations
- `bunx supabase test db` — pgTAP RLS tests
- `bunx supabase gen types typescript --local > src/types/database.ts` — regenerate after every schema change

## Architecture & Invariants
- **Boundaries:** Keep `src/app/` thin (routes/layouts only). Put feature code in `src/features/<name>/{components,actions,schemas,queries}`. Supabase clients live in `src/lib/supabase/`; validated env in `src/lib/env.ts`.
- **Data & Actions:** Components never call Supabase directly—use feature `queries` and `actions`. Server actions validate with Zod and return `{ ok, error }` instead of throwing.
- **Auth & Secrets:** Verify server identity with `getUser()` or `getClaims()`, never `getSession()`. Never expose secret or `service_role` keys in client code or `NEXT_PUBLIC_*`.
- **Schema & RLS:** Only change schema via new `supabase/migrations/` files (never edit applied migrations or Studio schema). Every table requires `user_id`, `created_at`, `updated_at`, RLS enabled, policies in the same migration, and a pgTAP test in `supabase/tests/database/` proving cross-user isolation. Use `text` + named `CHECK` constraints (not Postgres enums) for statuses/priorities.
- **UI & Domain:** Mobile-first layouts with empty, loading, and error states. Use CSS-variable theme tokens only—no hardcoded colors, radii, or fonts. Merge versioned JSON settings over defaults on read. Store UTC timestamps; display/interpret in `Asia/Makassar`.
- **Protected files:** Never edit `src/types/database.ts` by hand. Leave `<!-- BEGIN:nextjs-agent-rules -->` untouched.

## Workflow
- record real architectural decisions in `docs/documentation/decisions.md`.
- Before finishing a task, ensure `bun run typecheck`, `bunx biome check .`, `bun run test`, and `bunx supabase test db` all pass.
- End every message with a single-line recommended commit message.
- **Testing:** Test pure logic, parsers, and route handlers in Vitest (`bun run test`) and RLS in pgTAP (`bunx supabase test db`). Do NOT spin up ad-hoc Playwright scripts, production builds, or screenshots unless explicitly asked.