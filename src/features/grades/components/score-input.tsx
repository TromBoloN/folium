"use client";

import { useState } from "react";
import { useToast } from "@/components/toast/toaster";
import { cn } from "@/lib/utils";
import { setAssessmentScore } from "../actions";

type Props = { id: string; name: string; score: number | null; maxScore: number };

/**
 * Type a score straight into the list: saves on Enter or when the field loses
 * focus, then offers Undo. Empty means "not graded yet".
 */
export function ScoreInput({ id, name, score, maxScore }: Props) {
  const toast = useToast();
  const [value, setValue] = useState(score === null ? "" : String(score));
  const [prev, setPrev] = useState(score);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (prev !== score) {
    // A new value from the server (saved elsewhere, or undone).
    setPrev(score);
    setValue(score === null ? "" : String(score));
  }

  const save = async () => {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (next === score) return;
    if (next !== null && Number.isNaN(next)) {
      setError("Enter a number.");
      return;
    }
    setSaving(true);
    const result = await setAssessmentScore(id, next);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    const previous = result.data.previous;
    toast({
      message: next === null ? `${name}: score cleared` : `${name}: ${next} / ${maxScore}`,
      action: {
        label: "Undo",
        onClick: async () => {
          await setAssessmentScore(id, previous);
        },
      },
    });
  };

  const errorId = `score-error-${id}`;
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-1 text-sm tabular-nums">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setValue(score === null ? "" : String(score));
              setError(null);
            }
          }}
          placeholder="–"
          aria-label={`Score for ${name}, out of ${maxScore}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={saving}
          className={cn(
            "h-8 w-16 rounded-md border border-input bg-transparent px-2 text-right shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
            error && "border-destructive",
          )}
        />
        <span className="text-muted-foreground">/ {maxScore}</span>
      </span>
      {error ? (
        <span id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </span>
      ) : null}
    </span>
  );
}
