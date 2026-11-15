"use client";

import { ViewTransition } from "react";
import { usePagePath } from "./use-page-path";

/**
 * Crossfades page content on navigation (View Transitions API, where supported).
 * Keyed by pathname, so only route changes animate: in-page updates such as
 * filters or a checked-off task don't fade the whole page.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  // The page path, not usePathname(): opening a sheet must not remount (and fade) the page behind it.
  const pathname = usePagePath();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
