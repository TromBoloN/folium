"use client";

import { useEffect } from "react";

/**
 * Page-wide motion plumbing, mounted once in the shell. Renders nothing.
 * - Marks <html data-tab-hidden> while the tab is hidden, so the ambient drift pauses.
 * - Marks <html data-hydrated> once client code runs (e2e tests wait for it before clicking).
 * - One delegated pointermove handler feeds --mx/--my to the [data-spotlight]
 *   tile under the pointer (hover devices only), batched to one write per frame.
 */
export function MotionRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.hydrated = "";
    const onVisibility = () => root.toggleAttribute("data-tab-hidden", document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    const hover = window.matchMedia("(hover: hover)");
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const event = last;
      if (!event || !(event.target instanceof Element)) return;
      const tile = event.target.closest<HTMLElement>("[data-spotlight]");
      if (!tile) return;
      const rect = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      tile.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !hover.matches) return;
      last = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointermove", onPointerMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
