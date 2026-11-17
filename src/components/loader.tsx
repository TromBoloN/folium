import { LeafMark } from "./leaf-mark";

const SHARDS = [0, 1, 2, 3, 4];

/**
 * Folium's loading mark: the logo over a progress bar. Decorative (aria-hidden): the
 * page's own skeletons announce loading. Two uses, both full-screen layers that never
 * block input:
 * - "boot": the first screen of a session, until the app hydrates (app-shell.tsx);
 * - "nav": the curtain over the content area while a page loads (nav-curtain.tsx).
 * The look and motion live in globals.css ("Loading") and in theme packs, through
 * these hooks: `[data-slot="loader"][data-variant]`, `loader-mark` (holds the logo and
 * five empty `loader-shard` layers, `--i` 0–4, for a pack to build the logo from),
 * `loader-bar` (its ::before/::after are free), `loader-track` and `loader-fill`.
 */
export function Loader({ variant }: { variant: "boot" | "nav" }) {
  return (
    <div
      aria-hidden
      data-slot="loader"
      data-variant={variant}
      className="pointer-events-none flex flex-col items-center justify-center gap-6"
    >
      <span data-slot="loader-mark" className="loop relative size-16">
        <LeafMark className="size-16 text-primary" />
        {SHARDS.map((i) => (
          <span
            key={i}
            data-slot="loader-shard"
            className="loop absolute inset-0"
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
      </span>
      <span data-slot="loader-bar" className="relative h-1 w-40">
        <span data-slot="loader-track" className="absolute inset-0 overflow-hidden rounded-pill bg-muted">
          <span data-slot="loader-fill" className="loop block h-full origin-left rounded-pill bg-primary" />
        </span>
      </span>
    </div>
  );
}
