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
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const href = (week?: string) => `/courses?view=${view}${week ? `&week=${week}` : ""}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon">
          <Link href={href(previous)} aria-label={t("Previous week")}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-0 font-medium tabular-nums">{label}</h2>
        <Button asChild variant="ghost" size="icon">
          <Link href={href(next)} aria-label={t("Next week")}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="ml-1">
          <Link href={href()} aria-current={containsToday ? "date" : undefined}>
            {t("Today")}
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus aria-hidden />
              {t("Add to schedule")}
              <ChevronDown aria-hidden className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem asChild>
              <Link href={`/courses/timetable/new?week=${weekStart}`}>
                <CalendarPlus aria-hidden />
                {t("Weekly class time")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/courses/extra/new?date=${weekStart}`}>
                <Sparkles aria-hidden />
                {t("Extra session (makeup, exam)")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/courses/breaks/new?from=${weekStart}`}>
                <CalendarOff aria-hidden />
                {t("Break (no classes)")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="xl:hidden" />
            <DropdownMenuItem asChild className="xl:hidden">
              <a href="/courses/calendar.ics" download>
                <Download aria-hidden />
                {t("Export to calendar (.ics)")}
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
