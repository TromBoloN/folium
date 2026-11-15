"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

/**
 * Crossfades page content on navigation (View Transitions API, where supported).
 * Keyed by pathname, so only route changes animate: in-page updates such as
 * filters or a checked-off task don't fade the whole page.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
