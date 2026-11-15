import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { dueParts } from "../../tasks/due";
import { deleteAssessment } from "../actions";
import { formatPercent, percentOf } from "../logic";
import type { AssessmentRecord } from "../queries";

export function AssessmentList({ assessments, timeZone }: { assessments: AssessmentRecord[]; timeZone: string }) {
  return (
    <ul className="tile divide-y divide-border-soft overflow-hidden">
      {assessments.map((a) => {
        const pct = percentOf(a);
        const date = a.dueAt
          ? formatDate(dueParts(a.dueAt, false, timeZone).date, { day: "numeric", month: "short" })
          : null;
        return (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{a.name}</span>
              <span className="text-muted-foreground text-xs">
                {formatPercent(a.weight, a.weight % 1 === 0 ? 0 : 2)}% of grade
                {date ? ` · ${date}` : ""}
              </span>
            </div>
            <div className="text-right text-sm tabular-nums">
              {pct === null ? (
                <span className="text-muted-foreground">Not graded</span>
              ) : (
                <>
                  <span className="font-medium">{formatPercent(pct)}%</span>
                  <span className="block text-muted-foreground text-xs">
                    {a.score} / {a.maxScore}
                  </span>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button asChild variant="ghost" size="icon">
                <Link href={`/grades/${a.courseId}/assessments/${a.id}/edit`} aria-label={`Edit ${a.name}`}>
                  <Pencil aria-hidden />
                </Link>
              </Button>
              <ActionForm action={deleteAssessment} fields={{ id: a.id }}>
                <SubmitButton variant="ghost" size="icon" aria-label={`Delete ${a.name}`}>
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
