import { cn } from "@/lib/utils";

type Props = {
  /** 0 to 1 (clamped). */
  value: number;
  /** Track classes: height, width limits, track colour. Defaults to a thin muted pill. */
  className?: string;
};

/**
 * A thin, decorative progress bar filled in the current `--tint` (set it on an ancestor).
 * The fill grows in on entrance (`grow-x`, transform only). Always pair it with the
 * value as text nearby: the bar itself is aria-hidden. Theme hooks:
 * `[data-slot="progress"]` (track, with `--value`) and `[data-slot="progress-fill"]`.
 */
export function ProgressBar({ value, className }: Props) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span
      aria-hidden
      data-slot="progress"
      className={cn("h-1.5 overflow-hidden rounded-pill bg-muted", className)}
      style={{ "--value": clamped } as React.CSSProperties}
    >
      <span
        data-slot="progress-fill"
        className="grow-x block h-full w-full origin-left rounded-pill bg-(--tint)"
        style={{ transform: `scaleX(${clamped})` }}
      />
    </span>
  );
}
