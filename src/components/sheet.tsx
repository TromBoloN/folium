"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/action-result";

type SheetApi = { close: (options?: { refresh?: boolean }) => void };
const SheetContext = createContext<SheetApi | null>(null);

/** The sheet this component is in, or null on a full page. */
export function useSheet() {
  return useContext(SheetContext);
}

/** Name of the hidden field that tells an action it was submitted from a sheet. */
export const SHEET_FIELD = "_sheet";

/**
 * Add/edit/detail content shown over the current page (an intercepted route):
 * a side sheet on wide screens, a bottom sheet on phones. A native modal
 * <dialog>, so focus is trapped, the page behind is inert, and Escape closes it.
 * Closing goes back in history, which drops the intercepted URL.
 */
export function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const refreshAfterClose = useRef(false);
  // The @modal slot keeps its last page on soft navigations it doesn't intercept (there's
  // deliberately no catch-all page in the slot), so the sheet hides itself once the URL
  // moves on, e.g. after following a link out of it.
  const pathname = usePathname();
  const [openedAt] = useState(pathname);

  const close = useCallback<SheetApi["close"]>((options) => {
    refreshAfterClose.current = Boolean(options?.refresh);
    dialog.current?.close();
  }, []);
  const api = useMemo(() => ({ close }), [close]);

  if (pathname !== openedAt) return null;

  return (
    <SheetContext.Provider value={api}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the backdrop; keyboard users have Escape (native) and the Close button. */}
      <dialog
        ref={(el) => {
          dialog.current = el;
          if (el && !el.open) el.showModal();
        }}
        aria-labelledby="sheet-title"
        onClose={() => {
          router.back();
          if (refreshAfterClose.current) setTimeout(() => router.refresh(), 0);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close(); // backdrop
        }}
        className="sheet m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-tile border border-border-soft bg-popover p-0 text-popover-foreground shadow-raised backdrop:bg-foreground/35 md:mt-0 md:mr-0 md:ml-auto md:h-dvh md:max-h-dvh md:w-[min(38rem,100vw)] md:rounded-none md:rounded-l-tile"
      >
        <div className="flex max-h-[92dvh] flex-col md:h-full md:max-h-none">
          <header className="flex items-center justify-between gap-3 border-border-soft border-b px-5 py-3">
            <h2 id="sheet-title" className="font-display font-medium text-xl">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </dialog>
    </SheetContext.Provider>
  );
}

/**
 * Put inside a form that can show in a sheet. In a sheet it adds the hidden
 * field (so the action returns instead of redirecting) and, on success, closes
 * the sheet, refreshes the page underneath and confirms with a toast.
 */
export function SheetFormBridge({ state, message }: { state: FormState; message: string }) {
  const sheet = useSheet();
  const toast = useToast();
  // Starts empty: forms remount (key={state}) after each submit, so this mounts already holding the result.
  const handled = useRef<FormState>(null);
  useEffect(() => {
    if (!sheet || !state?.ok || handled.current === state) return;
    handled.current = state;
    toast({ message });
    sheet.close({ refresh: true });
  }, [sheet, state, message, toast]);
  return sheet ? <input type="hidden" name={SHEET_FIELD} value="1" /> : null;
}

/** A form's Cancel: closes the sheet when in one, otherwise a link back. */
export function CancelButton({ href }: { href: string }) {
  const sheet = useSheet();
  if (sheet) {
    return (
      <Button type="button" variant="ghost" onClick={() => sheet.close()}>
        Cancel
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost">
      <Link href={href}>Cancel</Link>
    </Button>
  );
}
