import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DueState } from "../due";

const TONE: Record<DueState, string> = {
  overdue: "text-destructive",
  today: "text-warning",
  soon: "text-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

export function DueLabel({ label, state }: { label: string | null; state: DueState }) {
  if (!label) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", TONE[state])}>
      <CalendarClock aria-hidden className="size-3.5" />
      {state === "overdue" ? <span className="sr-only">Overdue: </span> : null}
      {label}
    </span>
  );
}
