/**
 * One look for every text-like control (input, select, textarea): a filled
 * surface with a visible border, an accent focus ring, a clearly-not-a-value
 * placeholder, and 44px tap targets on phones (40px from md up).
 */
export const CONTROL =
  "w-full rounded-lg border border-border bg-surface-1 text-base text-foreground shadow-xs transition-[color,box-shadow,border-color] duration-(--dur-fast) placeholder:text-muted-foreground/60 placeholder:italic hover:border-foreground/25 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export const CONTROL_HEIGHT = "h-11 md:h-10";
