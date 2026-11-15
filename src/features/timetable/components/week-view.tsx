import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatTime } from "../logic";
import type { Week } from "../week";
import { DayAgenda } from "./day-agenda";
import { WeekGrid } from "./week-grid";

type Props = { week: Week; timeFormat: "24h" | "12h"; hasAnySlots: boolean; todayIndex: number };

/** The week grid on wide screens, one day at a time on phones. */
export function WeekView({ week, timeFormat, hasAnySlots, todayIndex }: Props) {
  const timeLabels = Array.from({ length: week.lastHour - week.firstHour + 1 }, (_, i) =>
    formatTime(`${String(week.firstHour + i).padStart(2, "0")}:00`, timeFormat),
  );
  const emptyThisWeek = week.days.every((d) => d.items.length === 0);

  if (!hasAnySlots && emptyThisWeek) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Your timetable is empty"
        description="Add class times to a course and they'll show up here, week by week."
      >
        <Button asChild size="sm">
          <Link href="/courses/timetable/new">Add a class time</Link>
        </Button>
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {emptyThisWeek ? <p className="text-muted-foreground text-sm">No classes this week.</p> : null}
      <div className="md:hidden">
        <DayAgenda days={week.days} initialIndex={todayIndex} />
      </div>
      <div data-wide className="hidden md:block">
        <WeekGrid week={week} timeLabels={timeLabels} />
      </div>
    </div>
  );
}
