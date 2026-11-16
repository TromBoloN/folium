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
 *
 * Module state lives as long as the process. In the browser that's one user's
 * tab; on the server it would be shared by every request, so the store refuses
 * to hold anything there (it's filled from an effect, which never runs on the
 * server, and `setClientData` ignores server calls as a second guard), and the
 * server snapshot is always empty.
 */
let current: ClientData | null = null;
let currentKey = "";
const listeners = new Set<() => void>();

const onServer = () => typeof window === "undefined";

export function setClientData(data: ClientData) {
  if (onServer()) return;
  const key = JSON.stringify(data);
  if (key === currentKey) return;
  current = data;
  currentKey = key;
  for (const listener of listeners) listener();
}

export function subscribeClientData(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getClientDataSnapshot(): ClientData | null {
  return onServer() ? null : current;
}

/** What server rendering and hydration see: always nothing. */
export function getServerClientDataSnapshot(): ClientData | null {
  return null;
}

/** Courses and preferences for client-side task tools; null until loaded (and always on the server). */
export function useClientData(): ClientData | null {
  return useSyncExternalStore(subscribeClientData, getClientDataSnapshot, getServerClientDataSnapshot);
}
