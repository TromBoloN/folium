"use client";

import { Plus, Search } from "lucide-react";
import { useOpenPalette } from "./palette-provider";

/** Sidebar: opens search; shows the shortcut. */
export function SearchButton() {
  const open = useOpenPalette();
  return (
    <button
      type="button"
      onClick={() => open("search")}
      className="flex w-full items-center gap-2 rounded-xl border border-border-soft bg-surface-1 px-3 py-2 text-left text-muted-foreground text-sm shadow-tile transition-colors hover:text-foreground"
    >
      <Search aria-hidden className="size-4" />
      <span className="flex-1">Search or add…</span>
      <kbd className="rounded border border-border-soft px-1.5 font-sans text-xs">⌘K</kbd>
    </button>
  );
}

/** Mobile: a floating add button above the tab bar. */
export function AddFab() {
  const open = useOpenPalette();
  return (
    <button
      type="button"
      onClick={() => open("add")}
      aria-label="Add a task"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised transition-transform duration-(--dur-fast) active:scale-95 md:hidden"
    >
      <Plus aria-hidden className="size-6" />
    </button>
  );
}
