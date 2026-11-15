"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { readableTextOn } from "@/lib/color";
import { cn } from "@/lib/utils";
import { COURSE_COLORS } from "../schema";

/**
 * Suggested colours plus a free picker. The native colour input carries the
 * value, so the form still works without JavaScript.
 */
export function ColorField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const [color, setColor] = useState(defaultValue.toLowerCase());
  return (
    <fieldset className="grid gap-2" aria-describedby={error ? "color-error" : undefined}>
      <legend className="mb-2 font-medium text-sm">Colour</legend>
      <div className="flex flex-wrap items-center gap-2">
        {COURSE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Use colour ${c}`}
            aria-pressed={color === c}
            style={{ "--course": c, color: readableTextOn(c) } as React.CSSProperties}
            className={cn(
              "flex size-8 items-center justify-center rounded-full bg-(--course) ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              color === c && "ring-2 ring-foreground",
            )}
          >
            {color === c ? <Check aria-hidden className="size-4" /> : null}
          </button>
        ))}
        <label className="flex items-center gap-2 text-muted-foreground text-sm">
          <input
            type="color"
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Custom colour"
            className="h-8 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
          />
          Custom
        </label>
      </div>
      {error ? (
        <p id="color-error" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
