# Decisions

Short records of real choices, newest first. Each says what was decided, why, and what it costs.

## 2026-11-15: Deadlines are a date with an optional time

**Decision.** `tasks.due_at` is one instant. A date-only deadline is stored as 23:59:59.999 on that date in the user's time zone, and `due_has_time = false` says to show only the date. A check constraint stops a time without a date.

**Why.** One column drives sorting, "overdue" and the list filters for both kinds of deadline, and the flag means a real 23:59 deadline isn't mistaken for "end of day".

**Cost.** Date-only deadlines are pinned to the zone in effect when saved. If a user later changes time zone, an old date-only deadline can show as the day before or after. Re-saving the task fixes it; revisit if people actually move zones.

**Rules** (pure and tested in `src/features/tasks/due.ts`): overdue once `due_at` has passed (never for done tasks); "today" means the local due date is today; "soon" means the next two days.

## 2026-11-15: Time zone is a user preference

**Decision.** `preferences.timeZone` (IANA, default `Asia/Makassar`) decides "today", week boundaries and when date-only deadlines end. Stored in the settings JSON, so no migration.

## 2026-11-15: Forms echo submitted values back on error

**Decision.** Every form action returns the submitted values on failure, and the form uses them as each field's `defaultValue`, remounting with a `key` so selects pick them up.

**Why.** React 19 resets uncontrolled fields when a form action finishes, even when it returns an error, so a rejected save would wipe what the user typed. Checked in a real browser (Playwright) for course, class-time, settings and task forms.

## 2026-11-15: Subtasks are tasks with a parent, loaded separately

**Decision.** Subtasks are rows in `tasks` with `parent_id`, one level deep (a trigger from the initial migration enforces it). The UI treats them as a checklist ("Steps"). They're loaded with a second query, because PostgREST can't embed the composite self-reference `(parent_id, user_id) → (id, user_id)`.

## 2026-11-15: Overlapping classes are allowed and flagged, not blocked

**Decision.** Saving a class time that overlaps another is allowed. Overlaps are shown with a small warning icon in the week view, the course list and the course page.

**Why.** Real timetables overlap: provisional schedules, sitting in on a second class, a lab that sometimes runs late. Blocking the save would force students to lie to the app.

**Rules.** Two slots clash when they're on the same weekday, their times overlap (back-to-back doesn't count), and their optional date ranges meet. Archived courses never clash. The week view only flags clashes that happen on that actual date. Logic is in `src/features/timetable/logic.ts`.

## 2026-11-15: Class times are wall-clock times in Asia/Makassar

**Decision.** `timetable_slots` stores weekday plus `time` (no zone) and optional `date` bounds. They mean local time in the app's zone. "Today" and the current week are computed in `Asia/Makassar` (`src/lib/dates.ts`), never in the server's zone.

**Why.** A class at 08:00 is at 08:00 whatever the server's zone is, and Indonesia has no DST to complicate weekly repeats.

## 2026-11-15: Not-found inside Suspense returns status 200

**Decision.** Course pages call `notFound()` inside `<Suspense>`, so the response streams the not-found UI with a `noindex` tag but keeps status 200.

**Why.** The page shell (header, back link) streams before the course loads. Getting a real 404 would mean blocking the whole page on the query. The pages are private, so the status code has no SEO impact; RLS already guarantees nothing of another user's course is returned.

## 2026-11-15: Known Next.js dev-mode bug on no-JavaScript form errors

**Observed.** In `next dev` only, submitting a form with JavaScript off, when the action returns an error state, can end in a 500 with `InvariantError: Received an underlying cookies object that does not match either cookies or mutableCookies`. The check lives in `makeUntrackedCookiesWithDevWarnings` (`next/dist/server/request/cookies.js`), which production doesn't use. The same requests pass against `next start`.

**Action.** None in app code. Re-test after upgrading Next.

## 2026-11-15: Root layout blocks to apply the saved theme

**Decision.** The root layout reads the user's settings and puts the theme on `<html>` as data attributes, with `export const instant = false`.

**Why.** The plan requires the saved theme on the server render, with no flash of the wrong colours. With Cache Components, a session read outside `<Suspense>` isn't allowed unless the segment opts out of instant validation, and `<html>` can't be wrapped in `<Suspense>`.

**Cost.** Every full page load waits for one `getClaims()` and one `user_settings` query before streaming. Client-side navigations don't re-render the root layout, so they aren't affected. `instant = false` on the root also turns off static-shell validation app-wide; deeper pages can still opt in with `instant = true`.

**Alternative considered.** A cookie copy of the theme plus an inline script that sets the attributes before paint (the next-themes approach). It keeps a static shell, but the server render no longer carries the theme and there are two sources of truth. Revisit if first-load latency becomes a problem.

## 2026-11-15: Theme tokens come from one hue, light and dark via `light-dark()`

**Decision.** Every colour token in `globals.css` is `light-dark(<light>, <dark>)` built from `--hue` and `--chroma`. A preset only sets those two numbers. Mode sets `color-scheme` (`light`, `dark`, or `light dark` for system).

**Why.** One token block instead of a duplicated dark block, "system" mode with no JavaScript, and presets that are two numbers. A custom accent is an inline `--primary` override with a contrast-checked foreground.

**Cost.** Needs `light-dark()` (all evergreen browsers since 2024).

## 2026-11-15: Settings store only overrides, merged per field

**Decision.** `user_settings.theme` and `.preferences` hold only the fields that differ from the defaults. Reading validates each field on its own and falls back to its default.

**Why.** Changing a default reaches everyone who never touched that setting. Adding a setting needs no migration, and one bad stored value can't reset the others.

## 2026-11-15: Language preference is saved but `lang` stays `en`

**Decision.** The language setting is stored, but `<html lang>` stays `en`.

**Why.** `lang` must match the page text, or screen readers pronounce English as Indonesian. Apply the preference when translations ship.

## 2026-11-15: Email confirmation uses a token-hash template

**Decision.** The confirmation email links to `/auth/confirm?token_hash=…&type=email` (template in `supabase/templates/confirmation.html`). The route also accepts `?code=` from Supabase's default template.

**Why.** Token-hash links work on any device. PKCE `?code=` links only work in the browser that started sign-up, and students often open email on their phone.

**Cost.** Hosted projects need the same template set in the Supabase dashboard.

## 2026-11-15: Biome replaces ESLint, Markdown excluded

**Decision.** Biome lints and formats code, with Markdown excluded from formatting.

**Why.** One fast tool for lint and format, as AGENTS.md specifies. Docs are written by hand and shouldn't be reflowed.
