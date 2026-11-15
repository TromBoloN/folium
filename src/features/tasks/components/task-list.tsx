import { Pill } from "@/components/ui/pill";
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
      <ul className="tile reveal divide-y divide-border-soft overflow-hidden">
        {rows.map((r) => (
          <TaskRow key={r.task.id} task={r.task} dueLabel={r.label} dueState={r.state} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {GROUPS.filter(({ state }) => rows.some((r) => r.state === state)).map(({ state, title }, i) => {
        const group = rows.filter((r) => r.state === state);
        return (
          <section
            key={state}
            aria-labelledby={`group-${state}`}
            className="reveal flex flex-col gap-2"
            style={{ "--i": i + 3 } as React.CSSProperties}
          >
            <h2 id={`group-${state}`} className="flex items-center gap-2 px-1 font-medium text-sm">
              {title}{" "}
              <Pill tone={state === "overdue" ? "danger" : state === "today" ? "warning" : "neutral"}>
                {group.length}
              </Pill>
            </h2>
            <ul className="tile divide-y divide-border-soft overflow-hidden">
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
