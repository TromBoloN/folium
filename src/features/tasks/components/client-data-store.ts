"use client";

import { useSyncExternalStore } from "react";

/** Small, serialisable facts the client needs app-wide (course picker, quick-add parsing). */
export type ClientData = {
  courses: { id: string; name: string; code: string | null; color: string; archived: boolean }[];
  timeZone: string;
  weekStart: "monday" | "sunday" | "saturday";
  timeFormat: "24h" | "12h";
};

/**
 * A tiny external store rather than React context: the data arrives just after
 * the page starts hydrating, and a context update would force React to throw
 * away the server HTML of every Suspense boundary still hydrating (it re-renders
 * them on the client). Components only subscribe once hydrated, so this can't.
 */
let current: ClientData | null = null;
let currentKey = "";
const listeners = new Set<() => void>();

export function setClientData(data: ClientData) {
  const key = JSON.stringify(data);
  if (key === currentKey) return;
  current = data;
  currentKey = key;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Courses and preferences for client-side task tools; null until loaded. */
export function useClientData(): ClientData | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
