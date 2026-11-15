"use client";

import { useSelectedLayoutSegments } from "next/navigation";

/**
 * The path of the page in the main slot, ignoring any sheet open on top
 * (an intercepted route changes usePathname() but not the page underneath).
 * Must be used by a component rendered from the (app) layout.
 */
export function usePagePath(): string {
  const segments = useSelectedLayoutSegments().filter((s) => !s.startsWith("("));
  return `/${segments.join("/")}`;
}
