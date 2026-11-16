# Frontend decisions

Rendering and routing, app shell and navigation, the Today dashboard, theme and motion, forms and interaction. Newest first; each entry says what was decided, why, what it costs, and its status. Index and open questions: [README.md](README.md).

## Contents

**Rendering and routing**

- [2026-11-15: Add and edit happen in sheets (intercepted routes), with no catch-all in the slot](#2026-11-15-add-and-edit-happen-in-sheets-intercepted-routes-with-no-catch-all-in-the-slot)
- [2026-11-15: Client-wide data goes through an external store, not context](#2026-11-15-client-wide-data-goes-through-an-external-store-not-context)
- [2026-11-15: Per-widget error boundaries with `catchError`](#2026-11-15-per-widget-error-boundaries-with-catcherror)
- [2026-11-15: Not-found inside Suspense returns status 200](#2026-11-15-not-found-inside-suspense-returns-status-200)
- [2026-11-15: Root layout blocks to apply the saved theme](#2026-11-15-root-layout-blocks-to-apply-the-saved-theme)

**App shell, navigation and PWA**

- [2026-11-16: School is a route group with one tab bar; one paths constant](#2026-11-16-school-is-a-route-group-with-one-tab-bar-one-paths-constant)
- [2026-11-15: The Courses view is remembered in preferences, the URL wins](#2026-11-15-the-courses-view-is-remembered-in-preferences-the-url-wins)
- [2026-11-15: Installable app now; reminders not yet](#2026-11-15-installable-app-now-reminders-not-yet)
- [2026-11-15: Grades is a fifth top-level section](#2026-11-15-grades-is-a-fifth-top-level-section)

**Today dashboard**

- [2026-11-15: Today is a bento grid with fixed size hints per widget](#2026-11-15-today-is-a-bento-grid-with-fixed-size-hints-per-widget)
- [2026-11-15: Dashboard widgets come from a registry; the layout stores overrides only](#2026-11-15-dashboard-widgets-come-from-a-registry-the-layout-stores-overrides-only)

**Theme and motion**

- [2026-11-16: A custom accent is adjusted per mode](#2026-11-16-a-custom-accent-is-adjusted-per-mode)
- [2026-11-15: Visual redesign uses CSS and View Transitions, no animation library](#2026-11-15-visual-redesign-uses-css-and-view-transitions-no-animation-library)
- [2026-11-15: Motion is a theme setting; the OS reduced-motion setting always wins](#2026-11-15-motion-is-a-theme-setting-the-os-reduced-motion-setting-always-wins)
- [2026-11-15: Theme tokens are re-declared on any `[data-preset]` element](#2026-11-15-theme-tokens-are-re-declared-on-any-data-preset-element)
- [2026-11-15: Theme tokens come from one hue, light and dark via `light-dark()`](#2026-11-15-theme-tokens-come-from-one-hue-light-and-dark-via-light-dark)
- [2026-11-15: Language preference is saved but `lang` stays `en`](#2026-11-15-language-preference-is-saved-but-lang-stays-en)

**Forms and interaction**

- [2026-11-16: One class-time form adds several weekdays](#2026-11-16-one-class-time-form-adds-several-weekdays)
- [2026-11-16: Forms share primitives and only enhance a real form](#2026-11-16-forms-share-primitives-and-only-enhance-a-real-form)
- [2026-11-15: Settings apply instantly; the action is called directly](#2026-11-15-settings-apply-instantly-the-action-is-called-directly)
- [2026-11-15: Forms echo submitted values back on error](#2026-11-15-forms-echo-submitted-values-back-on-error)

## 2026-11-16: School is a route group with one tab bar; one paths constant

**Status.** Accepted.

**Decision.** The sidebar is Today, School, Money, Settings. Courses, Tasks and Grades live in `app/(app)/(school)/` with one `layout.tsx` rendering `SectionTabs` (shared with Money's tab bar). A route group, so every URL (`/courses`, `/tasks`, `/grades` and below) is unchanged and needs no redirects. `src/lib/sections.ts` holds `SCHOOL_TABS`/`SCHOOL_PATHS` (and `MONEY_TABS`): the ONE source for both the sidebar's active state and the tab bars; `isUnder` matches nested routes but not look-alikes (`/courses-archive`).

**Why.** Six top-level items crowded the phone tab bar; the three school sections belong together. **Cost:** add a school page under `(school)` or it loses the tabs; add a section path in `sections.ts`, not in the nav.

## 2026-11-16: One class-time form adds several weekdays

**Status.** Accepted.

**Decision.** The weekday chips are checkboxes on create; `createSlot` inserts one slot per picked day. Editing stays one slot (radio).

**Why.** "Mon and Wed 07:30" is one thought; the data model (one slot per weekday) stays simple and every slot remains editable on its own.

## 2026-11-16: Forms share primitives and only enhance a real form

**Status.** Accepted.

**Decision.** All forms use `src/components/form/` (FormSection, MoreDetails, ChipGroup, Stepper, FormFooter), the shared control look and a self-checking `Field`. Chips are real radio/checkbox inputs; previews and helpers read and set real inputs.

**Why.** One change improves every form and keeps them consistent. Everything still submits without JavaScript, as before.

## 2026-11-16: A custom accent is adjusted per mode

**Status.** Accepted.

**Decision.** A custom accent isn't used as-is: `accentTokens()` keeps its hue but clamps lightness per mode (light 0.42–0.56 with white text, dark 0.72–0.86 with dark text), through `light-dark()`.

**Why.** A dark accent (navy) made the primary button, logo and active nav icon nearly invisible in dark mode; a light one (yellow) failed with white text in light mode. UI components need about 3:1 against their background, and the main action should be the brightest thing, like the presets.

## 2026-11-15: The Courses view is remembered in preferences, the URL wins

**Status.** Accepted.

**Decision.** `preferences.coursesView` stores the last chosen view (saved on click); `?view=` overrides it. The settings form keeps the stored value instead of posting it.

**Why.** Shareable links open the same view, and a stale settings tab can't reset it.

## 2026-11-15: Add and edit happen in sheets (intercepted routes), with no catch-all in the slot

**Status.** Accepted.

**Decision.** `src/app/(app)/@modal` intercepts `/tasks/new`, `/tasks/[id]`, `/tasks/[id]/edit`, `/courses/new`, `/courses/[id]/slots/new`, `/courses/timetable/new` and the assessment new/edit routes, showing them in a `<Sheet>` (a native modal `<dialog>`) over the current page. Hard loads and shared links still render the full pages. Page bodies live in shared "screen" components with a `page | sheet` variant. A form inside a sheet sends `_sheet=1`; its action then returns `{ ok }` instead of redirecting, and the form closes the sheet, refreshes the page underneath and shows a toast.

**Why.** Small actions shouldn't cost a page load and a trip back, and URLs stay real (back closes the sheet, links are shareable).

**No `[...catchAll]` in the slot.** Next's docs suggest a catch-all page returning null so the slot clears on navigation. With Next 16.4 that page put the client router into an endless segment-prefetch loop (about 190 requests a second for one link, `/tasks?due=today`). Instead the slot only has `default.tsx`, and `<Sheet>` hides itself once `usePathname()` moves away from the URL it opened on. The page crossfade and nav pill key on `usePagePath()` (the main slot's segments), so opening a sheet doesn't remount the page behind it.

## 2026-11-15: Client-wide data goes through an external store, not context

**Status.** Accepted. Hardened 2026-11-16: the store ignores writes and returns nothing on the server (see gotchas).

**Decision.** Courses and preferences the client needs everywhere (row menus, quick-add parsing) are loaded once in the shell and handed to a `useSyncExternalStore` store (`client-data-store.ts`), not to React context.

**Why.** The data arrives just after hydration starts. A context update reaching a Suspense boundary that is still hydrating makes React discard the server HTML and client-render it (seen as a hidden duplicate of the page content and failed e2e tests under load). Components only subscribe to an external store after they hydrate, so the update can't do that.

## 2026-11-15: Settings apply instantly; the action is called directly

**Status.** Accepted.

**Decision.** Changing a setting re-themes `<html>` at once (the same `themeAttributes()` the server uses) and saves 500 ms after the last change by calling `updateSettings` directly, with an "Undo" toast. The Save button only renders without JavaScript.

**Why.** The preview already showed the result, so a separate Save step was friction. Calling the action directly (not via a form submission) avoids React's automatic reset of uncontrolled fields after a form action, which would snap fields back mid-edit.

## 2026-11-15: Installable app now; reminders not yet

**Status.** Accepted for the installable app. Reminders: open (see Open decisions in the index).

**Decision.** Folium ships a web app manifest, generated icons and a minimal service worker (offline fallback page only; no caching of personal data). Push or email reminders are not built.

**Why.** Reminders need infrastructure choices that aren't code-only: a scheduler (Supabase pg_cron or an external cron), a sender (an email provider, or Web Push with VAPID keys and a subscriptions table and migration), and per-user opt-in settings. Those should be decided first.

## 2026-11-15: Visual redesign uses CSS and View Transitions, no animation library

**Status.** Accepted.

**Decision.** The "rich and alive" redesign (bento Today page, layered surfaces, serif display font, motion) is built with CSS animations on `transform`/`opacity` and React's `<ViewTransition>` (the browser View Transitions API). Motion (Framer Motion) was not added. The only new download is Fraunces via `next/font`.

**Why.** Every animation we need is either an entrance (CSS keyframes, staggered by a `--i` variable), a loop (two allowed: the "now" dot and the ambient glow), or a layout change between two React states: the nav pill sliding between items and a checked-off task collapsing while the rows below close up. View Transitions animate those last ones as snapshots on the compositor, with no layout measuring and no extra JS bundle. Where they're unsupported the UI just switches instantly.

**Cost.** Layout animations only run in browsers with View Transitions (Chromium, recent Safari and Firefox). Rows only collapse when the list re-renders after the server action, so there's a short pending state first (the checkbox fills and the row dims while saving).

## 2026-11-15: Motion is a theme setting; the OS reduced-motion setting always wins

**Status.** Accepted.

**Decision.** `theme.motion` is `full | subtle | off` (default `full`, no migration: settings merge over defaults). It's applied as `data-motion` on `<html>`. `subtle` keeps fades and drops movement, loops and count-ups; `off` and `prefers-reduced-motion: reduce` turn every animation and view transition off in CSS. Client code reads the same rule from `motionLevel()`.

**Why.** Some people find motion distracting without having turned on the OS setting; others want it everywhere but on one device. Animations are entrances and feedback, never information, so turning them off loses nothing.

## 2026-11-15: Today is a bento grid with fixed size hints per widget

**Status.** Accepted.

**Decision.** Each registry entry has a fixed `size` (`hero`, `wide`, `tall`, `small`) and `frame` (`tile` or `bare`). The grid is a container query grid (1 column, 2 from `@xl`, 12 from `@4xl`) with `grid-auto-flow: dense`; tiles keep their content height, except the day timeline, which stretches to fill its two-row slot because a time axis can be any height. Sizes aren't user-resizable; order and visibility still come from the saved layout.

**Why.** Varied tile sizes give the page hierarchy, and fixed sizes keep the layout predictable and the default order balanced (rows add up to 12 columns). Container queries rather than viewport breakpoints, because the space next to the sidebar is what matters.

**Also.** The existing `classes` widget became the day timeline, keeping its id and title so saved layouts and links keep working, instead of adding a second "today's classes" widget. New ids (`next-up`, `stats`, `week`) are appended for users who saved a layout before they existed.

## 2026-11-15: Theme tokens are re-declared on any `[data-preset]` element

**Status.** Accepted.

**Decision.** The token block in `globals.css` applies to `:root, [data-preset]`, not just `:root`. A custom accent also sets `--hue` (its OKLCH hue) inline on `<html>`.

**Why.** Custom properties built from `var(--hue)` resolve where they're declared, so a nested element with another `data-preset` didn't re-theme its contents. Re-declaring makes the settings preview and the preset cards real miniatures of each theme. Setting `--hue` from a custom accent tints the neutrals and the ambient glow to match, instead of keeping the preset's hue under a different accent.

**Cost.** The handful of nested `[data-preset]` elements each recompute the token set (negligible).

## 2026-11-15: Per-widget error boundaries with `catchError`

**Status.** Accepted.

**Decision.** Each dashboard widget is wrapped in `SectionErrorBoundary`, built with Next's `catchError` (works with `redirect`/`notFound`, supports `retry`). Added `src/app/error.tsx` (auth pages), `global-error.tsx` (root layout) and `(app)/not-found.tsx` (not-found inside the shell). Error UIs never show raw error messages.

## 2026-11-15: Grades is a fifth top-level section

**Status.** Accepted.

**Decision.** "Grades" joins the sidebar and the bottom nav (now five columns). It's used weekly, like Tasks; hiding it under Courses would bury the GPA.

## 2026-11-15: Dashboard widgets come from a registry; the layout stores overrides only

**Status.** Accepted.

**Decision.** `src/features/dashboard/widget-ids.ts` lists widget ids in default order, and `registry.tsx` maps each id to its title, icon and server component. The dashboard renders whatever the user's layout lists, each widget in its own `<Suspense>`. Adding a widget: one id plus one registry entry; no dashboard code changes.

**Layout format** (`user_settings.dashboard_layout`): `{ version: 1, order?: string[], hidden?: string[] }`, storing only what differs from the default. Reading (`resolveLayout`) drops unknown ids and duplicates, and appends registry ids missing from a saved order, so a widget added later appears for users who already saved a layout. Tested in `layout.test.ts`.

**Editing** happens on `/?edit=1` with dnd-kit (pointer, touch with a press delay, and keyboard sensors with spoken announcements) plus move up/down buttons for phones. Nothing is saved until "Save layout".

## 2026-11-15: Forms echo submitted values back on error

**Status.** Accepted.

**Decision.** Every form action returns the submitted values on failure, and the form uses them as each field's `defaultValue`, remounting with a `key` so selects pick them up.

**Why.** React 19 resets uncontrolled fields when a form action finishes, even when it returns an error, so a rejected save would wipe what the user typed. Checked in a real browser (Playwright) for course, class-time, settings and task forms.

## 2026-11-15: Not-found inside Suspense returns status 200

**Status.** Accepted.

**Decision.** Course pages call `notFound()` inside `<Suspense>`, so the response streams the not-found UI with a `noindex` tag but keeps status 200.

**Why.** The page shell (header, back link) streams before the course loads. Getting a real 404 would mean blocking the whole page on the query. The pages are private, so the status code has no SEO impact; RLS already guarantees nothing of another user's course is returned.

## 2026-11-15: Root layout blocks to apply the saved theme

**Status.** Accepted. Revisit if first-load latency becomes a problem.

**Decision.** The root layout reads the user's settings and puts the theme on `<html>` as data attributes, with `export const instant = false`.

**Why.** The plan requires the saved theme on the server render, with no flash of the wrong colours. With Cache Components, a session read outside `<Suspense>` isn't allowed unless the segment opts out of instant validation, and `<html>` can't be wrapped in `<Suspense>`.

**Cost.** Every full page load waits for one `getClaims()` and one `user_settings` query before streaming. Client-side navigations don't re-render the root layout, so they aren't affected. `instant = false` on the root also turns off static-shell validation app-wide; deeper pages can still opt in with `instant = true`.

**Alternative considered.** A cookie copy of the theme plus an inline script that sets the attributes before paint (the next-themes approach). It keeps a static shell, but the server render no longer carries the theme and there are two sources of truth. Revisit if first-load latency becomes a problem.

## 2026-11-15: Theme tokens come from one hue, light and dark via `light-dark()`

**Status.** Accepted. Its custom-accent part was amended 2026-11-16 ("A custom accent is adjusted per mode").

**Decision.** Every colour token in `globals.css` is `light-dark(<light>, <dark>)` built from `--hue` and `--chroma`. A preset only sets those two numbers. Mode sets `color-scheme` (`light`, `dark`, or `light dark` for system).

**Why.** One token block instead of a duplicated dark block, "system" mode with no JavaScript, and presets that are two numbers. A custom accent is an inline `--primary` override with a contrast-checked foreground.

**Cost.** Needs `light-dark()` (all evergreen browsers since 2024).

## 2026-11-15: Language preference is saved but `lang` stays `en`

**Status.** Accepted until translations ship.

**Decision.** The language setting is stored, but `<html lang>` stays `en`.

**Why.** `lang` must match the page text, or screen readers pronounce English as Indonesian. Apply the preference when translations ship.
