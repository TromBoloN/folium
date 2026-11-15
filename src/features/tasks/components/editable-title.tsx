"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTaskOps } from "./task-ops";

/** The task's title as a heading; click it to rename in place (Enter saves, Escape cancels). */
export function EditableTitle({ id, title, done }: { id: string; title: string; done: boolean }) {
  const ops = useTaskOps();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(title);
  const [prev, setPrev] = useState(title);
  if (prev !== title) {
    // The server sent a new title (saved or undone): show it.
    setPrev(title);
    setShown(title);
  }

  const save = async (value: string) => {
    const next = value.trim();
    setEditing(false);
    if (!next || next === shown) return;
    setShown(next);
    const ok = await ops.patch({ id, title: next }, `Renamed to “${next}”`);
    if (!ok) setShown(title);
  };

  if (editing) {
    return (
      <Input
        defaultValue={shown}
        aria-label="Task title"
        maxLength={200}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") save(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => save(e.currentTarget.value)}
        className="h-auto py-1 font-display font-medium text-2xl md:text-3xl"
      />
    );
  }
  return (
    <h1 className="font-display font-medium text-2xl leading-tight tracking-tight md:text-3xl">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "group/title inline rounded-md text-left decoration-border underline-offset-4 hover:underline",
          done && "text-muted-foreground line-through",
        )}
      >
        <span className="sr-only">Rename: </span>
        {shown}
        <Pencil
          aria-hidden
          className="ml-2 inline size-4 align-baseline text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
        />
      </button>
    </h1>
  );
}
