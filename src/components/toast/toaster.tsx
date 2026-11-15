"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ToastInput = {
  message: string;
  /** e.g. { label: "Undo", onClick } */
  action?: { label: string; onClick: () => void | Promise<void> };
  tone?: "default" | "error";
  /** ms before it closes by itself; paused while hovered or focused. */
  duration?: number;
  /** A toast with the same key replaces the previous one (e.g. repeated autosaves). */
  key?: string;
};

type Toast = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Show a short message, optionally with one action (usually "Undo"). */
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast needs <Toaster> above it");
  return toast;
}

const MAX = 3;

/**
 * Toasts for the whole signed-in app. One polite live region announces them;
 * the newest sits at the bottom, above the mobile tab bar.
 */
export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback((input: ToastInput) => {
    const id = next.current++;
    setToasts((all) => [...all.filter((t) => !input.key || t.key !== input.key), { ...input, id }].slice(-MAX));
  }, []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end"
      >
        <ol role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 md:w-auto md:items-end">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </ol>
      </section>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const duration = toast.duration ?? 6000;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [paused, duration, onDismiss]);

  return (
    <li
      className={cn(
        "toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border-soft bg-popover py-2.5 pr-2 pl-4 text-popover-foreground text-sm shadow-raised md:w-auto md:min-w-80",
        toast.tone === "error" && "border-destructive/40",
      )}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={cn("min-w-0 flex-1", toast.tone === "error" && "text-destructive")}>{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await toast.action?.onClick();
            } finally {
              onDismiss();
            }
          }}
          className="shrink-0 rounded-md px-2.5 py-1 font-semibold underline underline-offset-4 hover:bg-accent disabled:opacity-60"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}
