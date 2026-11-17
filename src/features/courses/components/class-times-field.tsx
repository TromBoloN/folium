"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addMinutes, suggestedDuration, WEEKDAYS, weekdayLabel } from "@/features/timetable/logic";
import { useI18n } from "@/lib/i18n/client";

type Row = { id: number; weekday: string; start: string; end: string };

/**
 * Weekly class times right in the course form, so a new course is ready in
 * one go. Parallel fields (slotWeekday / slotStart / slotEnd); blank rows are
 * skipped. One row without JavaScript; "Add class time" adds more. The end
 * fills itself from the start (50 minutes per SKS) until it's typed.
 */
export function ClassTimesField({
  initialRows,
  credits,
  error,
}: {
  initialRows: number;
  credits: number;
  error?: string;
}) {
  const { t, intl } = useI18n();
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: initialRows }, (_, i) => ({ id: i, weekday: "1", start: "", end: "" })),
  );
  const [nextId, setNextId] = useState(initialRows);
  const [endTyped, setEndTyped] = useState<Set<number>>(() => new Set());
  const update = (id: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={error ? "classTimes-error" : "classTimes-hint"}>
      <legend className="mb-1 font-medium text-sm">{t("Class times")}</legend>
      <p id="classTimes-hint" className="text-muted-foreground text-xs">
        {t("When it meets each week. Leave a row blank to skip it; you can add more on the course page later.")}
      </p>
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2">
              <NativeSelect
                name="slotWeekday"
                value={row.weekday}
                onChange={(e) => update(row.id, { weekday: e.target.value })}
                aria-label={t("Day, class time {n}", { n: i + 1 })}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {weekdayLabel(d.value, "label", intl)}
                  </option>
                ))}
              </NativeSelect>
              <Input
                type="time"
                name="slotStart"
                value={row.start}
                onChange={(e) => {
                  const start = e.target.value;
                  const end = start && !endTyped.has(row.id) ? addMinutes(start, suggestedDuration(credits)) : row.end;
                  update(row.id, { start, end });
                }}
                aria-label={t("Starts, class time {n}", { n: i + 1 })}
                className="w-28"
              />
              <Input
                type="time"
                name="slotEnd"
                value={row.end}
                onChange={(e) => {
                  setEndTyped((s) => new Set(s).add(row.id));
                  update(row.id, { end: e.target.value });
                }}
                aria-label={t("Ends, class time {n}", { n: i + 1 })}
                className="w-28"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                aria-label={t("Remove class time {n}", { n: i + 1 })}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={rows.length >= 14}
        onClick={() => {
          // A new row starts on the day after the last one, at the same time.
          const last = rows.at(-1);
          const weekday = last ? String((Number(last.weekday) % 7) + 1) : "1";
          setRows((r) => [...r, { id: nextId, weekday, start: last?.start ?? "", end: last?.end ?? "" }]);
          setNextId((n) => n + 1);
        }}
      >
        <Plus aria-hidden />
        {t("Add class time")}
      </Button>
      {error ? (
        <p id="classTimes-error" className="text-destructive text-xs" aria-live="polite">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
