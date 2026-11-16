# Folium

Personal student dashboard: courses, timetable (with one-off schedule changes),
tasks, grades, and a customizable "Today" view. Priorities: real daily
usefulness, fast workflows, customizable theme, preferences and widgets.

## Commands
- `bun dev` | `bun run build` (production build; the only place Cache Components errors show)
- `bun run typecheck` | `bunx biome check .` | `bun run test` (Vitest)
- `bunx supabase start` / `stop` (local Supabase, Docker)
- `bunx supabase migration new <name>` | `migration up` | `db reset` | `bun run db:seed`
- `bunx supabase test db` (pgTAP RLS tests)
- `bun run db:types` after every schema change. Use the script, never a raw
  `gen types > file` (a failed run empties the file)
- `bun run test:e2e` (Playwright; see Testing rules)

## Architecture and invariants
- **Boundaries:** `src/app/` is thin (routes and layouts only). Feature code lives in
  `src/features/<name>/{components,actions,schemas,queries}`. Supabase clients in
  `src/lib/supabase/`, validated env in `src/lib/env.ts`.
- **Data and actions:** components never call Supabase directly; use feature
  `queries` and `actions`. Server actions validate with Zod and return `{ ok, error }`.
  Forms must keep working without JavaScript.
- **Auth and secrets:** check identity with `getUser()` or `getClaims()`, never
  `getSession()`. Secret / service_role keys never reach client code or `NEXT_PUBLIC_*`.
- **Schema and RLS:** change schema only through new `supabase/migrations/` files
  (never edit applied migrations or use Studio for schema). Every table has `user_id`,
  `created_at`, `updated_at`, RLS enabled, policies in the same migration, and a pgTAP
  test in `supabase/tests/database/` proving cross-user isolation. Statuses and
  priorities are `text` + named CHECK constraints, not enums.
- **Schedule:** every screen that shows classes (cards, by-day, week, Today widgets,
  hero, overlap warnings, .ics) gets occurrences from
  `src/features/schedule/occurrences.ts`. Never merge slots and changes by hand.
- **Next.js 16:** Cache Components is on; anything reading cookies, headers or
  searchParams must be inside `<Suspense>`. The request hook is `proxy.ts`, not middleware.
- **UI:** mobile-first, with empty, loading and error states. Theme tokens only; no
  hardcoded colours, radii or fonts. Animate only transform and opacity, and honour the
  motion setting and `prefers-reduced-motion`. Settings are versioned JSON merged over
  defaults on read. Themes are packs in `src/features/themes/packs/`; follow `docs/themes.md`
  (cards use `.tile`, floating surfaces `.panel`, pills `rounded-pill`, circles `rounded-full`).
- **Time:** store UTC. Interpret and display in the user's `preferences.timeZone`
  (default Asia/Makassar). Never hardcode a zone.
- **Protected:** never hand-edit `src/types/database.ts`. Leave the
  `<!-- BEGIN:nextjs-agent-rules -->` block untouched.
- Read `docs/gotchas.md` before touching sheets, toasts,
  hydration or Cache Components.

## Workflow
- Never run state-changing git commands (commit, push, branch, reset, stash). The user commits.
- Record real decisions in `docs/decisions/` (`backend.md` or `frontend.md`, newest first, with a status line); open questions go in its `README.md`.
- Before finishing: `bun run typecheck`, `bunx biome check .`, `bun run test` and
  `bunx supabase test db` pass. Also `bun run build` if you added or changed routes.
- When a task is done, end with one suggested Conventional Commits line.
- Update docs if you add something worth noting, especially `docs/MAP.md` for new features

## Testing and cost rules
- Logic, parsers and route handlers: Vitest. RLS: pgTAP.
- E2E: if you change a flow an existing spec covers, update and run only that spec
  (`--reporter=dot --workers=2`). Never run the full suite or the axe matrix unless asked.
  No screenshots or ad-hoc Playwright scripts unless asked. E2E only ever targets the
  local Supabase.
- Keep command output short (tail/grep), don't re-read files already in context, and
  stop after one verification run.