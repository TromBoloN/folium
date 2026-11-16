"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CommandPalette, type PaletteMode } from "./command-palette";

const PaletteContext = createContext<((mode: PaletteMode) => void) | null>(null);

/** Opens the command palette: "add" for a new task, "search" to find and go. */
export function useOpenPalette() {
  const open = useContext(PaletteContext);
  if (!open) throw new Error("useOpenPalette needs <PaletteProvider> above it");
  return open;
}

/** True while the user is typing somewhere, so single-key shortcuts stay out of the way. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Keyboard shortcuts for the whole app:
 * - Ctrl/⌘ K: search and commands
 * - N: add a task (when not typing in a field); on Money pages, add a transaction
 */
export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PaletteMode | null>(null);
  const open = useCallback((m: PaletteMode) => setMode(m), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        setMode((m) => (m ? null : "search"));
        return;
      }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target) && !e.repeat) {
        if (document.querySelector("dialog[open]")) return;
        e.preventDefault();
        // On /money the quick-add bar is always there: N focuses it instead of opening a box.
        const bar = document.getElementById("quick-add-input");
        if (bar) {
          bar.focus();
          return;
        }
        setMode(window.location.pathname.startsWith("/money") ? "money" : "add");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => open, [open]);
  return (
    <PaletteContext.Provider value={value}>
      {children}
      {mode ? <CommandPalette initialMode={mode} onClose={() => setMode(null)} /> : null}
    </PaletteContext.Provider>
  );
}
