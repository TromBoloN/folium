# Dates and time zones

Most date bugs come from asking "what day is it?" in the wrong zone. Folium answers it in one place.

## The rules

1. **The user's zone decides everything human**: what "today" is, week boundaries, when a date-only deadline ends. It's `preferences.timeZone` (IANA, default `Asia/Makassar`), read via `getSettings()`. Never use the server's zone.
2. **Instants are stored in UTC** (`timestamptz`: `tasks.due_at`, `completed_at`, `created_at`…).
3. **Calendar dates are strings** `"YYYY-MM-DD"` ("civil dates", type `CivilDate`) with no zone attached. Arithmetic goes through UTC, so it never shifts.
4. **Class times are local wall-clock** (`time` columns + ISO weekday): "Monday 08:00" means 08:00 wherever the student is.
5. **Reading the clock in a server component** needs `await io()` first, inside `<Suspense>` (Cache Components).

## Helpers

`src/lib/dates.ts` (tested in `dates.test.ts`):

| Function | Does |
|---|---|
| `todayIn(tz, now?)` | Today's civil date in a zone |
| `minutesNowIn(tz, now?)` | Minutes since local midnight |
| `addDays(date, n)`, `isoWeekday(date)` | Civil date arithmetic (1 = Monday … 7 = Sunday) |
| `formatDate(date, options)` | Display a civil date (formats in UTC so the date never shifts) |
| `isCivilDate(v)` | Real `YYYY-MM-DD` only (rejects 30 Feb) |
| `isValidTimeZone(v)`, `listTimeZones(include?)` | IANA validation and the settings dropdown list |
| `DEFAULT_TIME_ZONE` | `"Asia/Makassar"` |

`src/features/tasks/due.ts` (uses `@date-fns/tz` `TZDate`):

| Function | Does |
|---|---|
| `dueAtFrom(date, time \| null, tz)` | Local date + optional time → UTC ISO. No time → 23:59:59.999 local |
| `dueParts(dueAt, hasTime, tz)` | UTC instant → local `{ date, time }` (for forms and labels) |
| `dayBounds(date, tz)` | Local 00:00 and 23:59:59.999 as UTC instants (for SQL range filters) |

DST is handled (tests cover Europe/Amsterdam in summer and winter).

## Known limitation

Date-only deadlines are pinned to the zone in effect when saved. If a user changes time zone, an old date-only deadline can display a day off until the task is re-saved. Recorded in [decisions.md](decisions.md).
