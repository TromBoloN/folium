"use client";

import { useLayoutEffect, useRef } from "react";
import { motionLevel } from "@/lib/motion";

type Props = { value: number; decimals?: number; durationMs?: number };

/**
 * A number that counts up from zero when it first appears.
 * The final value is always in the DOM: it's what the server renders, what a
 * screen reader reads (a visually hidden copy; the animated digits are hidden
 * from assistive tech), and what shows with reduced motion. It only animates
 * while its tile is still fading in, so a server-rendered number that's already
 * visible never jumps back to zero on hydration. Frames write the digits straight
 * to the text node (no React re-render per frame) and end on the same text React rendered.
 */
export function CountUp({ value, decimals = 0, durationMs = 700 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = value.toFixed(decimals);

  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE || value === 0 || motionLevel() !== "full") return;
    const entrance = ref.current
      ?.closest(".reveal")
      ?.getAnimations()
      .find((a) => a.playState === "running");
    if (!entrance || Number(entrance.currentTime ?? Number.POSITIVE_INFINITY) > 200) return;

    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      node.nodeValue = (value * (1 - (1 - p) ** 3)).toFixed(decimals);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    node.nodeValue = (0).toFixed(decimals);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      // Restore what React last rendered (the sr-only twin), never this effect's own value:
      // when the value changes, React writes the new text before this cleanup runs.
      node.nodeValue = ref.current?.nextSibling?.textContent ?? node.nodeValue;
    };
  }, [value, decimals, durationMs]);

  return (
    <span className="tabular-nums">
      <span ref={ref} aria-hidden>
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
