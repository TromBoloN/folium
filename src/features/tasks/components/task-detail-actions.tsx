"use client";

import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useSheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { deleteTask, setTaskStatus } from "../actions";
import type { TaskStatus } from "../schema";
import { useTaskOps } from "./task-ops";

type Props = { task: { id: string; title: string; status: TaskStatus } };

/**
 * Mark done / reopen, edit, delete for the task page or sheet. With JavaScript
 * these go through the task controller (instant, with Undo); without it the
 * forms post to the same server actions.
 */
export function TaskDetailActions({ task }: Props) {
  const ops = useTaskOps();
  const t = useT();
  const sheet = useSheet();
  const router = useRouter();
  const [, statusAction] = useActionState(setTaskStatus, null);
  const [, deleteAction] = useActionState(deleteTask, null);
  const [busy, setBusy] = useState(false);
  const done = task.status === "done";

  return (
    <div className="flex flex-wrap items-start gap-2">
      <form action={statusAction}>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="status" value={done ? "todo" : "done"} />
        <Button
          type="submit"
          size="sm"
          variant={done ? "outline" : "default"}
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            setBusy(true);
            ops.setStatus(task, done ? "todo" : "done").finally(() => setBusy(false));
          }}
        >
          {done ? <RotateCcw aria-hidden /> : <CheckCircle2 aria-hidden />}
          {done ? t("Reopen") : t("Mark done")}
        </Button>
      </form>
      <Button asChild variant="outline" size="sm">
        <Link href={`/tasks/${task.id}/edit`}>
          <Pencil aria-hidden />
          {t("Edit")}
        </Link>
      </Button>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={task.id} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy}
          onClick={async (e) => {
            // Deleting is undoable (toast), so no confirmation step.
            e.preventDefault();
            setBusy(true);
            const ok = await ops.remove(task);
            setBusy(false);
            if (!ok) return;
            if (sheet) sheet.close();
            else router.push("/tasks");
          }}
        >
          <Trash2 aria-hidden />
          {t("Delete")}
        </Button>
      </form>
    </div>
  );
}
