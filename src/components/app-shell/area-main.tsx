"use client";

import { pageArea } from "./page-area";
import { usePagePath } from "./use-page-path";

/** The page's `<main>`, tagged with its area (`data-area="tasks"`) for theme packs. Purely a styling hook. */
export function AreaMain({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main data-area={pageArea(usePagePath())} className={className}>
      {children}
    </main>
  );
}
