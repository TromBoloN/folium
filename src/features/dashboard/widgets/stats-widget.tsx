import { io } from "next/cache";
import { StatTile } from "@/components/ui/stat-tile";
import { courseResult, gpaBySemester } from "@/features/grades/logic";
import { listGradebook } from "@/features/grades/queries";
import { getSettings } from "@/features/settings/queries";
import { dueState } from "@/features/tasks/due";
import { listOpenTasks } from "@/features/tasks/queries";

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

  return (
    <div className="grid grid-cols-3 gap-3 @4xl:grid-cols-1">
      <StatTile
        label="Due today"
        value={dueToday}
        hint={dueToday === 0 ? "Nothing left" : undefined}
        href="/tasks?due=today"
        tone="warning"
        reveal={1}
      />
      <StatTile
        label="Overdue"
        value={overdue}
        hint={overdue === 0 ? "All caught up" : undefined}
        href="/tasks?due=overdue"
        tone="danger"
        reveal={2}
      />
      <StatTile
        label="GPA"
        value={current?.gpa ?? null}
        decimals={2}
        hint={current?.label ?? "No grades yet"}
        href="/grades"
        reveal={3}
      />
    </div>
  );
}
