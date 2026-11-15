import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { deleteTask, setTaskStatus } from "../actions";
import type { Task } from "../queries";

export function TaskActions({ task }: { task: Task }) {
  const done = task.status === "done";
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionForm action={setTaskStatus} fields={{ id: task.id, status: done ? "todo" : "done" }}>
        <SubmitButton size="sm" variant={done ? "outline" : "default"}>
          {done ? <RotateCcw aria-hidden /> : <CheckCircle2 aria-hidden />}
          {done ? "Reopen" : "Mark done"}
        </SubmitButton>
      </ActionForm>
      <Button asChild variant="outline" size="sm">
        <Link href={`/tasks/${task.id}/edit`}>
          <Pencil aria-hidden />
          Edit
        </Link>
      </Button>
      <details className="group relative">
        <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-medium text-destructive text-sm hover:bg-destructive/10">
          <Trash2 aria-hidden className="size-4" />
          Delete
        </summary>
        <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md sm:left-0">
          <p className="text-sm">
            Delete this task{task.subtasks.length > 0 ? ` and its ${task.subtasks.length} steps` : ""}? This can&apos;t
            be undone.
          </p>
          <ActionForm action={deleteTask} fields={{ id: task.id }}>
            <SubmitButton variant="destructive" size="sm" pendingLabel="Deleting…">
              Delete task
            </SubmitButton>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
