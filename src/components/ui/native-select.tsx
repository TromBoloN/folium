import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL, CONTROL_HEIGHT } from "./control";

/**
 * A styled native <select>: best on phones, accessible by default. Where the
 * browser supports it, the open list is drawn as an app popover (see "Selects"
 * in globals.css); elsewhere the system list, with readable theme colours.
 */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(CONTROL, CONTROL_HEIGHT, "appearance-none py-1 pr-9 pl-3", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
