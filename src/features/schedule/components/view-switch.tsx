"use client";

import { CalendarDays, LayoutGrid, Rows3 } from "lucide-react";
import Link from "next/link";
import { rememberCoursesView } from "@/features/settings/actions";
import type { CoursesView } from "@/features/settings/schema";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";

const VIEWS: { value: CoursesView; label: MessageKey; icon: typeof LayoutGrid }[] = [
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "day", label: "By day", icon: Rows3 },
  { value: "week", label: "Week", icon: CalendarDays },
];

/**
 * Cards · By day · Week. The choice is in the URL (?view=, so a link opens the
 * same view) and remembered for next time.
 */
export function ViewSwitch({ current, week }: { current: CoursesView; week?: string }) {
  const t = useT();
  return (
    <nav
      aria-label={t("View")}
      className="flex w-fit max-w-full gap-1 rounded-full border border-border-soft bg-surface-1 p-1 shadow-tile"
    >
      {VIEWS.map((v) => {
        const active = v.value === current;
        const params = new URLSearchParams({ view: v.value });
        if (week && v.value !== "cards") params.set("week", week);
        return (
          <Link
            key={v.value}
            href={`/courses?${params}`}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (!active) void rememberCoursesView(v.value);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium text-sm transition-colors duration-(--dur-fast)",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <v.icon aria-hidden className="size-4" />
            {t(v.label)}
          </Link>
        );
      })}
    </nav>
  );
}
