import type * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL } from "./control";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "flex min-h-24 px-3 py-2", className)} {...props} />;
}
