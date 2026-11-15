# Tasks and deadlines

Code: `src/features/tasks/`. Routes under `/tasks`.

## Model

A task has a title, optional notes, optional course, optional deadline (date with optional time), priority (`low | medium | high | urgent`), status (`todo | in_progress | done`). Subtasks ("steps") are `tasks` rows with `parent_id`, one level deep, shown as a checklist on the task page. Steps only use title + done.

## Deadlines

A date-only deadline is stored as the **end of that day (23:59:59.999) in the user's time zone**, with `due_has_time = false`. A timed deadline stores that local time, `due_has_time = true`. One instant (`due_at`) drives sorting, filters and "overdue" for both kinds. Details and conversions: [11-dates-and-timezones.md](11-dates-and-timezones.md).

## Due-date logic (`due.ts`, tested in `due.test.ts`)

| Function | Rule |
|---|---|
| `dueState(task, now, tz)` | `none` (no deadline or done) · `overdue` (deadline passed) · `today` (local due date is today) · `soon` (next `SOON_DAYS` = 2 days) · `later` |
| `dueWindowRange(window, now, tz, weekStart)` | `overdue`: before now (caller excludes done) · `today`: the whole local day · `week`: today through the last day of the user's week |
| `formatDue(due, now, tz, timeFormat)` | "Today", "Tomorrow 14:30", "Yesterday", "Mon 23 Nov", "3 Jan 2027 9:00 AM" |
| `compareTasks` | Earliest deadline first, no deadline last, then higher priority, then oldest |
| `dueAtFrom`, `dueParts`, `dayBounds` | Local date/time ↔ instant |

A timed deadline earlier today that has passed is `overdue`, not `today`.

## List (`/tasks`)

- **Filters live in the URL**: `status` (`open` default, `done`, `all`), `due` (`any`, `overdue`, `today`, `week`), `course` (uuid). Parsed by `taskFiltersSchema`, which falls back to defaults on junk instead of erroring.
- Open tasks are **grouped**: Overdue, Today, Next few days, Later, No deadline. Done tasks are listed newest-completed first.
- **Quick add**: title only. When the list is filtered to a course, the new task gets that course.
- Each row: round checkbox (`setTaskStatus`, works without JS), title, course dot, due label (overdue = destructive colour, today = warning colour), High/Urgent flag, "In progress" badge, step progress.

## Detail and edit

`/tasks/[id]` shows status, due, priority, course, notes, and the steps checklist (add, tick, delete). Actions: mark done/reopen, edit, delete (confirm; also deletes steps). `/tasks/new?course=<id>` preselects a course. The edit form shows the deadline back in the user's zone (`dueParts`).

## Queries and actions

- `listTasks(filters, ctx)`: top-level tasks with the course embedded; steps loaded in a second query (see [05-database.md](05-database.md#security)). Due windows become `due_at` range filters in SQL.
- `getTask(id)`: one top-level task or `null` (bad uuid, missing, or another user's).
- `listOpenTasks()`: all open tasks, cached per request; the dashboard widgets share it.
- Actions revalidate `/` with `"layout"` so both `/tasks` and the dashboard refresh. `addSubtask` maps the one-level trigger error (23514) to "Steps can't have their own steps."

## Quick add (one line)

`parseQuickAdd(text, { today, nowMinute, weekStart })` in `parse.ts` (tested in `parse.test.ts`). Recognised pieces are removed from the title; the first of each kind wins.

| Kind | Examples |
|---|---|
| Date | `today`, `tomorrow`/`tmr`, `fri` (next Friday, never today), `next tue` (that day next week), `next week` (its first day), `in 3 days`, `in 2 weeks`, `23 nov`, `nov 23rd`, `23/11` (day/month; next year if passed), `2026-12-01`; `due`/`on`/`by` before a date are dropped |
| Time | `5pm`, `5:30pm`, `5 pm`, `17:00`, `noon`; `at`/`@` dropped. A time with no date is today, or tomorrow if it has passed |
| Course | `#ING101`, `#studygroup` (`matchCourse`: exact code/name, then a unique prefix; unknown stays in the title) |
| Priority | `!low`, `!med`, `!high`, `!urgent`, `!!` (high), `!!!` (urgent) |

Used by the quick-add field (Today, Tasks) and the command palette (N to add, Ctrl/⌘K to search). `ParsePreview` shows chips for what was understood.

## Changing tasks in place

All in `TaskOpsProvider` (`components/task-ops.tsx`), each with an Undo toast:

- **Complete / reopen**: the checkbox (`task-checkbox.tsx`) fills and the row leaves at once (`useOptimistic`). Without JS it's a plain form posting `setTaskStatus`.
- **Row menu** (`task-menu.tsx`): reschedule (today, tomorrow, next week, pick a date, remove date), priority, course, rename, open, delete.
- **Overdue rows** show one-tap *Today* / *Tomorrow*.
- **Swipe** (touch): right completes, left moves to tomorrow.
- **Rename** inline (row menu, or click the title on the task page/sheet).
- Server side: `changeTaskStatus`, `patchTask` (returns the previous fields), `removeTask` (returns a snapshot), `restoreTask`. Rescheduling keeps the time of day unless it has already passed on the new day (`movedDue`, tested).
