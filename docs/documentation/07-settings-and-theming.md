# Settings and theming

## Settings model

`src/features/settings/schema.ts`. Stored in `user_settings` as JSON, one column per group, **only the values that differ from the defaults**.

| Group | Field | Values | Default |
|---|---|---|---|
| theme | `mode` | `system`, `light`, `dark` | `system` |
| theme | `preset` | `green`, `blue`, `violet`, `orange`, `rose` | `green` |
| theme | `accent` | `#rrggbb` or `null` | `null` |
| theme | `font` | `geist`, `inter`, `system` | `geist` |
| theme | `density` | `comfortable`, `compact` | `comfortable` |
| theme | `motion` | `full`, `subtle`, `off` | `full` |
| preferences | `weekStart` | `monday`, `sunday`, `saturday` | `monday` |
| preferences | `timeFormat` | `24h`, `12h` | `24h` |
| preferences | `language` | `en`, `id` (stored, not applied yet) | `en` |
| preferences | `timeZone` | any IANA zone | `Asia/Makassar` |
| preferences | `gradeScale` | 2–15 `{ letter, min, points }` bands (see [16-grades.md](16-grades.md)) | Indonesian 4.0 scale |

- **Reading** (`resolveSettings` → `mergeOverDefaults`): each stored field is validated on its own; invalid or unknown fields fall back to the default without losing the others. No row → defaults.
- **Writing** (`updateSettings` → `diffFromDefaults`, compared by value so arrays work): only changed fields are stored, so changing a default later reaches everyone who never touched it.
- **Versioning**: `SETTINGS_VERSION` + `upgrade()` exist for when a field changes meaning. Adding a field needs no migration and no version bump.
- **Loading**: `getSettings()` (cached per request) never throws; it returns defaults when signed out or on error.

## Theme on first paint

The root layout calls `getSettings()` and spreads `themeAttributes(theme)` onto `<html>`:

```html
<html data-mode="dark" data-preset="blue" data-font="inter" data-density="compact" data-motion="full" style="--primary:#ffd43b; --hue:92; …">
```

So the server-rendered HTML is already themed: no flash, no client script. The cost is that the root layout blocks on the settings read (`instant = false`; see [decisions.md](decisions.md)).

## Tokens (`src/app/globals.css`)

- Every colour derives from `--hue` and `--chroma`. A preset only sets those two; neutrals pick up a faint tint.
- Each token is `light-dark(<light>, <dark>)`. `data-mode` sets `color-scheme` (`light`, `dark`, or `light dark` for system), so "system" follows the OS with no JavaScript. Lightning CSS compiles `light-dark()` to a variable-based fallback; this works because the `color-scheme` rules are in the same file.
- `--warning` is tuned for ≥4.5:1 text contrast in light mode (axe-checked); keep it that way if you change it.
- Tokens follow shadcn naming (`--background`, `--foreground`, `--primary`, `--muted`, `--accent` = hover surface, `--destructive`, `--border`, `--ring`, `--sidebar*`) plus `--warning`. `@theme inline` exposes them as Tailwind colours (`bg-primary`, `text-warning`…).
- `--radius` with `radius-sm/md/lg/xl`; `--font-app` switches by `data-font`; `data-density="compact"` shrinks Tailwind's `--spacing`, scaling every spacing utility.
- `dark:` variant: a custom variant matching `data-mode="dark"`, or `data-mode="system"` with a dark OS.
- `swatch` utility: shows a preset's colour on any element carrying `data-preset` (used in the settings form).
- Custom accent: inline `--primary`/`--ring` plus `--primary-foreground` picked for contrast by `readableTextOn()`, and `--hue` set to the accent's OKLCH hue (`toOklch()`, `src/lib/color.ts`) so the neutrals and glow follow it. Near-grey accents keep the preset hue.
- **Neutrals** lean towards the hue: light mode is warm paper (`--paper-*`: a warm base mixed with the hue), dark mode a deep tinted black.
- **Surfaces**: `--surface-0` (page = `--background`), `--surface-1` (tile = `--card`), `--surface-2` (raised = `--popover`), `--border-soft`, and `--shadow-tile`/`--shadow-raised` (soft shadows in light mode, a faint inner top highlight in dark).
- **Type**: `font-display` is Fraunces (serif, `--font-fraunces` from next/font) for page titles, the greeting and big numerals; `text-sm` is 15px; `rounded-tile` is 16px.
- **Motion tokens**: `--dur-fast` 150ms, `--dur-base` 250ms, `--dur-enter` 500ms, `--ease-out`, `--ease-in-out`, `--rise` (entrance distance; 0 in `subtle`), `--stagger` 40ms. `data-motion="off"` and `prefers-reduced-motion` disable all animations and view transitions. Only `transform` and `opacity` are animated.
- **Utilities**: `tile`, `tile-tinted` (with `--tint`), `[data-spotlight]` (pointer-following border glow; `--mx`/`--my` come from `MotionRuntime`, hover devices only), `reveal` (staggered fade-up via `--i`), `now-dot`, `grow-x`/`grow-y`, `leaf-veins`, `focus-glow`, `swatch`.
- **Ambient**: one fixed `.ambient` element (`components/motion/ambient.tsx`) with two accent glows drifting over 52s and a static grain. The drift pauses while the tab is hidden (`MotionRuntime` sets `data-tab-hidden`).
- **Nested themes**: tokens are declared on `:root, [data-preset]`, so any element with its own `data-preset`/`data-mode` re-themes its contents (the settings preview and preset cards).

**Never hardcode colours, radii or fonts in components.** User-chosen course colours are data: set `style={{ "--course": color }}` and use classes like `bg-(--course)` or `bg-[color-mix(in_oklab,var(--course)_10%,var(--card))]`.

## Settings page

`src/app/(app)/settings/page.tsx` + `components/settings-form.tsx`. The time-zone list is built on the server (`listTimeZones()`) and passed in, to avoid a hydration mismatch between Node's and the browser's zone lists. After a rejected save, the form shows what was submitted (see [12-forms-and-server-actions.md](12-forms-and-server-actions.md)). Presets are drawn as small preview cards. Settings **apply as you change them**: the theme updates `<html>` at once and the form saves 500 ms after the last change (calling `updateSettings` directly), with an Undo toast. The Save button renders only without JavaScript.

An **Install Folium** card (`components/pwa/install-card.tsx`) appears where the browser offers installation, or with Add to Home Screen instructions on iPhone/iPad.
