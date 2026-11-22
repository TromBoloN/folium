import { ArrowRight } from "lucide-react";
import { io } from "next/cache";
import Link from "next/link";
import { getSettings } from "@/features/settings/queries";
import { BulkOverdueBar } from "@/features/tasks/components/bulk-overdue-bar";
import { TaskRow } from "@/features/tasks/components/task-row";
import { type DueState, dueState, formatDue, isUrgentToday } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";
import { plural } from "@/lib/i18n/core";
import { getI18n } from "@/lib/i18n/server";
import { WidgetEmpty } from "../components/widget-frame";

const LIMIT = 5;

async function TasksIn({
  states,
  empty,
  moreHref,
  showWaitingLink,
}: {
  states: DueState[];
  empty: string;
  moreHref: string;
  showWaitingLink?: boolean;
}) {
  const [tasks, { preferences }, i18n] = await Promise.all([listOpenTasks(), getSettings(), getI18n()]);
  await io();
  const now = new Date();
  const withState = tasks.map((task) => ({ task, state: dueState(task, now, preferences.timeZone) }));
  const rows = withState.filter((r) => states.includes(r.state));
  const waitingCount = showWaitingLink ? withState.filter((r) => r.state === "overdue").length : 0;

  if (rows.length === 0 && waitingCount === 0) return <WidgetEmpty>{i18n.tl(empty)}</WidgetEmpty>;

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 ? (
        <ul className="-mx-4 divide-y divide-border-soft border-border-soft border-y sm:-mx-5">
          {rows.slice(0, LIMIT).map(({ task, state }) => (
            <TaskRow
              key={task.id}
              task={task}
              dueState={state}
              urgent={state === "today" && isUrgentToday(task, now)}
              dueLabel={formatDue(task, now, preferences.timeZone, preferences.timeFormat, i18n)}
            />
          ))}
        </ul>
      ) : null}
      {states.includes("overdue") && rows.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <BulkOverdueBar ids={rows.map((r) => r.task.id)} />
          {rows.length > LIMIT ? (
            <Link href={moreHref} className="w-fit text-muted-foreground text-sm hover:text-foreground">
              {i18n.t("+ {n} more", { n: rows.length - LIMIT })}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {rows.length > LIMIT ? (
            <Link href={moreHref} className="w-fit text-muted-foreground text-sm hover:text-foreground">
              {i18n.t("+ {n} more", { n: rows.length - LIMIT })}
            </Link>
          ) : null}
          {waitingCount > 0 ? (
            <Link
              href="/tasks?due=overdue"
              className="inline-flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
            >
              {i18n.t(plural(waitingCount, "1 waiting", "{n} waiting"), { n: waitingCount })}
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function DueSoonWidget() {
  return (
    <TasksIn
      states={["today", "soon"]}
      empty="Nothing due in the next few days."
      moreHref="/tasks?due=week"
      showWaitingLink
    />
  );
}

export function OverdueWidget() {
  return <TasksIn states={["overdue"]} empty="Nothing overdue. You're all caught up." moreHref="/tasks?due=overdue" />;
}
