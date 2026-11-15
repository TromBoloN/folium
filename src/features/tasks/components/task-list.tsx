import { type DueState, dueState, formatDue } from "../due";
import type { Task } from "../queries";
import { TaskRow } from "./task-row";

type Props = { tasks: Task[]; now: Date; timeZone: string; timeFormat: "24h" | "12h"; grouped: boolean };

const GROUPS: { state: DueState; title: string }[] = [
  { state: "overdue", title: "Overdue" },
  { state: "today", title: "Today" },
  { state: "soon", title: "Next few days" },
  { state: "later", title: "Later" },
  { state: "none", title: "No deadline" },
];

export function TaskList({ tasks, now, timeZone, timeFormat, grouped }: Props) {
  const rows = tasks.map((task) => ({
    task,
    state: dueState(task, now, timeZone),
    label: formatDue(task, now, timeZone, timeFormat),
  }));

  if (!grouped) {
    return (
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((r) => (
          <TaskRow key={r.task.id} task={r.task} dueLabel={r.label} dueState={r.state} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map(({ state, title }) => {
        const group = rows.filter((r) => r.state === state);
        if (group.length === 0) return null;
        return (
          <section key={state} aria-labelledby={`group-${state}`} className="flex flex-col gap-2">
            <h2
              id={`group-${state}`}
              className={`font-medium text-sm ${state === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {title} <span className="font-normal">({group.length})</span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {group.map((r) => (
                <TaskRow key={r.task.id} task={r.task} dueLabel={r.label} dueState={r.state} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
