"use client";

import { useState } from "react";
import { useToast } from "@/components/toast/toaster";
import { setAttendance } from "@/features/schedule/actions";
import { AttendanceQuick } from "@/features/schedule/components/attendance-quick";

type Item = { key: string; color: string; name: string; when: string };

/** One row per class; a marked row leaves, with Undo in the toast. */
export function AttendancePromptList({ items }: { items: Item[] }) {
  const [done, setDone] = useState<string[]>([]);
  const toast = useToast();
  const left = items.filter((i) => !done.includes(i.key));
  if (left.length === 0) {
    return <p className="text-muted-foreground text-sm sm:pt-2">All marked. Thanks!</p>;
  }
  return (
    <ul className="flex min-w-0 flex-1 flex-col divide-y divide-border-soft">
      {left.map((i) => (
        <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full bg-(--c)"
              style={{ "--c": i.color } as React.CSSProperties}
            />
            <span className="truncate font-medium">{i.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{i.when}</span>
          </span>
          <AttendanceQuick
            occurrenceKey={i.key}
            initial={null}
            label={`${i.name}, ${i.when}`}
            onMarked={(status) => {
              if (!status) return;
              setDone((d) => [...d, i.key]);
              toast({
                message: `${status === "attended" ? "Attended" : "Missed"}: ${i.name}`,
                action: {
                  label: "Undo",
                  onClick: async () => {
                    await setAttendance({ key: i.key, status: null });
                    setDone((d) => d.filter((k) => k !== i.key));
                  },
                },
              });
            }}
          />
        </li>
      ))}
    </ul>
  );
}
