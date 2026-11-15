import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A short group of fields under a small heading with an icon ("Basics", "Lecturer and contact"). */
export function FormSection({
  title,
  icon: Icon,
  description,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-4", className)}>
      <legend className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {Icon ? (
          <span className="flex size-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Icon aria-hidden className="size-3.5" />
          </span>
        ) : null}
        {title}
      </legend>
      {description ? <p className="-mt-2 text-muted-foreground text-sm">{description}</p> : null}
      {children}
    </fieldset>
  );
}

/**
 * Optional fields, folded away. A native <details>, so it works without
 * JavaScript; open it when a field inside has an error or a value.
 */
export function MoreDetails({
  summary = "More details",
  hint,
  open,
  children,
}: {
  summary?: string;
  hint?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group rounded-xl border border-border-soft bg-surface-1/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-medium text-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
        <span className="flex flex-col">
          {summary}
          {hint ? <span className="font-normal text-muted-foreground text-xs">{hint}</span> : null}
        </span>
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="flex flex-col gap-5 px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}
