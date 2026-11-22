"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { type ClassType, DEFAULT_CLASS_TYPES } from "../schema";

type Row = { id: string; name: string; meetings: string };

const defaultNameById = new Map(DEFAULT_CLASS_TYPES.map((d) => [d.id, d.name]));

const toRows = (types: readonly ClassType[]): Row[] =>
  types.map((t) => ({ id: t.id, name: t.name, meetings: String(t.meetings) }));

/** A fresh id for a new type; kept when it's renamed, so courses stay linked. */
const newId = () => `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Kinds of campus class and their usual meeting count ("Practicum", 8). Courses
 * pick one and start from its count. Submitted as one JSON field ("classTypes").
 */
export function ClassTypesEditor({ initial, onEdit }: { initial: readonly ClassType[] | string; onEdit?: () => void }) {
  const { t, tl } = useI18n();
  const [rows, setRows] = useState<Row[]>(() => {
    if (typeof initial !== "string") return toRows(initial).map((r) => ({ ...r, name: tl(r.name) }));
    try {
      return JSON.parse(initial) as Row[];
    } catch {
      return [];
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
      <legend className="mb-1 font-medium text-sm">{t("Class types")}</legend>
      <p className="text-muted-foreground text-xs">
        {t("Campus courses pick a type and start from its number of meetings. You can change it per course.")}
      </p>
      {/* Keep canonical English keys for untouched default types so saving in Indonesian doesn't bake translations in. */}
      <input
        type="hidden"
        name="classTypes"
        value={JSON.stringify(
          rows.map((r) => {
            const canonical = defaultNameById.get(r.id);
            return {
              id: r.id,
              name: canonical && r.name.trim() === tl(canonical) ? canonical : r.name,
              meetings: r.meetings,
            };
          }),
        )}
      />
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <li key={row.id} className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                aria-label={t("Class type name, row {n}", { n: i + 1 })}
                placeholder={t("e.g. Practicum")}
                maxLength={40}
                className="min-w-0 flex-1"
              />
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                step={1}
                value={row.meetings}
                onChange={(e) => update(i, { meetings: e.target.value })}
                aria-label={t("Meetings for {name}", { name: row.name || t("row {n}", { n: i + 1 }) })}
                className="w-20"
              />
              <span className="shrink-0 text-muted-foreground text-sm">{t("meetings")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                aria-label={t("Remove {name}", { name: row.name || t("row {n}", { n: i + 1 }) })}
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
        onClick={() => setRows((r) => [...r, { id: newId(), name: "", meetings: "16" }])}
        disabled={rows.length >= 12}
      >
        <Plus aria-hidden />
        {t("Add class type")}
      </Button>
    </fieldset>
  );
}
