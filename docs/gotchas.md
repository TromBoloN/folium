# Known issues and gotchas

Each of these has already cost time once.

## Environment

- **Browse the dev app at `127.0.0.1`, and keep `allowedDevOrigins: ["127.0.0.1"]`.** Supabase's local `site_url` is `127.0.0.1:3000`, so auth links land there. Without the setting, `next dev` blocks its HMR WebSocket from that origin and **no client component hydrates** (forms fall back to full-page posts, the dashboard editor does nothing). Symptom in the dev log: "Blocked cross-origin request to Next.js dev resource /_next/hmr".
- **A long-running dev server can go stale** after big changes (config, PostCSS, many files). If client behaviour is odd, restart `bun dev`.
- **`next dev` rewrites `AGENTS.md`**, appending a `nextjs-agent-rules` block whenever it's missing. Commit it; removing it just brings it back.
- **Biome excludes Markdown** on purpose; `biome check --write` once reflowed the hand-written docs.
- **`biome migrate` set `"preset": "none"`** (all lint rules off). It must stay `"preset": "recommended"`.
- **Never redirect the Supabase CLI output straight into the types file.** A failed `supabase gen types … > src/types/database.ts` empties it. `bun run db:types` writes to a temp file first.
- **`pgrep -f`/`pkill -f` with a pattern that appears in your own command line kills your own shell.** Find servers by port instead (`ss -ltnp | grep :3001`).

## Next.js 16 with Cache Components

- Reading cookies/`searchParams`/`params` outside `<Suspense>` is a build error, except in the root layout (`instant = false`).
- `new Date()` in a server component needs `await io()` first.
- `notFound()` inside Suspense returns **status 200** with the not-found UI and `noindex`. Accepted: pages are private.
- Error boundaries use `retry()`, not `reset()`.
- **A server component can't pass a function as a child to a client component** (e.g. render props). It fails at render with "Functions are not valid as a child of Client Components".
- **Dev-only 500**: in `next dev`, a no-JS form submission whose action returns an error state can throw `InvariantError: … cookies or mutableCookies`. The check exists only in Next's dev code path; production is fine. Re-test after upgrading Next.

- **A `"use server"` file must not import from a `"use client"` file.** On the server, a client module's exports are client references, not callable functions. Shared helpers go in plain modules (e.g. `parseGradeScaleField` lives in `grades/scale.ts`).
- **Comparing settings values with `!==`** treats arrays/objects as always changed; `diffFromDefaults` compares by JSON for that reason.

## Forms

- React 19 resets uncontrolled fields after a form action, even on error. Always echo `values` back (see [architecture.md](architecture.md#forms-and-server-actions)).
- In production, a **no-JS** submission doesn't render the action's returned state into the HTML (no error text or "Saved."). The action still runs. With JS everything works.

## Data

- PostgREST can't embed the composite self-reference on `tasks`; load subtasks with a second query.
- Date-only deadlines are pinned to the time zone in effect when saved (a later zone change can show them a day off).
- The language preference is stored but not applied: `<html lang>` stays `en` until translations exist.
- The seed hardcodes the demo user's UUID and the Docker container name `supabase_db_folium-web` (from `project_id` in `supabase/config.toml`).

## Testing

- E2E tests must wait for hydration before clicking client controls (the dashboard editor exposes `form[data-ready]`); otherwise clicks land on server-rendered buttons and do nothing.
- The confirmation link goes to port 3000 even when testing another port; `signUp()` navigates back to `E2E_BASE_URL`.
- pgTAP tests must scope counts to their own users; the local database may hold other accounts.
- After clicking a link, wait for the new URL before filling fields that also exist on the old page (login and forgot-password both have "Email"), or the test types into the page that's leaving.
- dnd-kit's live region keeps only the latest announcement, and picking up an item immediately announces its starting position.
- Tests that count rows must ignore other users' data in the shared local DB (`where id = …`, not `where name = …`).
- Playwright `getByRole("link", { name: "Today" })` matches both the main nav and the due filter chip; scope to a navigation (`getByRole("navigation", { name: "Due" })`).

## Design and motion

- **Never fade in from `opacity: 0` above the fold.** Chrome doesn't count an element at opacity 0 as painted for Largest Contentful Paint, so the Today page lost 12 Lighthouse points until the `reveal` keyframe started at `0.01`.
- **Count-ups must not re-render React per frame.** `CountUp` writes digits to its text node directly and ends on the same text React rendered; a `setState` per frame cost ~200ms of blocking time on a throttled phone.
- **axe scans run with reduced motion emulated**, or they catch text mid-fade and report false contrast failures.
- **Custom properties resolve where they're declared.** Setting `--hue` on a child doesn't re-theme it unless the tokens are re-declared there (they are, on `[data-preset]`).
- **Accent colours as text**: a custom accent can be very light (yellow). Text tinted with it is mixed at most 50% with `--foreground` so large text stays above 3:1.
- **Links with an `aria-label` must contain their visible text** (axe `label-content-name-mismatch`). Prefer visible text plus an `sr-only` span.
- **Full-page Playwright screenshots** show fixed elements (sidebar, ambient, bottom nav) only over the first viewport or mid-page. That's a capture artefact, not a layout bug.

## Sheets, shortcuts and client state

- **No catch-all page in `@modal`.** `[...catchAll]/page.tsx` caused an endless segment-prefetch loop in Next 16.4. Sheets close themselves when the pathname changes instead (see [decisions.md](decisions.md)).
- **`usePathname()` changes when a sheet opens.** Use `usePagePath()` for anything about the page underneath (nav highlight, page transition key).
- **Don't update React context right after hydration.** It makes still-hydrating Suspense boundaries client-render (hidden duplicate content). Use the external `client-data-store`.
- **Forms remount after each result** (`key={state}`), so effects that react to a result must start from an empty ref, not the current state.
- **e2e: wait for `html[data-hydrated]`** (`waitForHydration`) before clicking things that should use the JS path (toasts, sheets, undo). An early click falls back to the no-JS form post, or is lost.
- **Single-key shortcuts** (N) are ignored while typing in a field or when a dialog is open.

## Auth, lint and styling (added 2026-11-16)

- **A signed token can outlive its account.** The proxy trusts `getClaims()` (verified locally with ES256), pages trust `getUser()` (asks the auth server). After the account is deleted (or the local demo is reseeded), `/` sent the browser to `/login` and the proxy sent it back: an endless reload. The proxy now confirms with `getUser()` on `/login` and `/signup` only, and signs a dead session out.
- **`biome check --unsafe` rewrote date comparisons into `Math.max`/`Math.min`.** On `"YYYY-MM-DD"` strings that returns `NaN`. Compare civil dates as strings (`[a, b].sort()`), and review unsafe fixes.
- **Tailwind's `appearance-none` beats layered CSS.** The customizable select (`appearance: base-select`) lives in unlayered CSS in `globals.css` so the utility on `NativeSelect` can't cancel it.
- **Native `<select>` options inherit the page's text colour**, while some systems draw the popup light: white on white in dark mode. Options get explicit `--popover` colours.
- **`playwright/.auth/` holds a live session.** It's git-ignored; Biome follows `.gitignore`, so a tracked copy also fails `biome ci` on formatting.
- **`.ics` lost its semicolon escaping without anyone noticing.** `escapeText` shipped as `.replace(/;/g, ";")` and its test expected the same unescaped output; a backslash before `;` had been dropped while writing the file through a shell command, and the test was written the same way. Write escape-heavy code and its expectations with an editor (or `String.raw`), and test each special character on its own (`ics.test.ts` does now).
- **User-entered links are sanitised when read, not only in forms.** Rows can be written through the API without the app's Zod schemas, and the database only checks a `^https?://` prefix. `lib/safe-links.ts` (`safeHttpsUrl`, `whatsappLink`, `mailtoLink`) is applied in `courses/queries.ts`, at every href and in the `.ics` `URL:` line.
- **Module state in a `"use client"` file still exists on the server.** `client-data-store.ts` ignores writes and returns `null` when there's no `window`, so one user's courses can never be shared across server requests.
- **A `"use client"` module's exports are client references on the server.** Helpers a server file needs (like `describedBy`) must not move into one; `Field` is a client component, and only client forms import it.

