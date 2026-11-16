"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";
import { activeTabHref, type SectionTab } from "@/lib/sections";
import { cn } from "@/lib/utils";

export const tabClass =
  "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 font-medium text-sm outline-none transition-colors duration-(--dur-fast) focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/30";

/**
 * A section's tab bar (School, Money). Plain links, so keyboard and no-JS just
 * work. The active tab (nested routes included, see `matchPrefix`) gets
 * aria-current: "page" on the tab's own URL, "true" below it. On a phone it
 * scrolls sideways and keeps the active tab in view. `extra` is appended as a
 * last item (Money's "Manage" marker).
 */
export function SectionTabs({
  label,
  items,
  extra,
}: {
  label: string;
  items: readonly SectionTab[];
  extra?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t: tr, tl } = useI18n();
  const activeHref = activeTabHref(pathname, items);
  const active = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (pathname) active.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav
      aria-label={tl(label)}
      data-slot="section-tabs"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      <ul className="flex min-w-max items-center gap-1 border-border-soft border-b">
        {items.map((t) => {
          const current = activeHref === t.href;
          return (
            <li key={t.href}>
              <Link
                ref={current ? active : undefined}
                href={t.href}
                aria-current={current ? (pathname.replace(/\/+$/, "") === t.href ? "page" : "true") : undefined}
                className={cn(
                  tabClass,
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tr(t.label)}
              </Link>
            </li>
          );
        })}
        {extra ? <li>{extra}</li> : null}
      </ul>
    </nav>
  );
}
