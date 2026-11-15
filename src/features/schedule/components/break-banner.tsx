"use client";

import { CalendarOff } from "lucide-react";
import { useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { removeBreak, restoreBreak } from "../actions";

/** "No classes · Exam week" on days a break covers, with Remove (and Undo). */
export function BreakBanner({ id, label }: { id: string; label: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl border border-border-soft border-dashed px-3 py-2 text-muted-foreground text-sm">
      <CalendarOff aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">
        No classes · <span className="text-foreground">{label}</span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await removeBreak(id);
            if (!result.ok) {
              toast({ message: result.error, tone: "error" });
              return;
            }
            toast({
              message: `Removed break: ${label}`,
              action: { label: "Undo", onClick: async () => void (await restoreBreak(result.data.previous)) },
            });
          })
        }
        className="rounded-md px-2 py-0.5 text-xs underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove break"}
      </button>
    </p>
  );
}
