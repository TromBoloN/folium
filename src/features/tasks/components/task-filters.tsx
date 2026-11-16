"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import type { CourseOption } from "../../courses/queries";
import type { TaskFilters as Filters } from "../schema";

const DUE: { value: Filters["due"]; label: MessageKey }[] = [
  { value: "any", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

function href(current: Filters, change: Partial<Filters>) {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  if (next.status !== "open") params.set("status", next.status);
  if (next.due !== "any") params.set("due", next.due);
  if (next.course) params.set("course", next.course);
  const qs = params.toString();
  return qs ? `/tasks?${qs}` : "/tasks";
}

/** Filters live in the URL, so a filtered list can be bookmarked and the back button works. */
export function TaskFilters({ current, courses }: { current: Filters; courses: CourseOption[] }) {
  const router = useRouter();
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label={t("Due")}
        className="flex w-fit max-w-full flex-wrap gap-1 rounded-pill border border-border-soft bg-surface-1 p-1 shadow-tile xl:grid xl:w-full xl:grid-cols-2 xl:rounded-2xl"
      >
        {DUE.map((d) => {
          const active = current.due === d.value;
          return (
            <Link
              key={d.value}
              href={href(current, { due: d.value })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-pill px-3.5 py-1.5 text-center font-medium text-sm transition-colors duration-(--dur-fast) xl:px-2",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t(d.label)}
            </Link>
          );
        })}
      </nav>
      <div className="grid grid-cols-2 gap-2 sm:max-w-md xl:max-w-none">
        <NativeSelect
          aria-label={t("Status")}
          value={current.status}
          onChange={(e) => router.push(href(current, { status: e.target.value as Filters["status"] }))}
        >
          <option value="open">{t("Open")}</option>
          <option value="done">{t("Done")}</option>
          <option value="all">{t("All statuses")}</option>
        </NativeSelect>
        <NativeSelect
          aria-label={t("Course")}
          value={current.course ?? ""}
          onChange={(e) => router.push(href(current, { course: e.target.value || undefined }))}
        >
          <option value="">{t("All courses")}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.archived ? " (archived)" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
