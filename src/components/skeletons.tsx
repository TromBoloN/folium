"use client";

import { useI18n } from "@/lib/i18n/client";

export function ListSkeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={useI18n().tl(label)} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} data-slot="skeleton" className="h-20 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function FormSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={useI18n().tl(label)} className="flex flex-col gap-5">
      {Array.from({ length: 4 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="flex flex-col gap-2">
          <div data-slot="skeleton" className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div data-slot="skeleton" className="h-9 animate-pulse rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}
