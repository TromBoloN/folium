import { Check } from "lucide-react";
import { readableTextOn, toOklch } from "@/lib/color";
import type { Theme } from "../schema";

/**
 * A small mock of the app drawn in a theme that isn't saved yet. Tokens are
 * re-declared on any [data-preset] element (globals.css), so setting
 * data-preset/data-mode here re-themes everything inside it.
 */
export function ThemePreview({ mode, preset, accent }: Pick<Theme, "mode" | "preset" | "accent">) {
  const style: Record<string, string> = {};
  if (accent) {
    style["--primary"] = accent;
    style["--ring"] = accent;
    style["--primary-foreground"] = readableTextOn(accent);
    const { c, h } = toOklch(accent);
    if (c >= 0.03) style["--hue"] = String(Math.round(h));
  }
  return (
    <div
      aria-hidden
      data-preset={preset}
      data-mode={mode}
      style={style as React.CSSProperties}
      className="relative flex flex-col gap-3 overflow-hidden rounded-tile border border-border-soft bg-background p-4 text-foreground shadow-raised"
    >
      <span className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary opacity-15 blur-2xl" />
      <span className="text-muted-foreground text-xs">Sunday 15 November</span>
      <span className="font-display font-medium text-2xl leading-tight">
        Good morning, <span className="italic">you</span>
      </span>
      <div className="tile flex flex-col gap-1 p-3" style={{ "--tint": "var(--primary)" } as React.CSSProperties}>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="size-2 rounded-full bg-primary" /> Next up
        </span>
        <span className="font-display font-medium text-lg">Calculus I</span>
        <span className="font-display text-sm">in 25 min</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="tile flex flex-col p-3">
          <span className="font-display text-2xl text-warning">3</span>
          <span className="text-xs">Due today</span>
        </div>
        <div className="tile flex flex-col p-3">
          <span className="font-display text-2xl">3.81</span>
          <span className="text-xs">GPA</span>
        </div>
      </div>
      <div className="tile flex items-center gap-2 p-3">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span className="text-sm">Lab report</span>
        <span className="ml-auto rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground text-xs">
          Save
        </span>
      </div>
    </div>
  );
}

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
