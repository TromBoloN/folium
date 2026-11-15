"use client";

import { createContext, startTransition, useCallback, useContext, useMemo, useOptimistic } from "react";
import { useToast } from "@/components/toast/toaster";
import { changeTaskStatus, patchTask, removeTask, restoreTask, type TaskPatch } from "../actions";
import type { TaskStatus } from "../schema";

type Ops = {
  /** True while a change that removes this row (complete, delete) is in flight. */
  isHidden: (id: string) => boolean;
  setStatus: (task: { id: string; title: string; status: TaskStatus }, status: TaskStatus) => Promise<void>;
  patch: (patch: TaskPatch, label: string) => Promise<boolean>;
  remove: (task: { id: string; title: string }) => Promise<boolean>;
};

const OpsContext = createContext<Ops | null>(null);

export function useTaskOps() {
  const ops = useContext(OpsContext);
  if (!ops) throw new Error("useTaskOps needs <TaskOpsProvider> above it");
  return ops;
}

/**
 * Task changes made in place, with instant feedback and an Undo toast:
 * completing (the row leaves at once), rescheduling, editing a field and deleting.
 *
 * Rows hide through useOptimistic: the hide shows immediately and lasts exactly
 * as long as the server action's transition. By the time it ends the refreshed
 * list no longer has the row (or the action failed and the row simply comes back).
 */
export function TaskOpsProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [hidden, hide] = useOptimistic(new Set<string>(), (current, id: string) => new Set(current).add(id));

  /** Run an action as a transition (so its optimistic hide shows now), resolving with its result. */
  const run = useCallback(<T,>(work: () => Promise<T>) => {
    return new Promise<T>((resolve, reject) => {
      startTransition(async () => {
        try {
          resolve(await work());
        } catch (error) {
          reject(error);
        }
      });
    });
  }, []);

  const isHidden = useCallback((id: string) => hidden.has(id), [hidden]);

  const setStatus = useCallback<Ops["setStatus"]>(
    async (task, status) => {
      const result = await run(() => {
        // Completing hides the row now; reopening just waits for the refresh.
        if (status === "done") hide(task.id);
        return changeTaskStatus(task.id, status);
      });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return;
      }
      const previous = result.data.previous;
      toast({
        message: status === "done" ? `Done: ${task.title}` : `Reopened: ${task.title}`,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await run(() => changeTaskStatus(task.id, previous));
            if (!undo.ok) toast({ message: undo.error, tone: "error" });
          },
        },
      });
    },
    [hide, run, toast],
  );

  const patch = useCallback<Ops["patch"]>(
    async (input, label) => {
      const result = await run(() => patchTask(input));
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return false;
      }
      const { previous } = result.data;
      toast({
        message: label,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await run(() => patchTask({ id: input.id, ...previous }));
            if (!undo.ok) toast({ message: undo.error, tone: "error" });
          },
        },
      });
      return true;
    },
    [run, toast],
  );

  const remove = useCallback<Ops["remove"]>(
    async (task) => {
      const result = await run(() => {
        hide(task.id);
        return removeTask(task.id);
      });
      if (!result.ok) {
        toast({ message: result.error, tone: "error" });
        return false;
      }
      const { snapshot } = result.data;
      toast({
        message: `Deleted: ${task.title}`,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await run(() => restoreTask(snapshot));
            if (!undo.ok) toast({ message: undo.error, tone: "error" });
          },
        },
      });
      return true;
    },
    [hide, run, toast],
  );

  const value = useMemo<Ops>(() => ({ isHidden, setStatus, patch, remove }), [isHidden, setStatus, patch, remove]);
  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export type { ClientData } from "./client-data-store";
