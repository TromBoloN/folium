"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickAddTask, removeTask } from "../actions";
import { ParsePreview } from "./parse-preview";

/**
 * One-line task entry that understands dates, times, #course and !priority
 * (see parse.ts). Shows what it understood as you type; on success the field
 * clears and a toast offers Undo. On error the text stays.
 */
export function QuickAdd({ courseId, courseName }: { courseId?: string; courseName?: string }) {
  const [state, action, pending] = useActionState(quickAddTask, null);
  const [text, setText] = useState("");
  const toast = useToast();
  const handled = useRef(state);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      setText("");
      const id = state.result?.id;
      toast({
        message: `Added: ${state.result?.title ?? "task"}`,
        action: id
          ? {
              label: "Undo",
              onClick: async () => {
                await removeTask(id);
              },
            }
          : undefined,
      });
    } else {
      setText(state.values?.title ?? text);
    }
  }, [state, toast, text]);

  const previewId = courseId ? "quick-add-preview-course" : "quick-add-preview";
  return (
    <form action={action} className="flex flex-col gap-1.5">
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
      <div className="focus-glow flex gap-2">
        <Input
          name="title"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={courseName ? `Add a task for ${courseName}…` : "Add a task…"}
          aria-label="New task title"
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={state && !state.ok ? true : undefined}
          aria-describedby={state && !state.ok ? "quick-add-error" : previewId}
        />
        <Button type="submit" disabled={pending} aria-label="Add task">
          <Plus aria-hidden />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>
      {state && !state.ok ? (
        <p id="quick-add-error" role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : text ? (
        <ParsePreview text={text} id={previewId} />
      ) : null}
    </form>
  );
}
