import { io } from "next/cache";
import { StatTile } from "@/components/ui/stat-tile";
import { courseResult, gpaBySemester } from "@/features/grades/logic";
import { listGradebook } from "@/features/grades/queries";
import { getSettings } from "@/features/settings/queries";
import { dueState } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";

const COLUMNS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

/** Three numbers at a glance: due today, overdue, and this semester's GPA. */
export async function StatsWidget() {
  const [tasks, courses, { preferences }] = await Promise.all([listOpenTasks(), listGradebook(), getSettings()]);
  await io();
  const now = new Date();
  const states = tasks.map((t) => dueState(t, now, preferences.timeZone));
  const dueToday = states.filter((s) => s === "today").length;
  const overdue = states.filter((s) => s === "overdue").length;

  const { semesters } = gpaBySemester(
    courses
      .filter((c) => !c.archived)
      .map((c) => ({
        semester: c.semester,
        credits: c.credits,
        points: courseResult(c.assessments, preferences.gradeScale).band?.points ?? null,
        archived: false,
      })),
  );
  const current = semesters[0];

  // Only numbers worth reading: a zero or a missing GPA is left out (the widget hides when none are left).
  const tiles = [
    dueToday > 0 ? (
      <StatTile key="today" label="Due today" value={dueToday} href="/tasks?due=today" tone="warning" reveal={1} />
    ) : null,
    overdue > 0 ? (
      <StatTile key="overdue" label="Overdue" value={overdue} href="/tasks?due=overdue" tone="danger" reveal={2} />
    ) : null,
    current?.gpa != null ? (
      <StatTile
        key="gpa"
        label="GPA"
        value={current.gpa}
        decimals={2}
        hint={current.label ?? undefined}
        href="/grades"
        reveal={3}
      />
    ) : null,
  ].filter(Boolean);
  if (tiles.length === 0) return null;

  return <div className={`grid gap-3 @4xl:grid-cols-1 ${COLUMNS[tiles.length]}`}>{tiles}</div>;
}
