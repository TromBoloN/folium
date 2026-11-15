import { cn } from "@/lib/utils";

/** A 4px course-colour edge on the left of a row or tile. The parent needs `relative` (and overflow-hidden if rounded). */
export function CourseStripe({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-0 left-0 w-1 bg-(--tint)", className)}
      style={{ "--tint": color } as React.CSSProperties}
    />
  );
}
