import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatTime } from "../logic";
import type { Week } from "../week";
import { DayAgenda } from "./day-agenda";
import { WeekGrid } from "./week-grid";

type Props = { week: Week; timeFormat: "24h" | "12h"; hasAnySlots: boolean; todayIndex: number };

export function WeekView({ week, timeFormat, hasAnySlots, todayIndex }: Props) {
  const timeLabels = Array.from({ length: week.lastHour - week.firstHour + 1 }, (_, i) =>
    formatTime(`${String(week.firstHour + i).padStart(2, "0")}:00`, timeFormat),
  );
  const emptyThisWeek = week.days.every((d) => d.items.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{week.label}</h2>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/courses/timetable/new?week=${week.days[0].date}`}>
              <CalendarPlus aria-hidden />
              Add class
            </Link>
          </Button>
          <nav aria-label="Week" className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon">
              <Link href={`/courses/timetable?week=${week.previous}`} aria-label="Previous week">
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            {week.containsToday ? null : (
              <Button asChild variant="outline" size="sm">
                <Link href="/courses/timetable">This week</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon">
              <Link href={`/courses/timetable?week=${week.next}`} aria-label="Next week">
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </nav>
        </div>
      </div>

      {!hasAnySlots ? (
        <EmptyState
          icon={CalendarDays}
          title="Your timetable is empty"
          description="Add class times to a course and they'll show up here, week by week."
        >
          <Button asChild size="sm">
            <Link href="/courses">Go to courses</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          {emptyThisWeek ? <p className="text-muted-foreground text-sm">No classes this week.</p> : null}
          <div className="md:hidden">
            <DayAgenda days={week.days} initialIndex={todayIndex} />
          </div>
          <div data-wide className="hidden md:block">
            <WeekGrid week={week} timeLabels={timeLabels} />
          </div>
        </>
      )}
    </div>
  );
}
