"use client";

import { useSheet } from "@/components/sheet";
import { cn } from "@/lib/utils";

/**
 * Cancel and Save, always in reach: sticky at the bottom of the sheet, or of
 * the screen above the phone tab bar on a full page.
 */
export function FormFooter({ children, error }: { children: React.ReactNode; error?: string | null }) {
  const sheet = useSheet();
  return (
    <div
      className={cn(
        "sticky z-10 -mx-5 mt-2 flex flex-col gap-2 border-border-soft border-t bg-popover/95 px-5 py-3 backdrop-blur",
        sheet ? "-mb-5 bottom-0" : "bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] rounded-b-tile md:bottom-0",
      )}
    >
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-row-reverse flex-wrap items-center justify-start gap-2">{children}</div>
    </div>
  );
}
