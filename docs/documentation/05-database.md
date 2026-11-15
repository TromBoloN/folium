# Database

Supabase Postgres. The schema lives only in `supabase/migrations/`; generated types in `src/types/database.ts` (`bun run db:types` after every schema change).

## Tables

All tables: `user_id` (owner), `created_at`, `updated_at` (kept by the `set_updated_at` trigger), RLS enabled.

### `profiles` (one per auth user)
`user_id` PK → `auth.users` (cascade), `display_name` ≤80, `avatar_url` ≤2048, `campus` ≤120. Created by the sign-up trigger. Readable/updatable only by its owner.

### `user_settings` (one per auth user)
`user_id` PK, `version` (settings shape version), `theme`, `preferences`, `dashboard_layout` — each `jsonb`, must be an object and under 64 KB. Created by the sign-up trigger. JSON holds **only overrides** of the defaults; see [07-settings-and-theming.md](07-settings-and-theming.md) and [10-today-dashboard.md](10-today-dashboard.md).

### `courses`
`id`, `name` (1–120), `code` ≤40, `color` (`#rrggbb`), `lecturer` ≤120, `room` ≤80, `semester` ≤60 (free text), `archived_at` (null = active). Unique `(id, user_id)` so children can reference it with a composite key.

`credits` `numeric(4,1)` 0–24, default 0 (0 = not in the GPA).

### `assessments` (graded work)
`course_id` → `courses (id, user_id)` cascade, `name` 1–120, `weight` `numeric(5,2)` >0–100 (% of the course grade), `max_score` >0 (default 100), `score` null (ungraded) or 0–`max_score`, `due_at` optional. Index `(user_id, course_id)`. See [16-grades.md](16-grades.md).

### `timetable_slots` (weekly class times)
`course_id` → `courses (id, user_id)` cascade, `weekday` 1–7 (ISO, 1 = Monday), `start_time`/`end_time` (`time`, local wall-clock; end > start), `location` ≤80 (falls back to the course room), `starts_on`/`ends_on` optional `date` range (end ≥ start).

Also `is_online` (bool) and `meeting_url` (http(s) only, ≤500). Unique `(id, course_id, user_id)` is the target for changes and attendance.

### `class_changes` (one-date exceptions)
`kind` `cancelled | moved | extra` (named check). cancelled/moved: `slot_id` + `original_date`, FK `(slot_id, course_id, user_id)` → slots, cascade on delete and update; moved needs at least one of `new_date`, `start_time`, `location`. extra: no slot, `new_date` + times, optional `label`. `note` ≤200. One change per `(slot_id, original_date)`.

### `class_breaks`
`label` 1–60, `starts_on`–`ends_on` inclusive, at most 120 days.

### `attendance`
`status` `attended | missed`. Either `slot_id` + `occurs_on` (the ORIGINAL date) or `change_id` (extra session); one row per occurrence. Cascades with its slot/change/course.

`courses` also has `lecturer_email` and `lecturer_phone` (format checks).

### `tasks` (tasks and their steps)
- `title` 1–200, `notes` ≤10,000.
- `course_id` → `courses (id, user_id)`, **on delete set null (course_id)** (deleting a course keeps its tasks).
- `parent_id` → `tasks (id, user_id)` cascade: set for subtasks ("steps").
- `due_at` (timestamptz) + `due_has_time` (bool). Date-only deadlines are stored as 23:59:59.999 local; see [11-dates-and-timezones.md](11-dates-and-timezones.md).
- `priority` text: `low | medium | high | urgent` (named CHECK `tasks_priority_check`).
- `status` text: `todo | in_progress | done` (named CHECK `tasks_status_check`).
- `completed_at`: kept in sync with `status` by a trigger; CHECK `(status = 'done') = (completed_at is not null)`.
- `position` (manual order among siblings).

Statuses and priorities are text + named CHECK constraints, not enums, so user-defined values can replace them later by dropping the constraint.

## Triggers and functions

| Name | Does |
|---|---|
| `set_updated_at` | Bumps `updated_at` on every update (all tables) |
| `handle_new_user` (on `auth.users` insert) | Creates `profiles` (name from provider metadata, truncated to 80; oversized avatar dropped) and `user_settings`. `security definer`; execute revoked from clients. |
| `tasks_sync_completed_at` | `status = done` sets `completed_at` (if empty); any other status clears it |
| `tasks_enforce_one_level` | A subtask can't have subtasks; a task with subtasks can't become a subtask (also prevents cycles) |

The initial migration also backfills profile/settings rows for users that existed before it.

## Security

- **RLS** on every table (six: profiles, user_settings, courses, timetable_slots, tasks, assessments); policies are `(select auth.uid()) = user_id` for the `authenticated` role.
- **Grants** are explicit: `anon` gets nothing; `authenticated` gets `select, update` on `profiles` and `user_settings` (rows are created and deleted by triggers/cascade), and full CRUD on `courses`, `timetable_slots`, `tasks`.
- **Composite foreign keys** make it impossible to point at another user's course or task, even with a forged id.
- Deleting the auth user cascades to everything.
- PostgREST note: the composite self-reference on `tasks` can't be embedded (`tasks!tasks_parent_fk` fails), so subtasks are loaded with a second query. The course embed works: `course:courses!tasks_course_fk(...)`.

## Migrations

| File | Contents |
|---|---|
| `20261115051844_initial_schema.sql` | All five tables, checks, indexes, triggers, sign-up bootstrap, RLS, grants |
| `20261115064528_task_due_time.sql` | `tasks.due_has_time` + `tasks_due_time_needs_date` check; `(parent_id, position, created_at)` index |
| `20261115075519_grades.sql` | `courses.credits` + range check; `assessments` with composite FK, checks, RLS, grants |
| `20261115145746_schedule_changes.sql` | `class_changes`, `class_breaks`, RLS, grants |
| `20261115145748_attendance_and_links.sql` | `attendance`; slot `is_online`/`meeting_url`; lecturer contact columns |

Rules: schema changes only through new migration files; never edit a migration that has been applied anywhere shared; every new table gets `user_id`, timestamps, RLS, policies in the same migration and a pgTAP test proving isolation.

## Tests

`supabase/tests/database/` (pgTAP, `bun run test:db`, 88 checks; `schedule.test.sql` covers change shapes, breaks, attendance and isolation; `grades.test.sql` covers credits, assessment checks and isolation): cross-user isolation for read/insert/update/delete and cross-user course links; sign-up trigger with oversized metadata; exact grants for both roles; settings JSON size cap; one-level subtasks; time-needs-date.

## Seed

`supabase/seed.sql` builds the demo account (see [02-local-development.md](02-local-development.md#demo-account)). It inserts into `auth.users` and `auth.identities` directly with a bcrypt password; token columns must be `''`, not NULL, or GoTrue fails to sign in. It deletes the demo user first, so it's safe to re-run.
