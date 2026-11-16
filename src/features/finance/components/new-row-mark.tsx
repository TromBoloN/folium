"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Rows added in this tab (quick add, the add sheet) get a short highlight when
 * they first appear after the refresh. A module-level set, not state: the list
 * is a server component and only re-mounts the new row.
 */
const added = new Set<string>();

export function markAdded(id: string) {
  added.add(id);
}

export function NewRowMark({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    if (!added.delete(id)) return;
    ref.current?.classList.add("tx-new");
  }, [id]);
  return (
    <li ref={ref} className={cn(className)}>
      {children}
    </li>
  );
}
