import { CalendarClock } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/pill";
import type { DueState } from "../due";

const TONE: Record<DueState, PillTone> = {
  overdue: "danger",
  today: "warning",
  soon: "accent",
  later: "neutral",
  none: "neutral",
};

/** The deadline as a coloured pill: red when overdue, amber when due today. */
export function DueLabel({ label, state }: { label: string | null; state: DueState }) {
  if (!label) return null;
  return (
    <Pill tone={TONE[state]}>
      <CalendarClock aria-hidden />
      {state === "overdue" ? <span className="sr-only">Overdue: </span> : null}
      {label}
    </Pill>
  );
}
