# Product overview

## The idea

Folium is personal software for one student's life, not a generic productivity tool. It pulls classes, deadlines and tasks into one app, and the student decides how it looks and what matters most. Opening it should answer "what do I need to do today?" at a glance.

It is also a portfolio project: every stage ends deployed and usable, so the project is worth showing even if it stops early.

The full plan, with scope and open questions, is in [../development/Folium-V1.md](../development/Folium-V1.md).

## Design principles

1. **Useful on day one.** Good enough to replace whatever the student uses today.
2. **Shippable at every step.** No stage is "half done".
3. **Customizable by design.** Theme tokens, user settings and a widget registry exist from the start, so customization is cheap.
4. **Private by default.** Every row belongs to one user and is protected by RLS.
5. **Mobile first.** The phone layout is designed first; desktop adapts.

## Status

| Stage | What | State |
|---|---|---|
| 1. Foundation | Next.js, strict TS, Biome, Vitest, CI, Supabase CLI, env validation, theme tokens, app shell | Done |
| 2. Auth and settings | Email sign-up/sign-in, profile, `user_settings`, theme and preferences screen | Done |
| 3. Courses and timetable | Course CRUD, weekly class times, week view, overlap warnings | Done |
| 4. Tasks and deadlines | Task CRUD, subtasks ("steps"), filters, quick add, due-date logic | Done |
| 5. Today dashboard | Widget registry, four widgets, customizable layout (show/hide/reorder) | Done |
| 6. Polish | Password reset, error/not-found pages and states audit, axe accessibility suite (all themes), e2e in CI, security review, demo seed, README screenshots | Done (not deployed yet) |
| 7. Grades (v1.1) | Course credits, assessments, grade scale preference, course grade, GPA by semester, "what do I need", Grades widget | Done |

## What a user can do today

- Sign up with email and password (confirmation email), sign in, sign out, reset a forgotten password, change password.
- Set theme (light/dark/system, five colour presets or a custom accent, font, density) and preferences (time zone, week start, 12/24-hour time, language placeholder). Applied on the first paint, per account.
- Add courses (name, code, colour, lecturer, room, semester), archive or delete them.
- Give courses weekly class times with an optional date range. Overlaps are allowed and flagged with a warning icon.
- See the week: a day-by-day agenda on phones, a Monday-to-Sunday grid on desktop (week start follows the preference).
- Add tasks (title, notes, course, due date with optional time, priority, status), with a one-level checklist of steps.
- Filter tasks by due window (overdue, today, this week), status and course; quick-add with only a title.
- Record assessments per course (weight, score out of a maximum), see the grade so far, what average is needed on the rest for a target letter, and the credit-weighted GPA per semester and overall, using a customizable grade scale (default Indonesian 4.0).
- Open the Today page: greeting, today's classes with "Now"/"Next", due soon, overdue, quick add. Show, hide and reorder the widgets.

## Deliberately not in v1

User-defined statuses/tags/fields, shareable themes, study timer, expenses, notes, reminders (email/push), PWA/offline, AI helper, Google sign-in (the profile trigger already handles Google metadata when it's added), translations (the language preference is stored but not applied).
