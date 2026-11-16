# Theme authoring guide

How to build a theme pack for Folium: a whole look (colours, cards, background, motion, fonts) in one folder. Everything a pack can change and every rule it must follow is on this page. You shouldn't need to read the rest of the codebase. The product vision is in [development/Themes.md](development/Themes.md); the reasoning is in [decisions/frontend.md](decisions/frontend.md) ("Themes are packs").

**Contents**

1. [The short version](#1-the-short-version)
2. [How it works](#2-how-it-works)
3. [Make a pack, step by step](#3-make-a-pack-step-by-step)
4. [Token contract](#4-token-contract)
5. [Skinnable parts](#5-skinnable-parts)
6. [Backgrounds](#6-backgrounds)
7. [Effects](#7-effects)
8. [Fonts](#8-fonts)
9. [Light, dark and the user's other settings](#9-light-dark-and-the-users-other-settings)
10. [Motion rules](#10-motion-rules)
11. [Phones and performance](#11-phones-and-performance)
12. [Readability and accessibility](#12-readability-and-accessibility)
13. [What a pack must never do](#13-what-a-pack-must-never-do)
14. [Checking a pack](#14-checking-a-pack)
15. [Recipes](#15-recipes)
16. [Troubleshooting](#16-troubleshooting)
17. [File reference](#17-file-reference)

---

## 1. The short version

A pack is a folder `src/features/themes/packs/<id>/` with:

| File | Required | What it is |
|---|---|---|
| `manifest.ts` | yes | Name, description, light/dark support, palette mode, browser bar colours, preview swatches, optional effects loader. |
| `theme.css` | yes | The look. Every selector starts with `[data-theme="<id>"]`. It mostly sets **tokens** (CSS custom properties), and may restyle a few **parts**. |
| `effects.tsx` | no | An animated layer (bubbles, fog, glitches) drawn behind the app, loaded only for this pack. |

Then register it in three places: `registry.ts` (manifest), `packs/index.css` (stylesheet), and `src/lib/i18n/id/themes.ts` (the Indonesian name and description).

The app itself never changes for a theme. If you find yourself editing a component to make a theme work, the component is missing a token or hook: add that once (section 5), and document it here.

## 2. How it works

```
user_settings.theme  ──►  themeAttributes()  ──►  <html data-theme="cyberpunk" data-mode="dark"
 { pack, mode,             (features/settings/        data-preset="green" data-font="geist"
   preset, accent,          theme.ts)                  data-density="comfortable" data-motion="full">
   font, density,
   motion }                                                   │
                                                              ▼
                          app/globals.css: base tokens on :root  (colours from --hue, radii, shadows…)
                          packs/<id>/theme.css: [data-theme="<id>"] overrides tokens, restyles parts
                                                              │
                                                              ▼
            components read tokens only ─► .tile (cards) · .panel (sheets, menus, toasts) · controls
                                           · pills · nav · .ambient (background) · <ThemeEffects>
```

- **The server renders the attributes** in the root layout (`app/layout.tsx`), so the first paint already has the user's pack. There is no flash of the default look.
- **Live changes** (Settings, the Themes page) set the same attributes on `<html>` from the browser (`applyTheme` in `settings-form.tsx`). Anything a pack does must work when `data-theme` changes without a reload; CSS does this for free, and `<ThemeEffects>` watches the attribute.
- **Load order:** `globals.css` first, then `packs/index.css` (both imported in `app/layout.tsx`). A pack rule `[data-theme="x"] { --surface-1: … }` has the same specificity as the base `:root` rule and comes later, so it wins.
- **Pack CSS ships to everyone** in the main stylesheet. Keep it small (aim under 6 KB per pack); images in `url()` only download when their rule matches.
- **Effects JavaScript** is a separate chunk per pack, loaded only when that pack is active and motion is allowed.

## 3. Make a pack, step by step

The example builds a pack called `cyberpunk`. Use a lowercase id with letters, digits and dashes.

### Step 1: the folder and manifest

`src/features/themes/packs/cyberpunk/manifest.ts`:

```ts
import type { ThemeManifest } from "../../manifest";

export const cyberpunkTheme = {
  id: "cyberpunk",
  label: "Cyberpunk", // English name = translation key (step 5)
  description: "Neon pink and cyan on near-black, glowing edges, scanlines.",
  scheme: "dark", // "both" | "dark" | "light". "dark" locks the app to dark mode.
  palette: "custom", // "custom": the pack sets its own colours. "preset": keep the user's colour and accent.
  chrome: { light: "#0b0710", dark: "#0b0710" }, // browser address bar / PWA title bar
  preview: { background: "#0b0710", surface: "#171022", primary: "#ff3ea5", highlight: "#2de2e6" },
  // effects: () => import("./effects"), // only if you add effects.tsx (step 6)
  status: "draft", // "draft" packs are listed only in development; set "ready" to ship
} as const satisfies ThemeManifest;
```

`label` and `description` are `MessageKey`s: TypeScript refuses them until the Indonesian entries exist (step 5).

### Step 2: the stylesheet

`src/features/themes/packs/cyberpunk/theme.css`. Start with tokens; add part rules only where tokens aren't enough.

```css
/* Cyberpunk. Every selector starts with [data-theme="cyberpunk"]; keyframes start with "cyberpunk-". */

[data-theme="cyberpunk"] {
  /* Palette: required for palette: "custom" (section 4.1). Dark-only, so plain oklch values. */
  --surface-0: oklch(0.13 0.03 300);
  --surface-1: oklch(0.18 0.04 300);
  --surface-2: oklch(0.22 0.05 300);
  --foreground: oklch(0.95 0.02 300);
  --muted-foreground: oklch(0.75 0.05 300);
  --primary: oklch(0.72 0.24 350);
  --primary-foreground: oklch(0.13 0.03 300);
  --border: oklch(0.4 0.12 320);
  --ring: oklch(0.85 0.15 195);
  /* …accent, secondary, muted, sidebar, glow: see the token table */

  /* Shape */
  --radius: 0.25rem;
  --tile-radius: 0;
  --pill-radius: 0.25rem;
  --tile-clip: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);

  /* Cards */
  --tile-border: color-mix(in oklab, var(--primary) 55%, transparent);
  --tile-shadow: none;

  /* Headline font (section 8) */
  --font-display-stack: var(--font-orbitron), ui-sans-serif, system-ui, sans-serif;

  /* Motion: snappier */
  --dur-fast: 120ms;
  --ease-out: cubic-bezier(0.2, 0.9, 0.1, 1);
}

/* Background: a grid scene and a scanline texture (section 6). */
[data-theme="cyberpunk"] .ambient::before {
  inset: 0;
  background:
    linear-gradient(var(--grid-line) 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px) 0 0 / 40px 40px;
}
[data-theme="cyberpunk"] .ambient::after {
  inset: 0;
  background: repeating-linear-gradient(to bottom, var(--scanline) 0 1px, transparent 1px 3px);
  animation: cyberpunk-flicker 6s steps(1) infinite;
}
[data-theme="cyberpunk"] {
  --grid-line: oklch(0.72 0.24 350 / 0.08);
  --scanline: oklch(0 0 0 / 0.25);
}

@keyframes cyberpunk-flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 0.85; }
  94% { opacity: 1; }
}
```

Notice that colours only appear in **custom properties** (`--grid-line`, `--scanline`). Real properties (`background`, `border-color`, `box-shadow`) only use `var(...)`, `transparent` or `currentColor`. The linter enforces this (section 14).

### Step 3: register the manifest

`src/features/themes/registry.ts`:

```ts
import { cyberpunkTheme } from "./packs/cyberpunk/manifest";
export const THEMES = [defaultTheme, cyberpunkTheme] as const satisfies readonly ThemeManifest[];
```

This automatically adds `"cyberpunk"` to the `theme.pack` setting (the Zod enum is built from `THEME_PACK_IDS`). No database migration is needed: settings are JSON merged over defaults, and an unknown stored pack falls back to `default`.

### Step 4: import the stylesheet

`src/features/themes/packs/index.css`, one line per pack, **in the same order as `THEMES`**:

```css
@import "./default/theme.css";
@import "./cyberpunk/theme.css";
```

### Step 5: translate the name

`src/lib/i18n/id/themes.ts`, under `// Packs`:

```ts
Cyberpunk: "Cyberpunk",
"Neon pink and cyan on near-black, glowing edges, scanlines.": "Neon merah muda dan sian di atas hitam pekat, tepi berpendar, garis pindai.",
```

### Step 6 (optional): effects, fonts, images

- Effects: section 7. Add `effects.tsx` and the `effects` line in the manifest.
- Fonts: section 8. Declare the font in `src/features/themes/fonts.ts`.
- Images: put them in `public/themes/<id>/` and use `url("/themes/<id>/file.avif")` in `theme.css`.

### Step 7: check it

```sh
bunx vitest run src/features/themes   # registry + pack linter + contrast
bun run typecheck && bunx biome check .
bun dev                               # open /themes: in development it lists packs with an Apply button
```

Then go through the manual checklist in section 14.

## 4. Token contract

Tokens are CSS custom properties declared in `src/app/globals.css`. A pack overrides any of them on `[data-theme="<id>"]`. Components read **only** these (they never hardcode colours, radii or fonts), so changing a token restyles every place that uses it.

**Custom properties resolve where they're declared.** Many tokens are built from others (`--card: var(--surface-1)`), and these are declared on `<html>` alongside your pack's overrides. Overriding `--surface-1` therefore also changes `--card`, `--tile-bg` and so on. You only need to override a derived token when you want it to differ from its source.

### 4.1 Palette

The default palette is computed from two numbers, `--hue` and `--chroma` (set by the user's colour preset), with `light-dark(light, dark)` values that follow the mode. A `palette: "preset"` pack can keep this and just tweak a few tokens. A `palette: "custom"` pack sets its own values; preset and custom accent then don't apply (Settings hides those pickers).

**Required for `palette: "custom"`** (the linter checks they're literal `oklch(...)` or `light-dark(oklch(...), oklch(...))`, and checks contrast):
`--surface-0`, `--surface-1`, `--surface-2`, `--foreground`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--border`, `--ring`.

| Token | Used for | Default |
|---|---|---|
| `--hue`, `--chroma` | Source of the derived palette (preset packs) | from `data-preset` (green 152 / 0.13) |
| `--surface-0` | Page background | warm paper / tinted night |
| `--surface-1` | Cards, controls | one step up |
| `--surface-2` | Raised: popovers, sheets | two steps up |
| `--background` | = `--surface-0` | |
| `--foreground` | Body text | near-black / near-white, tinted |
| `--card`, `--card-foreground` | shadcn names for card colours | `--surface-1`, `--foreground` |
| `--popover`, `--popover-foreground` | Popovers, sheets, menus | `--surface-2`, `--foreground` |
| `--primary`, `--primary-foreground` | Main buttons, active nav icon, links, progress | accent hue |
| `--secondary`, `--secondary-foreground` | Secondary buttons | soft accent |
| `--muted`, `--muted-foreground` | Quiet backgrounds (bars, skeletons); secondary text | |
| `--accent`, `--accent-foreground` | Hover/selected surfaces (not the user's accent colour) | |
| `--destructive`, `--destructive-foreground` | Delete, errors | red |
| `--warning` | Overdue, behind pace, class changes | amber |
| `--money-in`, `--money-out` | Money amounts (in green, out = destructive) | fixed hues |
| `--border`, `--border-soft`, `--input` | Borders: strong (controls), soft (cards, dividers) | |
| `--ring` | Focus rings | accent |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-active`, `--sidebar-active-foreground` | Desktop sidebar and its active item | translucent paper |
| `--shadow-color`, `--highlight` | Ingredients of the shadows below | |
| `--glow-a`, `--glow-b` | Default pack's background glows (free to reuse) | accent-tinted |
| `--grain-opacity` | Default pack's grain strength (set by mode) | 0.035 / 0.05 |
| `--load-1` … `--load-4` | Week strip load shading | `--primary` mixed into `--surface-1` |
| `--paper-0..2` | Light-mode paper bases (default palette only) | |

### 4.2 Surfaces: cards and panels

| Token | Used for | Default |
|---|---|---|
| `--app-bg` | `<body>` background (under the ambient layer). May be a gradient. | `var(--background)` |
| `--tile-bg` | Card background. May be a gradient, or translucent for glass. | `var(--surface-1)` |
| `--tile-border` | Card border colour | `var(--border-soft)` |
| `--tile-border-width` | Card border width | `1px` |
| `--tile-shadow` | Card shadow | `var(--shadow-tile)` |
| `--tile-clip` | Card `clip-path` (cut corners). Clips shadow and spotlight too. | `none` |
| `--tint-surface`, `--tint-border` | How strongly a course colour tints a card (`.tile-tinted`) | `13%`, `28%` |
| `--panel-bg` | Sheets, menus, toasts, command palette, select popups | `var(--popover)` |
| `--panel-border` | Their border colour | `var(--border-soft)` |
| `--panel-shadow` | Their shadow | `var(--shadow-raised)` |
| `--shadow-tile`, `--shadow-raised` | The two big elevations | soft, hue-tinted |
| `--elevation-xs/sm/md/lg` | Behind Tailwind `shadow-xs/sm/md/lg` (buttons, controls) | Tailwind's defaults |

### 4.3 Shape

| Token | Used for | Default |
|---|---|---|
| `--radius` | Base radius. `rounded-xs/sm/md/lg/xl/2xl/3xl` are computed from it (−8, −4, −2, 0, +4, +6, +14 px, never below 0), and bare `rounded` uses it directly. | `0.625rem` |
| `--tile-radius` | Cards (`.tile`, `rounded-tile`: sheets, dialogs) | `1rem` |
| `--pill-radius` | Pill shapes (`rounded-pill`): chips, pills, filter selects, segmented controls, progress bars | `9999px` |

`rounded-full` is reserved for **true circles** (dots, avatars, swatches, the add button) and doesn't change with themes. Set `--pill-radius: 0` for a sharp-edged theme.

### 4.4 Fonts

| Token | Used for | Default |
|---|---|---|
| `--font-app` | Body text. **The user's choice** (Settings → Font: Geist, Inter, system); a pack shouldn't override it. | Geist |
| `--font-display-stack` | Page titles, greeting, card titles, big numbers (`font-display`) | Fraunces |
| `--font-mono-stack` | `font-mono` (quick-add examples, `kbd`) | system mono |

### 4.5 Motion

| Token | Used for | Default |
|---|---|---|
| `--dur-fast`, `--dur-base`, `--dur-enter` | Hover/press, state changes, entrances | 150 / 250 / 500 ms |
| `--ease-out`, `--ease-in-out` | Easing | |
| `--rise` | How far entering content travels (`reveal`). "Subtle" motion sets it to 0. | `10px` |
| `--stagger` | Delay between items in a staggered entrance | `40ms` |

### 4.6 Not tokens (on purpose)

- **Course colours and money account/category colours** are user data (`--tint`, `--course`, `--c`, set inline). A pack can't change them, but it controls how strongly they're mixed (`--tint-surface`, `--tint-border`) and the surfaces they sit on.
- **Spacing and density** (`--spacing`) belong to the user's Density setting.
- **Font size scale** stays fixed so layouts never move.

## 5. Skinnable parts

Tokens cover most of a look. When a pack needs more (a decoration, a different hover), it styles one of these stable hooks. **Only these are supported**: anything else (Tailwind class names, DOM structure) can change without notice.

| Part | Hook | Notes |
|---|---|---|
| Cards | `.tile` (also `<Tile>`, `<Card>`, empty states, stat tiles, every bento widget) | `::before` is **yours** (decoration layer; its animations pause with subtle motion and hidden tabs). `::after` belongs to the spotlight. `position: relative` is already set. |
| Course-tinted cards | `.tile-tinted` | Uses `--tint` (the course colour). |
| Spotlight | `[data-spotlight]::after` | Glow that follows the pointer on hover devices. Uses `--primary`. |
| Floating surfaces | `.panel` | Sheets, menus, toasts, command palette, dialogs. |
| Sheets | `[data-slot="sheet"]` | Bottom sheet on phones, side sheet from `md`. Also has `.panel`. |
| Toasts | `[data-slot="toast"]` | |
| Buttons | `[data-slot="button"][data-variant="default\|destructive\|outline\|secondary\|ghost\|link"]` | |
| Text controls | `[data-slot="control"]` (inputs, textareas), `select[data-slot="select"]` | Keep the focus ring visible. |
| Pills | `[data-slot="pill"]` | Metadata labels (due dates, course codes). |
| Page title block | `[data-slot="page-header"]`, its `h1` | |
| Section tab bar | `[data-slot="section-tabs"]` | School and Money tabs. |
| Desktop sidebar | `[data-slot="sidebar"]`, `[data-slot="sidebar-nav"]` | |
| Phone tab bar | `[data-slot="bottom-nav"]` | Must stay solid and readable: no blur (section 11). |
| Nav items | `[data-slot="nav-item"]`, `[aria-current="page"]` for the active one; `.nav-pill` is the active highlight | |
| Add button (phones) | `[data-slot="fab"]` | |
| Background | `.ambient` (`[data-slot="ambient"]`) | Section 6. |
| Effects layer | `[data-slot="theme-effects"]` | Inside `.ambient`. Section 7. |

**Specificity.** Pack rules are unlayered, and Tailwind utilities live in `@layer utilities`, so `[data-theme="x"] .tile { … }` beats utility classes on the same element. That's useful, but it means a pack can accidentally override layout utilities (padding, gap, display). Only set visual properties (section 13).

**Adding a new hook.** If a part you need isn't listed, add a `data-slot="…"` to the component (once, for every pack) and add it to this table. Prefer a token when the change is one value.

## 6. Backgrounds

There are three layers, from back to front:

1. **`<body>`**: `--app-bg`. A colour or gradient. Static.
2. **`.ambient::before`**: the **scene**. Glows, gradients, grids, an image. May animate slowly.
3. **`.ambient::after`**: the **texture**. Grain, scanlines, vignette, noise. May flicker subtly.

Plus an optional **effects** component inside `.ambient`, between `::before` and `::after` (section 7).

The base CSS gives `.ambient` `position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; contain: strict`, and gives both pseudo-elements `content: ""; position: absolute; pointer-events: none`. Your pack sets `inset`, `background`, `mask`, `opacity` and `animation`. If your pack doesn't style them, they are empty and the background is just `--app-bg`.

**Images:**
- Put them in `public/themes/<id>/`. Use AVIF or WebP, at most about 150 KB, and design for a tall phone (390×844) as well as wide screens.
- Use `background: url("/themes/<id>/bg.avif") center / cover no-repeat;` on `.ambient::before`. Never use `background-attachment: fixed`: it's broken on iOS, and `.ambient` is already fixed.
- For a dark/light pair, use two rules: `[data-theme="x"][data-mode="dark"] .ambient::before` (and handle `data-mode="system"` with `@media (prefers-color-scheme: dark)`), or keep one image and change an overlay token.
- The auth pages (login, sign-up) also render `.ambient`, so your background shows there too.

**Pausing.** Animations on `.ambient::before`/`::after` pause automatically while the tab is hidden and under "subtle" motion. "Off" motion and the device's reduce-motion setting remove them entirely.

## 7. Effects

Use effects for things CSS on two pseudo-elements can't do: many particles (bubbles, embers), several independent layers (fog banks), or randomised placement. If CSS can do it, prefer CSS.

`src/features/themes/packs/<id>/effects.tsx`:

```tsx
"use client";

import type { ThemeEffectProps } from "../../manifest";

/** Rising bubbles. Pure CSS animation; this component only places them. */
export default function Bubbles({ mobile, subtle }: ThemeEffectProps) {
  const count = subtle ? 0 : mobile ? 8 : 20;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="underwater-bubble loop"
          style={{ "--x": `${(i * 37) % 100}%`, "--d": `${8 + (i % 5) * 3}s`, "--delay": `${-i * 1.7}s` } as React.CSSProperties}
        />
      ))}
    </>
  );
}
```

and in the manifest: `effects: () => import("./effects"),`.

Style the particles in `theme.css`, scoped as usual:

```css
[data-theme="underwater"] .underwater-bubble {
  position: absolute;
  bottom: -2rem;
  left: var(--x);
  width: 0.75rem;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid var(--bubble-edge);
  animation: underwater-rise var(--d) linear var(--delay) infinite;
}
@keyframes underwater-rise {
  to { transform: translate3d(0, -110svh, 0); opacity: 0; }
}
```

**What `<ThemeEffects>` (`features/themes/effects.tsx`) guarantees:**
- It renders your component only when the pack is active, motion isn't "off", the device doesn't ask for reduced motion, and data saving isn't on (`Save-Data` / `prefers-reduced-data`).
- It loads your module on demand; users of other packs never download it.
- It re-renders on a live pack or motion change (it observes `<html>`).
- It passes `mobile` (viewport under 48rem) and `subtle` ("subtle" motion: show nothing that travels; a still layer or nothing).
- The wrapper is `absolute inset-0` inside the fixed, `aria-hidden`, non-interactive `.ambient`.

**Your effect must:**
- Animate with CSS keyframes (transform and opacity only), with the class `loop` on anything that loops, so it pauses when the tab is hidden. Avoid `requestAnimationFrame` loops; if you truly need one, stop when `document.hidden` and clean up on unmount.
- Be decorative only: no text, no focusable elements, no pointer handling.
- Stay within the particle budget (section 11).
- Default-export the component.

## 8. Fonts

Packs change the **headline** font (`--font-display-stack`). Body text stays the user's choice.

1. Declare the font once in `src/features/themes/fonts.ts`. It must be declared at module level (a `next/font` rule), with `preload: false` so only users of your pack download it:

   ```ts
   import { Orbitron } from "next/font/google";
   const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], display: "swap", preload: false });
   export const THEME_FONT_VARIABLES = [orbitron.variable];
   ```

   The root layout adds every variable class to `<html>`. This costs nothing until a rule uses the font.
2. Use it in `theme.css`: `--font-display-stack: var(--font-orbitron), ui-sans-serif, system-ui, sans-serif;`. Always end with system fallbacks.
3. Display fonts must stay readable at `text-xl` in card titles and include the characters Indonesian needs (Latin subset is enough). Avoid blackletter for anything longer than a page title. A gothic pack can use an old-style serif for `--font-display-stack` and keep blackletter for decoration only.

## 9. Light, dark and the user's other settings

| User setting | `scheme: "both"` pack | `scheme: "dark"` / `"light"` pack | `palette: "custom"` pack |
|---|---|---|---|
| Mode (system/light/dark) | Applies | Ignored; `data-mode` is forced, and Settings explains why | (as scheme says) |
| Colour preset | Applies if `palette: "preset"` | (as palette says) | Ignored; picker hidden, choice kept |
| Custom accent | Applies if `palette: "preset"` | (as palette says) | Ignored; kept for switching back |
| Font (body) | Applies | Applies | Applies |
| Density | Applies | Applies | Applies |
| Motion | Applies | Applies | Applies |

- **Both schemes:** write `light-dark(<light>, <dark>)` values. The browser picks one from `color-scheme`, which `data-mode` sets. `system` follows the OS with no JavaScript.
- **Dark-only or light-only:** plain values are fine, because `data-mode` is forced and `color-scheme` follows.
- **`chrome`** in the manifest colours the phone's address bar and the installed app's title bar. Match `--surface-0`.
- Previews: the Settings preset cards set `data-preset` on small elements, which re-declares the base palette there (see the decision "Theme tokens are re-declared on any `[data-preset]` element"). A future gallery preview can put `data-theme="<id>"` on a preview element: your token block applies to it too, because it matches `[data-theme="<id>"]` on any element.

## 10. Motion rules

The project rule is to **animate only `transform` and `opacity`**. These run on the compositor and stay smooth on cheap phones. The linter rejects keyframes that animate anything else (`box-shadow`, `filter`, `background-position`, colours, sizes).

- **Fake a pulsing glow:** put the glow (a shadow or gradient) on a pseudo-element or extra layer and animate that layer's `opacity`.
- **Fake a colour shift:** stack two layers and cross-fade them with `opacity`.
- **Moving texture** (scanlines, fog): make the layer larger than the viewport and `translate` it.
- **Hover effects:** transitions on `transform`/`opacity` only. `transition-duration` should use `--dur-fast`/`--dur-base`.

**The three motion levels:**
- `full`: everything runs.
- `subtle`: anything with the `loop` class, both ambient pseudo-elements and `.tile::before` pause. `--rise` is 0 (fades without movement). Effects get `subtle: true`.
- `off`, or the OS reduce-motion setting: every animation and transition is removed (`globals.css` forces `animation: none !important` and zero transition duration). Effects aren't rendered. **Design the still frame**: your background must look finished with no animation at all.

Keyframes must be named `<id>-…` so packs can't collide with each other or the app's own `reveal`, `sheet-up` and the rest. Reusing the app's keyframes (`reveal`, `grow-x`) by name is fine.

## 11. Phones and performance

Most use is on phones, often mid-range Android. The budget:

| Rule | Why |
|---|---|
| No `backdrop-filter` on `.tile` (many on screen) or on the bottom nav. One on `.panel` (a single sheet) is acceptable. | Blur on dozens of scrolling cards drops frames. |
| No `background-attachment: fixed`. | Broken on iOS; `.ambient` is already fixed. |
| Particles: at most **8 on phones** (`mobile`), **24 on desktop**. | |
| At most **two** infinitely looping layers besides particles. | |
| No animated `filter`, `box-shadow`, `clip-path` or `mask`. | These repaint every frame. |
| `will-change: transform` only on the one or two big moving layers. | Each one costs GPU memory. |
| Background images: AVIF or WebP, ≤ 150 KB, ≤ 2 per pack. | Mobile data. |
| Use `svh`/`dvh`, not `vh`, for anything sized to the screen. | Mobile browser bars. |
| Keep content clear of `env(safe-area-inset-*)`. | The shell already does this; don't add fixed decorations over notches. |
| Total `theme.css` under ~6 KB. | It ships to every user. |

Things the app already handles for you: pausing loops when the tab is hidden, skipping effects with Save-Data or reduced data, and loading effects code only for the active pack.

## 12. Readability and accessibility

- **Contrast:** body text, muted text and button text need **4.5:1** against their backgrounds in every scheme the pack supports. The linter checks these pairs for custom palettes: `--foreground` on `--surface-0` and `--surface-1`, `--muted-foreground` on `--surface-1`, and `--primary-foreground` on `--primary`. Check the rest by eye with the browser's contrast tool: `--warning` and `--money-in`/`--money-out` on `--surface-1`, `--destructive` text, placeholder text.
- **Money and warnings:** keep in green-ish and out red-ish (users read meaning into them), but adjust the lightness for your surfaces. They're never the only signal (amounts also have a sign, rows an icon), so hue shifts are acceptable; low contrast isn't.
- **Course colours** are user-picked and mixed into your surfaces. On very dark or saturated surfaces, lower `--tint-surface` so tinted cards don't overpower their text.
- **Focus rings** (`--ring`) must be clearly visible on `--surface-0`, `--surface-1` and `--primary`.
- **Decorations** live in `aria-hidden` layers (`.ambient`, `.tile::before`) and never carry meaning.
- **Text over backgrounds:** text never sits directly on the ambient layer. Cards and the page surface sit between them, so keep scenes subtle enough that cards still read as separate.
- **No flashing:** flicker effects must stay under 3 flashes per second and change opacity by less than 20%.

## 13. What a pack must never do

- Move, hide, reorder or resize controls, or change spacing, `display`, `position`, `width`/`height` or font sizes of app parts. **Same app underneath.**
- Hide or weaken focus rings, or make disabled and enabled states look the same.
- Put text, links or anything interactive in effects or backgrounds.
- Play sound.
- Use selectors outside `[data-theme="<id>"]`, or style Tailwind utility classes (`.p-5`, `.rounded-xl`) as if they were hooks.
- Hardcode colours outside custom properties.
- Animate anything but `transform` and `opacity`.
- Edit components for one pack. Add a token or hook for everyone instead, and document it here.

## 14. Checking a pack

**Automatic** (`bunx vitest run src/features/themes`, also part of `bun run test`):
- ids are unique; there's one folder per registered pack; `index.css` imports each pack once, in registry order; the setting's enum matches the registry;
- every selector is scoped to `[data-theme="<id>"]`; keyframes are named `<id>-…` and animate only transform/opacity; real properties contain no colour literals;
- `palette: "custom"` packs: required tokens are literal oklch, and the contrast pairs pass in each supported scheme;
- the manifest's `effects` entry exists exactly when `effects.tsx` does; chrome and preview colours are `#rrggbb`.

`bun run typecheck` catches missing translations (the label must be a dictionary key) and manifest shape errors.

**Manual** (`bun dev`, then open `/themes`, which lists every pack with an Apply button in development):
1. Today, School (Courses cards, By day, Week), Tasks, Grades, Money (overview, transactions, a sheet), Settings, and the login page.
2. Phone width (375px) and desktop. Open a sheet, a toast (complete a task) and the command palette (Ctrl/⌘K).
3. Light and dark (for `scheme: "both"`), and Indonesian (labels are longer).
4. Motion: full, subtle, off. Also the device's "reduce motion" setting; the still frame must look finished.
5. Switch packs live from `/themes` and back: no leftovers from the previous pack.
6. Keyboard: Tab through a page; focus is always visible.
7. In Chrome DevTools, Performance with 4× CPU throttling: scrolling Today stays smooth.

**Shipping:** set `status: "ready"` in the manifest. Until the gallery exists, `/themes` shows "Available soon" in production; the gallery itself is a separate task (see [development/Themes.md](development/Themes.md)).

## 15. Recipes

**Cut corners (Cyberpunk):** `--tile-clip: polygon(...)` as in step 2. The clip hides the border on the cut edges; draw an outline with `.tile::before` using the same polygon and a 1px inset if you want it.

**Neon edge that pulses:**

```css
[data-theme="cyberpunk"] .tile::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: 0 0 12px var(--neon), inset 0 0 0 1px var(--neon);
  opacity: 0.5;
  animation: cyberpunk-pulse 3s var(--ease-in-out) infinite alternate;
}
[data-theme="cyberpunk"] .tile:hover::before { opacity: 1; }
@keyframes cyberpunk-pulse { to { opacity: 0.9; } }
```

Animations on `.tile::before` pause automatically under "subtle" motion and in a hidden tab, like the ambient layers. For any other looping element, add the `loop` class. If you need a selector that combines your pack with a motion level, put both attributes on the same compound selector, because both are on `<html>`: `[data-theme="cyberpunk"][data-motion="subtle"] .x`.

**Frosted glass cards (Underwater):** keep it cheap. Use a translucent `--tile-bg` (`oklch(0.3 0.05 220 / 0.55)`) and a light `--tile-border`, **without** `backdrop-filter` on tiles; the ambient scene showing through faintly reads as glass. Put `backdrop-filter: blur(12px)` on `.panel` only.

**Stone texture (Gothic):** an SVG noise mask on `.tile::before` with `opacity: 0.06`, like the default pack's grain on `.ambient::after`. Sharp corners: `--tile-radius: 2px; --radius: 2px; --pill-radius: 2px`.

**Drifting fog:** two wide blurred radial gradients on `.ambient::before` (blur is in the gradient, not a `filter`), translated slowly with a 60–90 s keyframe; a vignette radial gradient on `.ambient::after`.

**Light rays:** `repeating-conic-gradient` from the top centre on `.ambient::before`, at low opacity, with a slow `rotate` keyframe.

**Scanlines:** `repeating-linear-gradient` on `.ambient::after` (step 2).

**Candle-like flicker:** opacity keyframe with `steps()` or irregular stops between 0.9 and 1 on a warm glow layer; keep the change under 20%.

## 16. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| My token does nothing | Check the selector is exactly `[data-theme="<id>"]` and the pack is in `index.css`. A derived token (`--card`) re-declared somewhere nested (`[data-preset]` previews) uses the base formula there. |
| Works after a reload, not on live switch | You used JavaScript reading the pack once. Use CSS, or observe `data-theme` like `<ThemeEffects>`. |
| Linter says "uses a colour directly" | Move the colour into a custom property on your root rule and use `var(--x)`. |
| Contrast failure | Adjust oklch lightness (the first number): text ≥ 0.9 on surfaces ≤ 0.25 in dark mode is a safe start. |
| Animation runs with motion off | It can't: `globals.css` removes all animations. If something still moves, it's a JavaScript loop; remove it. |
| Animation keeps running in a hidden tab | Add the `loop` class (or put it on `.ambient::before`/`::after` or `.tile::before`, which pause automatically). |
| Cut-corner cards lost their spotlight glow | Expected: `clip-path` clips `::after`. Draw your own edge on `::before`. |
| A layout changed under my theme | A part rule set a layout property, or out-specified a utility. Only set visual properties (section 13). |
| A font flashes in late | `display: "swap"` with `preload: false` is intended. Keep fallbacks in the stack with similar width. |
| `typecheck` error on `label` | Add the English label and description as keys in `src/lib/i18n/id/themes.ts`. |

## 17. File reference

| What | Where |
|---|---|
| Base tokens, utilities (`.tile`, `.panel`, `.ambient`, `.loop`), motion rules | `src/app/globals.css` |
| Pack stylesheets index | `src/features/themes/packs/index.css` |
| Reference pack (today's look: glows and grain) | `src/features/themes/packs/default/` |
| Manifest type, effect props | `src/features/themes/manifest.ts` |
| Registry, `getManifest`, `visibleThemes` | `src/features/themes/registry.ts` |
| Effects host | `src/features/themes/effects.tsx` (rendered by `src/components/motion/ambient.tsx`) |
| Theme fonts | `src/features/themes/fonts.ts` |
| Pack linter and its tests | `src/features/themes/lint.ts`, `packs.test.ts` |
| `<html>` attributes, accent handling, browser chrome colour | `src/features/settings/theme.ts` (`themeAttributes`, `chromeColors`) |
| The `theme.pack` setting, defaults | `src/features/settings/schema.ts` |
| Saving a pack | `setThemePack` in `src/features/settings/actions.ts` |
| Live re-theming in Settings | `applyTheme` in `src/features/settings/components/settings-form.tsx` |
| Root layout (attributes, fonts, theme-color, CSS order) | `src/app/layout.tsx` |
| Themes page | `src/app/(app)/themes/page.tsx` |
| Pack names in Indonesian | `src/lib/i18n/id/themes.ts` |
| Shared control look | `src/components/ui/control.ts` |
