"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickAddTask } from "../actions";

/** Title-only task entry. On success the field clears (React resets the form); on error it keeps the text. */
export function QuickAdd({ courseId, courseName }: { courseId?: string; courseName?: string }) {
  const [state, action, pending] = useActionState(quickAddTask, null);
  const kept = state && !state.ok ? state.values?.title : undefined;
  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-1">
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
      <div className="focus-glow flex gap-2">
        <Input
          name="title"
          defaultValue={kept}
          placeholder={courseName ? `Add a task for ${courseName}…` : "Add a task…"}
          aria-label="New task title"
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={state && !state.ok ? true : undefined}
          aria-describedby={state && !state.ok ? "quick-add-error" : undefined}
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
      ) : null}
    </form>
  );
}
