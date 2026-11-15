import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { type Assessment, formatPercent, neededOnRemaining } from "../logic";
import type { GradeBand } from "../scale";

type Props = { courseId: string; assessments: Assessment[]; scale: GradeBand[]; target: GradeBand };

/** "What do I need on the rest to get an A?" A GET form, so it works without JavaScript. */
export function NeededCalculator({ courseId, assessments, scale, target }: Props) {
  const needed = neededOnRemaining(assessments, target.min);
  const goal = `${target.letter} (${target.min}%)`;
  let answer: React.ReactNode;
  switch (needed.kind) {
    case "no-assessments":
      answer = "Add assessments to see what you need.";
      break;
    case "secured":
      answer = (
        <>
          <strong>{goal}</strong> is already secured, even with zero on the rest.
        </>
      );
      break;
    case "needed":
      answer = (
        <>
          You need an average of <strong>{formatPercent(needed.percent)}%</strong> on the remaining work for {goal}.
        </>
      );
      break;
    case "out-of-reach":
      answer = (
        <>
          {goal} is out of reach: it would take {formatPercent(needed.percent)}% on the remaining work.
        </>
      );
      break;
    case "final":
      answer = needed.reached
        ? `Everything is graded: you reached ${goal}.`
        : `Everything is graded: final ${formatPercent(needed.percent)}%, below ${goal}.`;
      break;
  }

  return (
    <section aria-labelledby="needed" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 id="needed" className="flex items-center gap-2 font-medium">
        <Target aria-hidden className="size-4 text-primary" />
        What do I need?
      </h2>
      <form method="get" action={`/grades/${courseId}`} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label htmlFor="target" className="text-muted-foreground text-xs">
            Target grade
          </label>
          <NativeSelect id="target" name="target" defaultValue={target.letter} className="w-40">
            {scale.map((b) => (
              <option key={b.letter} value={b.letter}>
                {b.letter} ({b.min}%+)
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          Calculate
        </Button>
      </form>
      <p aria-live="polite" className="text-sm">
        {answer}
      </p>
    </section>
  );
}
