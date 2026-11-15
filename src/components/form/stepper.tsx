"use client";

import { Minus, Plus } from "lucide-react";
import { useRef } from "react";
import { CONTROL, CONTROL_HEIGHT } from "@/components/ui/control";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type"> & { unit?: string; step?: number; min?: number; max?: number };

/**
 * A number with − and + buttons and its unit ("3 SKS"). The input is a plain
 * number field, so typing and forms without JavaScript work as usual.
 */
export function Stepper({ unit, step = 1, min, max, className, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const nudge = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    if (direction === 1) el.stepUp();
    else el.stepDown();
    // stepUp/Down don't fire input events; tell React and the field's own checks.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const button =
    "flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:size-10";
  return (
    <div className={cn(CONTROL, CONTROL_HEIGHT, "flex w-fit items-stretch overflow-hidden p-0", className)}>
      <button type="button" tabIndex={-1} aria-hidden className={button} onClick={() => nudge(-1)}>
        <Minus className="size-4" />
      </button>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        onChange={onChange}
        className="w-14 bg-transparent text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        {...props}
      />
      {unit ? <span className="flex items-center pr-1 text-muted-foreground text-sm">{unit}</span> : null}
      <button type="button" tabIndex={-1} aria-hidden className={button} onClick={() => nudge(1)}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}
