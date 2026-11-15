"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/courses", label: "Courses" },
  { href: "/courses/timetable", label: "Timetable" },
];

export function CourseTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Courses sections" className="mb-6 inline-flex rounded-lg bg-muted p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-4 py-1.5 font-medium text-sm transition-colors",
              active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
