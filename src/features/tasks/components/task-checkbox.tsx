import { Check } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "../actions";

/** A round checkbox that marks a task done or reopens it. It's a real form, so it works without JavaScript. */
export function TaskCheckbox({ id, title, done }: { id: string; title: string; done: boolean }) {
  return (
    <ActionForm action={setTaskStatus} fields={{ id, status: done ? "todo" : "done" }}>
      <SubmitButton
        variant="ghost"
        size="icon"
        aria-label={done ? `Reopen “${title}”` : `Mark “${title}” as done`}
        className="size-8 shrink-0 rounded-full"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-5 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50 hover:border-primary",
          )}
        >
          {done ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
      </SubmitButton>
    </ActionForm>
  );
}
