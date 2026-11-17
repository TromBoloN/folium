import { cn } from "@/lib/utils";

type Props = {
  /** 0 to 1. */
  value: number;
  /** Text alternative, e.g. "Calculus: 82.8%". The ring itself is decorative. */
  label: string;
  size?: number;
  stroke?: number;
  /** Arc colour; defaults to the primary colour. */
  color?: string;
  className?: string;
  /** Shown in the middle of the ring (visual only; `label` is what's announced). */
  children?: React.ReactNode;
};

/** A circular progress meter. The arc sweeps into place on entrance (rotation + fade only). */
export function ProgressRing({ value, label, size = 72, stroke = 7, color, className, children }: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="img"
      aria-label={label}
      data-slot="progress-ring"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size, ...(color ? { "--tint": color } : null) } as React.CSSProperties}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <g className="origin-center animate-[ring-in_var(--dur-enter)_var(--ease-out)_120ms_both]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            className={color ? "stroke-(--tint)" : "stroke-primary"}
          />
        </g>
      </svg>
      {children ? (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          {children}
        </span>
      ) : null}
    </div>
  );
}
