# Today dashboard

Code: `src/features/dashboard/`. Route: `/` (`src/app/(app)/page.tsx`); edit mode at `/?edit=1`.

## Page structure

1. **Greeting** (`components/greeting.tsx`): the local date, then "Good morning/afternoon/evening" (05–12 / 12–18 / otherwise, in the user's zone) in the serif display font, plus the profile's display name if set. In its own `<Suspense>`.
2. **Customize** button (hidden in edit mode).
3. **Widgets** in a bento grid, from the user's layout. Each sits in a `WidgetFrame` with its **own `<Suspense>`** and skeleton and its **own error boundary** (`SectionErrorBoundary`), so a slow or failing widget never affects the others.

## First-run checklist

`components/onboarding.tsx` sits above the grid (not a widget, so it can't be hidden): add a course, add class times, add a task. Progress comes from data (`listCourses`, `hasAnyTask`), so it ticks itself off and disappears when done.

## Bento grid

The grid is a container (`@container`): 1 column, 2 from `@xl`, 12 from `@4xl`, `grid-auto-flow: dense`, tiles at their content height. Each widget has a fixed `size` hint (`SIZE_CLASSES` in `widget-frame.tsx`): `hero`/`wide` = 8 columns, `small` = 4, `tall` = 4 columns and 2 rows. `frame: "bare"` widgets (hero, stats) draw their own tiles and keep an `sr-only` title. `stretch: true` (only the timeline) fills the grid area. The default order fills four full rows at 12 columns.

## Widget registry

- `widget-ids.ts`: `WIDGET_IDS` in default order. Kept separate from the registry so pure code and actions can import it without pulling in server components.
- `registry.tsx`: `WIDGETS[id]` = `{ title, description, icon, Component, href?, hrefLabel?, skeletonRows }`.
- The dashboard only iterates the layout and looks up `WIDGETS[id]`. **Adding a widget never touches dashboard code**; see [14-recipes.md](14-recipes.md#add-a-dashboard-widget).

| id | Widget | Shows | Empty state |
|---|---|---|---|
| `next-up` | Next up (hero, bare) | The class on now ("Now, ends in 40 min" + progress) or next ("in 25 min"), room, the class after it; after the last class, tomorrow's first; else the next deadline; else a quiet state. Tinted with the course colour, leaf-vein pattern. Live: ticks each minute (`useNow`), refreshes after midnight | "Nothing scheduled." |
| `stats` | At a glance (small, bare) | Due today, overdue, GPA as count-up stat tiles linking to filtered lists | numbers show 0 / "–" |
| `classes` | Today's classes (tall) | Today's slots on a vertical time axis, overlaps in lanes, a moving "now" line and pulsing dot, "Now"/"Next" badges. Once the day's classes are over (or there are none) it switches to `DaySummary`: a note on today and tomorrow's classes | "No classes today." + tomorrow |
| `week` | This week (wide) | 7 day columns (user's week start): class dots in course colours, deadline bars, shading by load (`--load-1…4`); past days plain; today ringed | (always has 7 days) |
| `due-soon` | Due soon | Open tasks with `dueState` today or soon, up to 5 + "N more" | "Nothing due in the next few days." |
| `overdue` | Overdue | Overdue open tasks, up to 5 + "N more" | "Nothing overdue. You're all caught up." |
| `quick-add` | Quick add | Title-only task entry | — |
| `grades` | Grades | This semester's GPA so far and the letter + % per active course (up to 5) | "Record assessment scores to see your grades." |

Due soon and Overdue share one query (`listOpenTasks()`, cached per request).

## Live calculations (`now.ts`, tested)

- `nextUp(today, tomorrow, nowMinute)`: now (earliest-ending if several overlap, with minutes left and progress), next (minutes until), tomorrow's first, or none; plus the class after it (`after`).
- `formatDuration`, `countdownText`: "in 25 min", "Now, ends in 1 h 5 min", "Starting now".
- `timelineRange` (whole hours, at least 3), `timelinePosition` (top/height %), `nowOffset` (% or null outside the range).
- `weekLoad(dates, slots, tasks, timeZone, today)`: classes, class minutes and open deadlines per day; a deadline counts on its **local** date (00:30 Makassar on the 17th is still the 16th in UTC). `loadIntensity` maps to 0–4.

Client widgets get the server's `now` as `initialNow` so the first client render matches the server, then `useNow` (`src/lib/use-now.ts`) ticks on the minute and pauses while the tab is hidden.

## Now / next (`today.ts`, tested)

- `selectTodaysClasses(slots, date)`: slots that apply on the date, sorted.
- `classMoment(todays, nowMinute)`: `current` = started and not yet ended (overlaps can both be current); `next` = first not yet started. At a back-to-back boundary (10:00) the new class is current, not next.
- `greeting(nowMinute)`; `minutesNowIn(tz)` lives in `src/lib/dates.ts`.

## Layout format (`layout.ts`, tested)

Stored in `user_settings.dashboard_layout`:

```json
{ "version": 1, "order": ["quick-add", "classes", "due-soon", "overdue"], "hidden": ["overdue"] }
```

Every key except `version` is optional, and only what differs from the default is stored (`layoutOverrides`). Reading (`resolveLayout`):

- ids that no longer exist are ignored (in both lists);
- duplicate ids keep their first position;
- registry ids missing from a saved order are **appended**, so widgets added later appear for users who already saved a layout;
- junk (wrong types, non-strings) falls back to defaults.

## Edit mode

`components/dashboard-editor.tsx` (client):

- A checkbox per widget to show/hide; "Reset to default"; "Save layout" (nothing is saved until then); "Cancel".
- **dnd-kit** sortable list with three sensors: pointer (5 px activation), touch (200 ms press), keyboard (`sortableKeyboardCoordinates`: Space to pick up, arrows to move, Space to drop, Escape to cancel), with screen-reader announcements using widget titles.
- **Move up / move down** buttons per row (drag is fiddly on phones).
- Saves via the `saveDashboardLayout` action (hidden inputs `order` and `hidden`, validated against `WIDGET_IDS`), then redirects to `/`.
- The form gets `data-ready` after hydration; e2e tests wait for it before clicking.
