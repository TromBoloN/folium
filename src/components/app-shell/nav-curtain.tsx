"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Loader } from "../loader";
import { usePagePath } from "./use-page-path";

/** Longest the curtain may stay up, whatever happens. */
const CAP_MS = 4000;
/** Suspense fallbacks still on the page: labelled loading statuses, or any status still pulsing. */
const LOADING = 'main [role="status"][aria-label^="Loading"], main [role="status"]:has(.animate-pulse)';

/** A number of milliseconds from a CSS custom property on <html> (`--nav-min: 350`). */
function cssMs(name: string, fallback: number) {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * A curtain with the logo over the content area while a new page loads, so a page
 * never shows itself half-built. It's decided when a route commits, before the
 * browser paints it (a layout effect): if the page underneath changed and still has
 * loading skeletons, <html data-navigating> covers it at once; it lifts when the
 * skeletons are gone, after at least `--nav-min` ms so the animation reads.
 *
 * Nothing happens on the click itself: a link can open a sheet (an intercepted route)
 * as easily as a page, and closing a sheet goes "back", so only the committed route
 * says whether the page changed. Opening or closing a sheet never shows the curtain.
 * Decorative and never blocks input; packs restyle it via `[data-variant="nav"]`.
 */
export function NavCurtain() {
  const pathname = usePathname();
  const pagePath = usePagePath();
  const lastPage = useRef(pagePath);
  const timers = useRef<number[]>([]);
  const frame = useRef(0);

  const clear = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    cancelAnimationFrame(frame.current);
  };
  const end = () => {
    clear();
    document.documentElement.removeAttribute("data-navigating");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: unmount cleanup only
  useEffect(() => end, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every committed route change
  useLayoutEffect(() => {
    const pageChanged = pagePath !== lastPage.current;
    lastPage.current = pagePath;
    // A sheet opened or closed over the same page, or the new page is already complete.
    if (!pageChanged || !document.querySelector(LOADING)) return;

    clear();
    const shownAt = performance.now();
    document.documentElement.setAttribute("data-navigating", "");
    timers.current.push(window.setTimeout(end, CAP_MS));
    const settle = () => {
      if (document.querySelector(LOADING)) {
        frame.current = requestAnimationFrame(settle);
        return;
      }
      const left = shownAt + cssMs("--nav-min", 350) - performance.now();
      timers.current.push(window.setTimeout(end, Math.max(0, left)));
    };
    frame.current = requestAnimationFrame(settle);
  }, [pathname, pagePath]);

  return <Loader variant="nav" />;
}
