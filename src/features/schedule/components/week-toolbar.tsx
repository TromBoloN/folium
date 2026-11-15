"use client";

import {
  CalendarOff,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  view: "day" | "week";
  label: string;
  previous: string;
  next: string;
  containsToday: boolean;
  /** First day of the shown week: where new things default to. */
  weekStart: string;
};

/** Week label, previous/next/Today, and the Add menu (class time, extra session, break). */
export function WeekToolbar({ view, label, previous, next, containsToday, weekStart }: Props) {
  const href = (week?: string) => `/courses?view=${view}${week ? `&week=${week}` : ""}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon">
          <Link href={href(previous)} aria-label="Previous week">
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-0 font-medium tabular-nums">{label}</h2>
        <Button asChild variant="ghost" size="icon">
          <Link href={href(next)} aria-label="Next week">
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="ml-1">
          <Link href={href()} aria-current={containsToday ? "date" : undefined}>
            Today
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus aria-hidden />
              Add to schedule
              <ChevronDown aria-hidden className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem asChild>
              <Link href={`/courses/timetable/new?week=${weekStart}`}>
                <CalendarPlus aria-hidden />
                Weekly class time
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/courses/extra/new?date=${weekStart}`}>
                <Sparkles aria-hidden />
                Extra session (makeup, exam)
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/courses/breaks/new?from=${weekStart}`}>
                <CalendarOff aria-hidden />
                Break (no classes)
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="xl:hidden" />
            <DropdownMenuItem asChild className="xl:hidden">
              <a href="/courses/calendar.ics" download>
                <Download aria-hidden />
                Export to calendar (.ics)
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
