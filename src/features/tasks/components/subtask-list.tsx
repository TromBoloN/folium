import { Check, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { cn } from "@/lib/utils";
import { deleteSubtask, toggleSubtask } from "../actions";
import type { Subtask } from "../queries";
import { AddSubtask } from "./add-subtask";

/** The task's checklist. Steps are one level deep (enforced by a database trigger). */
export function SubtaskList({ taskId, subtasks }: { taskId: string; subtasks: Subtask[] }) {
  const doneCount = subtasks.filter((s) => s.done).length;
  return (
    <section aria-labelledby="steps" className="flex flex-col gap-3">
      <h2 id="steps" className="font-medium">
        Steps{" "}
        {subtasks.length > 0 ? (
          <span className="font-normal text-muted-foreground text-sm">
            {doneCount} of {subtasks.length} done
          </span>
        ) : null}
      </h2>
      {subtasks.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-card">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-2 py-1.5">
              <ActionForm action={toggleSubtask} fields={{ id: s.id, done: String(!s.done) }}>
                <SubmitButton
                  variant="ghost"
                  size="icon"
                  aria-label={s.done ? `Mark “${s.title}” as not done` : `Mark “${s.title}” as done`}
                  className="size-8"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4.5 items-center justify-center rounded-sm border-2",
                      s.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                    )}
                  >
                    {s.done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                </SubmitButton>
              </ActionForm>
              <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>{s.title}</span>
              <ActionForm action={deleteSubtask} fields={{ id: s.id }}>
                <SubmitButton variant="ghost" size="icon" aria-label={`Delete “${s.title}”`} className="size-8">
                  <X aria-hidden />
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : null}
      <AddSubtask taskId={taskId} />
    </section>
  );
}
