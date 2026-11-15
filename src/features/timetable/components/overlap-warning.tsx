import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small warning that a class overlaps others. Overlaps are allowed; this only points them out. */
export function OverlapWarning({ withNames, compact }: { withNames: string[]; compact?: boolean }) {
  if (withNames.length === 0) return null;
  const text = `Overlaps with ${withNames.join(", ")}`;
  if (compact) {
    return (
      <span title={text} className="inline-flex shrink-0 text-warning">
        <TriangleAlert aria-hidden className="size-3.5" />
        <span className="sr-only">{text}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-warning text-xs")}>
      <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
      {text}
    </span>
  );
}
