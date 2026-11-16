"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { deleteTransaction, restoreTransaction } from "../actions/transactions";

/** Hard delete at once; the toast's Undo (about 8 seconds) re-inserts the same row with the same id. */
export function DeleteTransactionButton({
  id,
  label,
  onDeleted,
}: {
  id: string;
  label: string;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Delete ${label}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await deleteTransaction(id);
          if (!result.ok) {
            toast({ message: result.error, tone: "error" });
            return;
          }
          onDeleted?.();
          toast({
            message: `Deleted: ${label}`,
            duration: 8000,
            action: {
              label: "Undo",
              onClick: async () => {
                const restored = await restoreTransaction(result.data.previous);
                if (!restored.ok) toast({ message: restored.error, tone: "error" });
              },
            },
          });
        })
      }
      className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <Trash2 aria-hidden className="size-4" />
    </button>
  );
}
