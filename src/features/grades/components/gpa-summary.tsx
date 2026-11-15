import { formatGpa } from "../logic";

type Props = { label: string; gpa: number | null; credits: number };

export function GpaStat({ label, gpa, credits }: Props) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-card p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-2xl tabular-nums">{gpa === null ? "–" : formatGpa(gpa)}</span>
      <span className="text-muted-foreground text-xs">
        {credits > 0 ? `${credits} SKS counted` : "No graded courses yet"}
      </span>
    </div>
  );
}
