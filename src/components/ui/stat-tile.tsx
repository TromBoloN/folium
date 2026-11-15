import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";
import { Tile } from "./tile";

type Props = {
  label: string;
  value: number | null;
  decimals?: number;
  /** Shown instead of the number when value is null. */
  placeholder?: string;
  hint?: string;
  href?: string;
  tone?: "default" | "danger" | "warning";
  reveal?: number;
  className?: string;
};

const NUMBER_TONE = { default: "text-foreground", danger: "text-destructive", warning: "text-warning" } as const;

/** A big serif numeral with a label. Counts up on entrance; links somewhere useful if given an href. */
export function StatTile({
  label,
  value,
  decimals,
  placeholder = "–",
  hint,
  href,
  tone = "default",
  reveal,
  className,
}: Props) {
  const body = (
    <>
      <span className={cn("font-display font-medium text-4xl leading-none", NUMBER_TONE[value ? tone : "default"])}>
        {value === null ? placeholder : <CountUp value={value} decimals={decimals} />}
      </span>
      <span className="flex flex-col">
        <span className="font-medium text-sm leading-tight">{label}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </span>
    </>
  );
  const layout =
    "flex min-h-28 flex-col justify-between gap-3 p-4 @4xl:min-h-0 @4xl:flex-row @4xl:items-center @4xl:justify-start @4xl:gap-4";
  return (
    <Tile spotlight={Boolean(href)} reveal={reveal} className={cn("overflow-hidden", className)}>
      {href ? (
        <Link
          href={href}
          className={cn(layout, "group/stat rounded-[inherit] focus-visible:outline-2 focus-visible:outline-ring")}
        >
          {body}
          {/* Says "this opens something", so the tile reads as a link and not just a number. */}
          <ArrowUpRight
            aria-hidden
            className="absolute top-3 right-3 size-4 text-muted-foreground transition-transform duration-(--dur-fast) group-hover/stat:translate-x-0.5 group-hover/stat:-translate-y-0.5"
          />
        </Link>
      ) : (
        <div className={layout}>{body}</div>
      )}
    </Tile>
  );
}
