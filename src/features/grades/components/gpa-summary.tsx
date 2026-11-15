import { ProgressRing } from "@/components/ui/progress-ring";
import { Tile } from "@/components/ui/tile";
import { formatGpa } from "../logic";

type Props = { label: string; gpa: number | null; credits: number; maxPoints: number; reveal?: number };

/** GPA as a ring against the top of the grade scale, with the numeral in serif. */
export function GpaStat({ label, gpa, credits, maxPoints, reveal }: Props) {
  return (
    <Tile reveal={reveal} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <ProgressRing
        value={gpa === null ? 0 : gpa / maxPoints}
        label={gpa === null ? `${label}: no GPA yet` : `${label}: ${formatGpa(gpa)} of ${maxPoints.toFixed(2)}`}
        size={72}
      >
        <span className="font-display font-medium text-xl tabular-nums">{gpa === null ? "–" : formatGpa(gpa)}</span>
      </ProgressRing>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{label}</span>
        <span className="text-muted-foreground text-xs">
          {credits > 0 ? `${credits} SKS counted` : "No graded courses yet"}
        </span>
      </span>
    </Tile>
  );
}
