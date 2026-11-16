import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
  // Text leans towards the foreground so it keeps 4.5:1 on its own tinted background in both modes.
  danger:
    "bg-[color-mix(in_oklab,var(--destructive)_13%,transparent)] text-[color-mix(in_oklab,var(--destructive)_78%,var(--foreground))]",
  warning:
    "bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] text-[color-mix(in_oklab,var(--warning)_78%,var(--foreground))]",
  /** Tinted with --tint (a course colour); text stays the foreground colour for contrast. */
  course: "bg-[color-mix(in_oklab,var(--tint)_18%,transparent)] text-foreground",
} as const;

export type PillTone = keyof typeof TONES;

type Props = React.ComponentProps<"span"> & { tone?: PillTone; tint?: string };

/** A small rounded label for metadata: due dates, priorities, course codes. */
export function Pill({ tone = "neutral", tint, className, style, ...props }: Props) {
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 font-medium text-xs tabular-nums [&_svg]:size-3.5 [&_svg]:shrink-0",
        TONES[tone],
        className,
      )}
      style={{ ...(tint ? { "--tint": tint } : null), ...style }}
      {...props}
    />
  );
}
