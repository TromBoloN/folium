import { ActionForm, SubmitButton } from "@/components/action-form";
import { readableTextOn } from "@/lib/color";
import { setTaskStatus } from "../actions";
import { CheckMark } from "./check-mark";

type Props = { id: string; title: string; done: boolean; color?: string | null };

/**
 * A round checkbox, ringed in the course colour, that marks a task done or
 * reopens it. It's a real form posting to a server action, so it works without JavaScript.
 */
export function TaskCheckbox({ id, title, done, color }: Props) {
  const style = color
    ? ({ "--tint": color, "--check": readableTextOn(color) } as React.CSSProperties)
    : ({ "--tint": "var(--primary)", "--check": "var(--primary-foreground)" } as React.CSSProperties);
  return (
    <ActionForm action={setTaskStatus} fields={{ id, status: done ? "todo" : "done" }}>
      <SubmitButton
        variant="ghost"
        size="icon"
        aria-label={done ? `Reopen “${title}”` : `Mark “${title}” as done`}
        className="group/check size-10 shrink-0 rounded-full hover:bg-[color-mix(in_oklab,var(--tint)_14%,transparent)] disabled:opacity-100"
        style={style}
      >
        <CheckMark done={done} />
      </SubmitButton>
    </ActionForm>
  );
}
