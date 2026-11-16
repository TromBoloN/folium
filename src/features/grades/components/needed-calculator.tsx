import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { rich } from "@/lib/i18n/rich";
import { getT } from "@/lib/i18n/server";
import { type Assessment, formatPercent, neededOnRemaining } from "../logic";
import type { GradeBand } from "../scale";

type Props = { courseId: string; assessments: Assessment[]; scale: GradeBand[]; target: GradeBand };

/** "What do I need on the rest to get an A?" A GET form, so it works without JavaScript. */
export async function NeededCalculator({ courseId, assessments, scale, target }: Props) {
  const t = await getT();
  const needed = neededOnRemaining(assessments, target.min);
  const goal = `${target.letter} (${target.min}%)`;
  let answer: React.ReactNode;
  switch (needed.kind) {
    case "no-assessments":
      answer = t("Add assessments to see what you need.");
      break;
    case "secured":
      answer = rich(t("{goal} is already secured, even with zero on the rest."), { goal: <strong>{goal}</strong> });
      break;
    case "needed":
      answer = rich(t("You need an average of {percent} on the remaining work for {goal}."), {
        percent: <strong>{formatPercent(needed.percent)}%</strong>,
        goal,
      });
      break;
    case "out-of-reach":
      answer = t("{goal} is out of reach: it would take {percent}% on the remaining work.", {
        goal,
        percent: formatPercent(needed.percent),
      });
      break;
    case "final":
      answer = needed.reached
        ? t("Everything is graded: you reached {goal}.", { goal })
        : t("Everything is graded: final {percent}%, below {goal}.", { percent: formatPercent(needed.percent), goal });
      break;
  }

  return (
    <section aria-labelledby="needed" className="flex flex-col gap-3 tile p-4">
      <h2 id="needed" className="flex items-center gap-2 font-medium">
        <Target aria-hidden className="size-4 text-primary" />
        {t("What do I need?")}
      </h2>
      <form method="get" action={`/grades/${courseId}`} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label htmlFor="target" className="text-muted-foreground text-xs">
            {t("Target grade")}
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
          {t("Calculate")}
        </Button>
      </form>
      <p aria-live="polite" className="text-sm">
        {answer}
      </p>
    </section>
  );
}
