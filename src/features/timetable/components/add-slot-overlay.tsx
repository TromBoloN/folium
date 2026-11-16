"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

type Props = { weekday: number; firstHour: number; hours: number; week: string; dayLabel: string };

/**
 * Click an empty hour in the week grid to add a class there. Sits under the
 * class blocks; a dashed ghost shows which hour will be used. Pointer-only:
 * keyboard users have the "Add class" button above the grid.
 */
export function AddSlotOverlay({ weekday, firstHour, hours, week, dayLabel }: Props) {
  const router = useRouter();
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const hourAt = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(hours - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * hours)));
  };
  return (
    <div
      aria-hidden
      className="absolute inset-0 cursor-cell"
      onPointerMove={(e) => setHover(hourAt(e))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const hour = firstHour + hourAt(e);
        router.push(`/courses/timetable/new?weekday=${weekday}&start=${String(hour).padStart(2, "0")}:00&week=${week}`);
      }}
      title={t("Add a class on {day}", { day: dayLabel })}
    >
      {hover !== null ? (
        <div
          className="pointer-events-none absolute inset-x-1 flex items-center justify-center gap-1 rounded-lg border border-primary/50 border-dashed text-muted-foreground text-xs"
          style={{ top: `${(hover / hours) * 100}%`, height: `${100 / hours}%` }}
        >
          <Plus className="size-3.5" /> {t("Add class")}
        </div>
      ) : null}
    </div>
  );
}
