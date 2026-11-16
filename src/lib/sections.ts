/**
 * App sections with their own tab bar (School, Money). The paths here are the
 * ONE source for both the sidebar's active state and the section tab bars.
 */

import type { MessageKey } from "@/lib/i18n/core";

export type SectionTab = {
  label: MessageKey;
  href: string;
  /** Also active on nested routes (/courses/[id]); false = exact (Money's Overview). */
  matchPrefix: boolean;
};

/** "/courses/" → "/courses" (the root stays "/"). */
function normalise(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** Is `path` the prefix itself or below it? "/courses-archive" is NOT under "/courses". */
export function isUnder(path: string, prefix: string): boolean {
  const p = normalise(path);
  const base = normalise(prefix);
  if (base === "/") return true;
  return p === base || p.startsWith(`${base}/`);
}

export function tabMatches(path: string, tab: SectionTab): boolean {
  return tab.matchPrefix ? isUnder(path, tab.href) : normalise(path) === normalise(tab.href);
}

/** The active tab's href: the most specific match, or null. */
export function activeTabHref(path: string, tabs: readonly SectionTab[]): string | null {
  const matches = tabs.filter((t) => tabMatches(path, t));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

/** School: Courses, Tasks, Grades (URLs unchanged; the routes live in app/(app)/(school)). */
export const SCHOOL_TABS: readonly SectionTab[] = [
  { label: "Courses", href: "/courses", matchPrefix: true },
  { label: "Tasks", href: "/tasks", matchPrefix: true },
  { label: "Grades", href: "/grades", matchPrefix: true },
];
export const SCHOOL_PATHS = SCHOOL_TABS.map((t) => t.href);
export const isSchoolPath = (path: string) => SCHOOL_PATHS.some((p) => isUnder(path, p));

/** Money: tabs appear only once their page exists. Overview is exact; the rest cover their sub-pages. */
export const MONEY_TABS: readonly SectionTab[] = [
  { label: "Overview", href: "/money", matchPrefix: false },
  { label: "Transactions", href: "/money/transactions", matchPrefix: true },
  { label: "Recurring", href: "/money/recurring", matchPrefix: true },
  { label: "Budgets", href: "/money/budgets", matchPrefix: true },
  { label: "Goals", href: "/money/goals", matchPrefix: true },
  { label: "Debts", href: "/money/debts", matchPrefix: true },
  { label: "Reports", href: "/money/reports", matchPrefix: true },
];
/** Setup pages behind Money's gear menu: they show "Manage" as current. */
export const MONEY_MANAGE_PATHS = ["/money/accounts", "/money/categories", "/money/import"];
export const isMoneyManagePath = (path: string) => MONEY_MANAGE_PATHS.some((p) => isUnder(path, p));
