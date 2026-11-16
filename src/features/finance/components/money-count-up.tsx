"use client";

import { useLayoutEffect, useRef } from "react";
import { motionLevel } from "@/lib/motion";
import { formatIdr } from "../lib/format-idr";

/**
 * A rupiah amount that counts up when its tile fades in, like CountUp elsewhere:
 * the final text is server-rendered and read by screen readers, it only animates
 * on entrance with full motion, and frames write straight to the text node.
 * `amount` is a bigint as a string (props must be serialisable).
 */
export function MoneyCountUp({ amount, durationMs = 700 }: { amount: string; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const value = BigInt(amount);
  const text = formatIdr(value);

  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    const target = BigInt(amount);
    const safe = target <= BigInt(Number.MAX_SAFE_INTEGER) && target >= -BigInt(Number.MAX_SAFE_INTEGER);
    if (!node || node.nodeType !== Node.TEXT_NODE || target === 0n || !safe || motionLevel() !== "full") return;
    const entrance = ref.current
      ?.closest(".reveal")
      ?.getAnimations()
      .find((a) => a.playState === "running");
    if (!entrance || Number(entrance.currentTime ?? Number.POSITIVE_INFINITY) > 200) return;

    const end = Number(target);
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      node.nodeValue = p < 1 ? formatIdr(Math.round(end * (1 - (1 - p) ** 3))) : formatIdr(target);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    node.nodeValue = formatIdr(0);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      // Restore what React last rendered (the sr-only twin), never this effect's own amount:
      // when the amount changes (e.g. after adding a transaction), React writes the new text
      // before this cleanup runs, and writing the old one back would leave a stale balance.
      node.nodeValue = ref.current?.nextSibling?.textContent ?? node.nodeValue;
    };
  }, [amount, durationMs]);

  return (
    <span className="tabular-nums">
      <span ref={ref} aria-hidden>
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
