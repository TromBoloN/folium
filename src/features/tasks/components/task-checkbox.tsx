"use client";

import { useActionState, useState } from "react";
import { setTaskStatus } from "../actions";
import type { TaskStatus } from "../schema";
import { CheckMark } from "./check-mark";
import { useTaskOps } from "./task-ops";

type Props = {
  task: { id: string; title: string; status: TaskStatus };
  /** Course colour and a readable check colour on it (computed on the server). */
  style: React.CSSProperties;
};

/**
 * A round checkbox, ringed in the course colour, that completes or reopens a task.
 * With JavaScript the click goes through the task controller: the circle fills,
 * the row leaves at once and an "Undo" toast appears. Without JavaScript it's a
 * plain form posting to the same server action.
 */
export function TaskCheckbox({ task, style }: Props) {
  const ops = useTaskOps();
  const [state, formAction] = useActionState(setTaskStatus, null);
  const [pending, setPending] = useState(false);
  const done = task.status === "done";
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="status" value={done ? "todo" : "done"} />
      <button
        type="submit"
        aria-label={done ? `Reopen “${task.title}”` : `Mark “${task.title}” as done`}
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          setPending(true);
          ops.setStatus(task, done ? "todo" : "done").finally(() => setPending(false));
        }}
        className="group/check flex size-10 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tint)_14%,transparent)] focus-visible:ring-2 focus-visible:ring-ring"
        style={style}
      >
        <CheckMark filled={pending ? !done : done} pending={pending} />
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
