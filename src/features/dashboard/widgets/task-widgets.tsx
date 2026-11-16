import { io } from "next/cache";
import Link from "next/link";
import { getSettings } from "@/features/settings/queries";
import { TaskRow } from "@/features/tasks/components/task-row";
import { type DueState, dueState, formatDue } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";
import { getI18n } from "@/lib/i18n/server";
import { WidgetEmpty } from "../components/widget-frame";

const LIMIT = 5;

async function TasksIn({ states, empty, moreHref }: { states: DueState[]; empty: string; moreHref: string }) {
  const [tasks, { preferences }, i18n] = await Promise.all([listOpenTasks(), getSettings(), getI18n()]);
  await io();
  const now = new Date();
  const rows = tasks
    .map((task) => ({ task, state: dueState(task, now, preferences.timeZone) }))
    .filter((r) => states.includes(r.state));

  if (rows.length === 0) return <WidgetEmpty>{i18n.tl(empty)}</WidgetEmpty>;

  return (
    <div className="flex flex-col gap-2">
      <ul className="-mx-4 divide-y divide-border-soft border-border-soft border-y sm:-mx-5">
        {rows.slice(0, LIMIT).map(({ task, state }) => (
          <TaskRow
            key={task.id}
            task={task}
            dueState={state}
            dueLabel={formatDue(task, now, preferences.timeZone, preferences.timeFormat, i18n)}
          />
        ))}
      </ul>
      {rows.length > LIMIT ? (
        <Link href={moreHref} className="w-fit text-muted-foreground text-sm hover:text-foreground">
          {i18n.t("+ {n} more", { n: rows.length - LIMIT })}
        </Link>
      ) : null}
    </div>
  );
}

export function DueSoonWidget() {
  return <TasksIn states={["today", "soon"]} empty="Nothing due in the next few days." moreHref="/tasks?due=week" />;
}

export function OverdueWidget() {
  return <TasksIn states={["overdue"]} empty="Nothing overdue. You're all caught up." moreHref="/tasks?due=overdue" />;
}
