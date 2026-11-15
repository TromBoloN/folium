"use client";

import { Check } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * The visual part of the task checkbox. While its form is submitting it already
 * shows the state being saved (fills with the course colour when completing),
 * so the click feels instant. Without JavaScript the form simply posts.
 */
export function CheckMark({ done }: { done: boolean }) {
  const { pending } = useFormStatus();
  const filled = pending ? !done : done;
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className="relative flex size-6 items-center justify-center rounded-full border-2 border-(--tint) transition-transform duration-(--dur-fast) group-active/check:scale-90"
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-(--tint) transition-[opacity,transform] duration-(--dur-base) ease-(--ease-out)",
          filled ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
      <Check
        strokeWidth={3}
        className={cn(
          "relative size-3.5 text-(--check) transition-[opacity,transform] duration-(--dur-base) ease-(--ease-out)",
          filled ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
    </span>
  );
}
