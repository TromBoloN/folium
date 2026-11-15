# Courses and timetable

Code: `src/features/courses/` and `src/features/timetable/`. Routes under `/courses`.

## Courses

- Fields: name (required), code, colour, lecturer, room, semester (free text label). Schema in `courses/schema.ts`; empty optional inputs become `null`.
- **Colour** is user data, picked from `COURSE_COLORS` or any `#rrggbb`. New courses get the first unused suggestion (`nextCourseColor`).
- **Archive** (`setCourseArchived`) sets `archived_at`: the course leaves the timetable and overlap checks but keeps its tasks and class times. **Delete** removes the course and its class times; its tasks stay, unlinked.
- The course page lists class times with overlap warnings, and links to the course's tasks (`/tasks?course=<id>`).

## Class times (`timetable_slots`)

- Weekday (ISO 1–7), start/end as local wall-clock `HH:MM`, optional location, optional date range (`starts_on`/`ends_on`, inclusive, either may be open).
- Validation (`timetable/schema.ts`): end after start, range end not before start. The database enforces the same.
- **Overlaps are allowed.** Saving never blocks; overlaps are flagged with a warning icon (decision in [decisions.md](decisions.md)).

## Pure logic (`timetable/logic.ts`, tested in `logic.test.ts`)

| Function | Rule |
|---|---|
| `appliesOn(slot, date)` | Right ISO weekday and inside the optional range |
| `timesOverlap(a, b)` | `a.start < b.end && b.start < a.end`; back-to-back (10:00 end, 10:00 start) is **not** an overlap |
| `dateRangesIntersect(a, b)` | Open ends extend forever |
| `slotsConflict(a, b)` | Same weekday + times overlap + ranges meet |
| `findConflicts(slots)` | Map of slot id → slots it clashes with |
| `weekDates(date, weekStart)` | The 7 dates of the week containing `date`, from the user's week start |
| `layoutDay(slots)` | Lanes for overlapping slots in a day (used by the grid) |
| `formatTime(t, "24h"/"12h")`, `compareSlots`, `sortSlots`, `toMinutes`, `trimSeconds` | Helpers |

Archived courses never clash (`listActiveSlots()` excludes them).

## One page, three views

`/courses?view=cards|day|week&week=YYYY-MM-DD`. The view switch remembers the choice (`preferences.coursesView`, saved by `rememberCoursesView` on click); `?view=` wins, so links open the same view. `/courses/timetable` redirects to `?view=week` (next.config, query kept).

- **Cards**: next class ("Next: Wed 10:00", with change chips), weekday dots, SKS, open tasks, current grade, "N changes this week". Rows of cards share a height. Weekly-pattern clashes still show (a property of the pattern).
- **By day**: one week, time-first rows (`OccurrenceRow`), past and cancelled dimmed, cancelled struck through, free days collapsed to one line. On xl a rail lists this week's changes and upcoming breaks.
- **Week**: the grid (desktop) / one day at a time (phones). Moved classes leave a dashed ghost at the old time.

## Schedule changes (`src/features/schedule/`)

Weekly slots stay the default timetable. A **change** touches one date: `cancelled`, `moved` (date, time and/or room; room-only is a move with only `location`), or `extra` (makeup, exam). A **break** cancels every regular class in a date range; explicit moves and extra sessions still happen inside it.

**The rule:** every screen reads `buildSchedule(input, range)` (`occurrences.ts`, ~35 tests) through `getSchedule` / `getScheduleInput`. Cards, by-day, week grid, hero, timeline, week strip, overlap warnings, attendance, the .ics export and typed commands all use it. Occurrences are `SlotTiming`s for their own date (`startsOn = endsOn = date`), so sorting, lanes, conflicts and now/next helpers work unchanged. Keys: `s.<slot>.<originalDate>` (weekly, also for a moved one), `x.<change>` (extra), `g.…` (ghost).

Tap any class → `/courses/class/[key]` (sheet): **Changed?** Cancelled (one tap, optional note, Undo) · Moved (date chips, end follows the length, live overlap warning) · Room only; then **This week only** (a change row) or **Every week from now on** (splits the slot: the old one ends the day before, a new one starts; later one-off changes of the old slot are dropped). Undo restores the previous change row.

Look, everywhere (`ChangeChip`): cancelled red + strikethrough + dimmed; moved amber "Moved from Wed 07:30"; extra dashed outline "Extra · Makeup"; "Room → B2.05"; "Online".

Ctrl/⌘K understands `cancel physics tomorrow`, `calculus moved thu 10:00`, `FIS101 room B1.20 fri`, `no classes 23-27 nov` (`command.ts`, tested). Text whose course words match no course stays a task.

## Attendance, online classes, contacts, export, rollover

- Attendance per occurrence (attended/missed; unmarked = no row). Percentage = attended / marked; with a known term end, "you can miss N more" against `preferences.attendanceTarget` (default 75%). Cancelled classes never count. Course page: recent classes with quick marks, "Mark N unmarked as attended" (Undo).
- Slots have `is_online` + `meeting_url`; the hero and class sheet show "Open link".
- Courses have `lecturer_email` / `lecturer_phone` (WhatsApp link; a leading 0 becomes 62).
- `/courses/calendar.ics`: four weeks back to six months ahead, changes applied, cancelled left out, stable UIDs. A one-off import; a subscribable feed would need a per-user secret token (not built).
- `/courses/rollover`: copy a semester's courses (optionally class times with new dates) into a new semester and archive the old ones.

## Week view

`/courses?view=week&week=YYYY-MM-DD` (any date in the wanted week; invalid → this week).

- `buildWeek(input, …)` (`timetable/week.ts`, tested) runs `buildSchedule` for the week and produces 7 days with listed items (live + cancelled), ghosts, break labels, per-date overlap names (only clashes that actually happen that date), the visible hour range (at least 08:00–17:00, widened to fit), and prev/next week anchors. "Today" uses the user's time zone.
- **Mobile**: `DayAgenda`, a client component with a tab per day (arrow keys move between days, dots mark days with classes), opening on today.
- **Desktop**: `WeekGrid`, a time grid. Overlapping blocks **cascade** (each later lane offset and drawn on top) rather than splitting the column, so titles stay readable. The page marks itself `data-wide` so the main column widens.
- Blocks are tinted with the course colour via `--course`.
