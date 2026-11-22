import { CalendarClock } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Tr } from "@/lib/i18n/client";
import type { DueState } from "../due";

const TONE: Record<DueState, PillTone> = {
  overdue: "neutral",
  today: "warning",
  soon: "accent",
  later: "neutral",
  none: "neutral",
};

/**
 * The deadline pill: neutral when waiting (past due), amber when due today,
 * and red only when timed and due within a few hours (`urgent`).
 */
export function DueLabel({ label, state, urgent }: { label: string | null; state: DueState; urgent?: boolean }) {
  if (!label) return null;
  const tone: PillTone = state === "today" && urgent ? "danger" : TONE[state];
  return (
    <Pill tone={tone}>
      <CalendarClock aria-hidden />
      {state === "overdue" ? (
        <span className="sr-only">
          <Tr k="Waiting:" />{" "}
        </span>
      ) : null}
      {label}
    </Pill>
  );
}
