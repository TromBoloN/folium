import { ProgressRing } from "@/components/ui/progress-ring";
import { Tile } from "@/components/ui/tile";
import { getI18n } from "@/lib/i18n/server";
import { formatGpa } from "../logic";

type Props = { label: string; gpa: number | null; credits: number; maxPoints: number; reveal?: number };

/** GPA as a ring against the top of the grade scale, with the numeral in serif. */
export async function GpaStat({ label, gpa, credits, maxPoints, reveal }: Props) {
  const { t, tl } = await getI18n();
  const name = tl(label);
  return (
    <Tile reveal={reveal} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <ProgressRing
        value={gpa === null ? 0 : gpa / maxPoints}
        label={
          gpa === null
            ? t("{label}: no GPA yet", { label: name })
            : t("{label}: {gpa} of {max}", { label: name, gpa: formatGpa(gpa), max: maxPoints.toFixed(2) })
        }
        size={72}
      >
        <span className="font-display font-medium text-xl tabular-nums">{gpa === null ? "–" : formatGpa(gpa)}</span>
      </ProgressRing>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{name}</span>
        <span className="text-muted-foreground text-xs">
          {credits > 0 ? t("{n} SKS counted", { n: credits }) : t("No graded courses yet")}
        </span>
      </span>
    </Tile>
  );
}
