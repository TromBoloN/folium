import { isUnder } from "@/lib/sections";

/** The app area a page belongs to, rendered as `<main data-area>` so theme packs can style each area. */
export type PageArea = "today" | "courses" | "tasks" | "grades" | "money" | "settings" | "other";

const AREAS: [string, PageArea][] = [
  ["/courses", "courses"],
  ["/tasks", "tasks"],
  ["/grades", "grades"],
  ["/money", "money"],
  ["/settings", "settings"],
  ["/themes", "settings"],
];

export function pageArea(path: string): PageArea {
  if (path === "/") return "today";
  return AREAS.find(([prefix]) => isUnder(path, prefix))?.[1] ?? "other";
}
