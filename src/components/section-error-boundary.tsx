"use client";

import { TriangleAlert } from "lucide-react";
import { catchError, type ErrorInfo } from "next/error";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for one part of a page (e.g. a dashboard widget), so a failure
 * there doesn't take down the whole page. Shows a generic message (never the
 * raw error, which could contain internals) and a retry button.
 */
function SectionErrorFallback(props: { label: string }, { error, retry }: ErrorInfo) {
  console.error(`[${props.label}]`, error);
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-dashed px-3 py-4 text-sm">
      <p className="flex items-center gap-2 text-muted-foreground">
        <TriangleAlert aria-hidden className="size-4 text-destructive" />
        {props.label} couldn&apos;t load.
      </p>
      <Button size="sm" variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}

export const SectionErrorBoundary = catchError(SectionErrorFallback);
