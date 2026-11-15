"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_GRADE_SCALE, type GradeBand } from "../scale";

type Row = { letter: string; min: string; points: string };

const toRows = (scale: readonly GradeBand[]): Row[] =>
  scale.map((b) => ({ letter: b.letter, min: String(b.min), points: String(b.points) }));

/**
 * Edits the percentage → letter → points table. The whole scale is submitted
 * as one JSON field ("gradeScale"), so it round-trips through the form's
 * value echo like any other field.
 */
export function GradeScaleEditor({
  initial,
  onEdit,
}: {
  initial: readonly GradeBand[] | string;
  /** Called after any change to the table (typing, adding or removing a band, resetting). */
  onEdit?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (typeof initial !== "string") return toRows(initial);
    try {
      return JSON.parse(initial) as Row[];
    } catch {
      return toRows(DEFAULT_GRADE_SCALE);
    }
  });
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the rows change, by design
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onEdit?.();
  }, [rows]);
  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-medium text-sm">Grade scale</legend>
      <p id="grade-scale-hint" className="text-muted-foreground text-xs">
        A percentage of at least the minimum earns that letter and those grade points. Default: Indonesian 4.0 scale.
      </p>
      <input type="hidden" name="gradeScale" value={JSON.stringify(rows)} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th scope="col" className="pb-1 font-normal">
                Letter
              </th>
              <th scope="col" className="pb-1 font-normal">
                Min %
              </th>
              <th scope="col" className="pb-1 font-normal">
                Points
              </th>
              <th scope="col" className="pb-1">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity; order is the identity
              <tr key={i}>
                <td className="py-1 pr-2">
                  <Input
                    value={row.letter}
                    onChange={(e) => update(i, { letter: e.target.value })}
                    aria-label={`Letter, row ${i + 1}`}
                    maxLength={3}
                    className="w-16"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    value={row.min}
                    onChange={(e) => update(i, { min: e.target.value })}
                    aria-label={`Minimum percentage, row ${i + 1}`}
                    className="w-20"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={5}
                    step="any"
                    value={row.points}
                    onChange={(e) => update(i, { points: e.target.value })}
                    aria-label={`Grade points, row ${i + 1}`}
                    className="w-20"
                  />
                </td>
                <td className="py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                    disabled={rows.length <= 2}
                    aria-label={`Remove ${row.letter || `row ${i + 1}`}`}
                  >
                    <X aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((r) => [...r, { letter: "", min: "", points: "" }])}
          disabled={rows.length >= 15}
        >
          <Plus aria-hidden />
          Add band
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRows(toRows(DEFAULT_GRADE_SCALE))}>
          <RotateCcw aria-hidden />
          Use the Indonesian 4.0 scale
        </Button>
      </div>
    </fieldset>
  );
}
