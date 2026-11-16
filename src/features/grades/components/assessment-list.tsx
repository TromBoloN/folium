import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { dueParts } from "../../tasks/due";
import { deleteAssessment } from "../actions";
import { formatPercent, percentOf } from "../logic";
import type { AssessmentRecord } from "../queries";
import { ScoreInput } from "./score-input";

export async function AssessmentList({ assessments, timeZone }: { assessments: AssessmentRecord[]; timeZone: string }) {
  const { t, intl } = await getI18n();
  return (
    <ul className="tile divide-y divide-border-soft overflow-hidden">
      {assessments.map((a) => {
        const pct = percentOf(a);
        const date = a.dueAt
          ? formatDate(dueParts(a.dueAt, false, timeZone).date, { day: "numeric", month: "short" }, intl)
          : null;
        return (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{a.name}</span>
              <span className="text-muted-foreground text-xs">
                {t("{n}% of grade", { n: formatPercent(a.weight, a.weight % 1 === 0 ? 0 : 2) })}
                {date ? ` · ${date}` : ""}
                {pct === null ? t(" · not graded") : <span className="sm:hidden"> · {formatPercent(pct)}%</span>}
              </span>
            </div>
            <span className="hidden w-14 text-right font-medium text-sm tabular-nums sm:block">
              {pct === null ? <span className="text-muted-foreground">–</span> : `${formatPercent(pct)}%`}
            </span>
            <ScoreInput id={a.id} name={a.name} score={a.score} maxScore={a.maxScore} />
            <div className="flex shrink-0 items-center gap-1">
              <Button asChild variant="ghost" size="icon">
                <Link
                  href={`/grades/${a.courseId}/assessments/${a.id}/edit`}
                  aria-label={t("Edit {name}", { name: a.name })}
                >
                  <Pencil aria-hidden />
                </Link>
              </Button>
              <ActionForm action={deleteAssessment} fields={{ id: a.id }}>
                <SubmitButton variant="ghost" size="icon" aria-label={t("Delete {name}", { name: a.name })}>
                  <Trash2 aria-hidden />
                </SubmitButton>
              </ActionForm>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
