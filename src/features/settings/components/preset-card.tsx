import type { Theme } from "../schema";

/** A preset option drawn as a tiny card in that preset's colours. */
export function PresetCard({ preset, label }: { preset: Theme["preset"]; label: string }) {
  return (
    <span className="flex flex-col items-stretch gap-1.5">
      <span
        aria-hidden
        data-preset={preset}
        className="flex h-12 flex-col justify-between overflow-hidden rounded-lg border border-border-soft bg-background p-1.5"
      >
        <span className="h-1.5 w-2/3 rounded-full bg-primary" />
        <span className="flex gap-1">
          <span className="h-3 flex-1 rounded-sm bg-card shadow-tile" />
          <span className="h-3 flex-1 rounded-sm bg-accent" />
        </span>
      </span>
      <span className="flex items-center justify-center gap-1.5">
        <span aria-hidden data-preset={preset} className="swatch size-2.5 rounded-full" />
        {label}
      </span>
    </span>
  );
}
