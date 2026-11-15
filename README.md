# Folium

A personal student dashboard: courses, a weekly timetable, tasks with deadlines, and a customizable **Today** page that answers "what do I need to do today?" at a glance. One student, their own data, their own look.

Built with **Next.js 16** (App Router, Cache Components), **Supabase** (Postgres, Auth, Row Level Security), **Tailwind v4**, **TypeScript** and **Zod**.

## Features

- **Today dashboard**: greeting, today's classes with "Now"/"Next", tasks due soon, overdue tasks, quick add. Show, hide and reorder widgets (drag, keyboard or up/down buttons).
- **Courses and timetable**: courses with colour, lecturer, room and semester; weekly class times with optional date ranges; a day-by-day agenda on phones and a week grid on desktop. Overlapping classes are allowed and flagged.
- **Tasks and deadlines**: due date with optional time, priority, status, course, notes and a checklist of steps. Filter by overdue / today / this week, status and course; quick add with just a title.
- **Personal by design**: light/dark/system mode, colour presets or a custom accent, font and density, all applied on the first paint. Time zone, week start and 12/24-hour preferences.
- **Private by default**: every row belongs to one user and is protected by RLS; email sign-up with confirmation.
- **Mobile first**: bottom navigation on phones, sidebar on desktop.

## Quick start

Requires [Bun](https://bun.sh) and Docker.

```bash
bun install
bunx supabase start            # local Postgres, Auth, Studio, Mailpit
cp .env.example .env.local     # set the URL and PUBLISHABLE_KEY printed by `bunx supabase status`
bunx supabase db reset         # migrations + demo data
bun dev                        # http://127.0.0.1:3000
```

Sign in with the demo account **`demo@folium.test` / `folium-demo-2026`**, or sign up: confirmation emails land in Mailpit at http://127.0.0.1:54324.

## Commands

| Command | |
|---|---|
| `bun dev` | Dev server |
| `bun run build` / `bun run start` | Production build / serve |
| `bun run typecheck` | Route types + `tsc` |
| `bun run lint` / `bun run format` | Biome |
| `bun run test` | Unit tests (Vitest) |
| `bun run test:db` | Database tests (pgTAP: RLS, constraints, triggers) |
| `bun run test:e2e` | End-to-end tests (Playwright; needs Supabase and a running app) |
| `bun run db:types` | Regenerate `src/types/database.ts` after a schema change |
| `bun run db:seed` | Rebuild the demo account |

## Project layout

```
src/app/            routes and layouts (thin)
src/features/       one folder per feature: schema, queries, actions, pure logic + tests, components
src/components/     app shell and shared UI
src/lib/            dates, env, Supabase clients, helpers
supabase/           migrations, pgTAP tests, seed, email template, local config
e2e/                Playwright tests
docs/documentation/ full documentation
```

## Documentation

Start at **[docs/documentation/00-start-here.md](docs/documentation/00-start-here.md)**. It maps every question to the right doc: architecture, a file-by-file codebase map, database, auth, theming, each feature, dates and time zones, the form/action pattern, testing, step-by-step recipes, known gotchas, and the decision log.

## Status

Stages 1–5 of the [v1 plan](docs/development/Folium-V1.md) are done (foundation, auth and settings, courses and timetable, tasks, Today dashboard). Next: polish and deployment.
