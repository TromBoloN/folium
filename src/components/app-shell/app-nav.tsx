"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

/**
 * The active-item pill. It's a named view transition, and only the active item
 * renders it, so on navigation the browser slides it from the old item to the
 * new one (no animation library; no-op where View Transitions aren't supported).
 */
function ActivePill({ name, className }: { name: string; className: string }) {
  return (
    <ViewTransition name={name} share="auto" default="none">
      <span aria-hidden className={cn("absolute -z-10", className)} />
    </ViewTransition>
  );
}

/** Desktop: vertical list in the sidebar. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative isolate flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-sm transition-colors duration-(--dur-fast)",
              active ? "text-sidebar-active-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <ActivePill
                name="nav-pill"
                className="inset-0 rounded-xl border border-border-soft bg-sidebar-active shadow-tile"
              />
            ) : null}
            <Icon aria-hidden className={cn("size-4.5", active && "text-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: fixed tab bar at the bottom, clear of the home indicator. Solid surface (no backdrop blur on mobile). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-border-soft border-t bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-raised md:hidden"
    >
      <ul className="grid grid-cols-5 px-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative isolate flex h-16 flex-col items-center justify-center gap-1 font-medium text-xs transition-colors duration-(--dur-fast)",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <ActivePill name="nav-pill-mobile" className="inset-x-2 top-1.5 h-8 rounded-full bg-accent" />
                ) : null}
                <span className="flex h-8 items-center">
                  <Icon aria-hidden className={cn("size-5", active && "text-primary")} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
