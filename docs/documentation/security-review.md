# Security review

Date: 2026-11-15. Scope: every server action, route handler and proxy rule, every RLS policy and grant, redirects, input validation, secret-key usage, and whether any page can show another user's data.

**Result:** no way found for one user to read or change another user's data. Four issues fixed in this pass (F1–F4), the rest are accepted or noted for later.

## How it was checked

- Read every `"use server"` file and listed each exported action with whether it verifies identity (script output below).
- Read every migration's RLS policies and grants; pgTAP asserts them (`bun run test:db`, 52 checks including exact grants per role).
- Searched `src/` for secret/service-role keys and for redirect targets that come from input.
- End-to-end tests with two accounts try to open the other's course, task and grades pages (`e2e/*.spec.ts`).

## Server actions

| Action | Identity check | Validation | Data access |
|---|---|---|---|
| `signIn`, `signUp`, `requestPasswordReset` | public by design | Zod (`auth/schemas.ts`) | Supabase Auth |
| `signOut` | session-scoped | — | Supabase Auth |
| `updatePassword` | `requireUser()` | Zod (length, match) | `auth.updateUser`, needs a recent sign-in (F3) |
| `updateSettings` | `auth.getUser()` | Zod, per-field | own `user_settings` row, `eq(user_id)` + RLS |
| `saveDashboardLayout` | `requireUser()` | ids filtered to known widgets | own row, `eq(user_id)` + RLS |
| courses: `create/update/setArchived/delete` | `requireUser()` | Zod (`courses/schema.ts`), uuid ids | RLS; update/delete check affected rows |
| timetable: `createSlot/updateSlot/deleteSlot` | `requireUser()` | Zod (`timetable/schema.ts`) | RLS + composite FK to own course |
| tasks: 8 actions | `requireUser()` | Zod (`tasks/schema.ts`), uuid ids | RLS + composite FKs (course, parent) |
| grades: `create/update/deleteAssessment` | `requireUser()` | Zod (`grades/schema.ts`) | RLS + composite FK to own course |

Next.js rejects server-action requests whose `Origin` doesn't match the host, which covers CSRF for all of these.

## Database

- RLS is enabled on all six tables (`profiles`, `user_settings`, `courses`, `timetable_slots`, `tasks`, `assessments`), with one policy per operation: `(select auth.uid()) = user_id`, for `authenticated` only.
- `anon` has no table privileges. `authenticated` has `select, update` on `profiles`/`user_settings` (rows are created by a trigger and deleted by cascade) and full CRUD on the rest. Asserted exactly by pgTAP.
- Child rows use composite foreign keys `(x_id, user_id) → x(id, user_id)`, so a forged id pointing at another user's course or task fails with `23503`, even though RLS would allow the insert of the child row itself. Tested for slots, tasks and assessments.
- `handle_new_user` is `security definer` with `search_path = ''` and execute revoked from clients; it truncates/drops oversized provider metadata so sign-up can't be broken by it.
- Values used in CSS (`courses.color`, the theme accent) are validated as `#rrggbb` (DB check constraint / Zod on read), so they can't inject CSS through the `--course`/`--primary` inline styles.
- No `dangerouslySetInnerHTML` anywhere; user text is rendered by React (escaped).

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | Medium | **Open redirect via control characters.** `safeNextPath` accepted `/\t/evil.com`; browsers strip tabs/newlines, turning it into `//evil.com`. Affects `?next=` on sign-in and `/auth/confirm`. | **Fixed**: whitespace and control characters are rejected (`auth/schemas.ts`), with tests. |
| F2 | Low | `/auth/confirm` passed the `type` query parameter to Supabase without checking it. | **Fixed**: only known email link types are accepted (`EMAIL_OTP_TYPES`). |
| F3 | Medium | **Password change with a stolen session.** Anyone holding a session cookie could set a new password without proving it's them. | **Fixed**: `secure_password_change = true` (needs a recent sign-in; the reset link counts as one) and a friendly `reauthentication_needed` message. **Also enable it in the hosted project** (Authentication → Providers → Email → Secure password change). |
| F4 | Low | **No security headers**: the app could be framed (clickjacking). | **Fixed**: `next.config.ts` sends `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. |
| F5 | Info | No full Content-Security-Policy (script/style sources). Next's inline scripts need nonces, which conflicts with the static shell under Cache Components. | Accepted for now; revisit before handling third-party content. |
| F6 | Info | No app-level rate limiting on server actions. A signed-in user can only write their own rows (row and JSON size limits apply); auth endpoints are rate-limited by Supabase. | Accepted. |
| F7 | Info | `signUp` builds `emailRedirectTo` from the request `Origin`. Next's same-origin check for actions and Supabase's redirect allow-list both constrain it. | Accepted. |
| F8 | Info | `getDashboardLayout`/`getDisplayName` rely on RLS alone (no explicit `user_id` filter). Safe while RLS is on (tested); an explicit filter would be defence in depth. | Noted. |
| F9 | Info | The demo seed creates a confirmed account with a published password. | Local only. **Never run `supabase/seed.sql` against production** (stated in the file and in 02-local-development.md). |
| F10 | Info | HSTS isn't set by the app. | Left to the host (Vercel sets it on its domains). |

## Secrets

- The app uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (validated in `src/lib/env.ts`). No secret or service-role key appears anywhere in `src/` (searched).
- CI uses placeholder public values for the build and the local stack's own keys for e2e.
- Server identity is `getUser()` (verified with the auth server) or `getClaims()` (JWT verification); `getSession()` is never used on the server.

## Can a page show another user's data?

No. Every query runs with the signed-in user's session, so RLS filters rows; detail pages return `notFound()` when RLS hides the row. Covered by:
- pgTAP: read/insert/update/delete isolation for every table, cross-user links rejected.
- e2e: a second user opening the first user's course, task and grades pages sees "Not found" and none of the data (`e2e/tasks.spec.ts`, `e2e/grades.spec.ts`, plus the earlier courses suite).
