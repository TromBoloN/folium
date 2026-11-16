import { GraduationCap, type LucideIcon, Palette, Settings, Sun, Wallet } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/core";
import { isUnder, SCHOOL_PATHS } from "@/lib/sections";

export type NavItem = {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Paths that light this item up (default: its own href and below). */
  match?: readonly string[];
};

/** The app's top-level sections, shared by the sidebar and the bottom nav. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Sun },
  // School = Courses, Tasks and Grades (one tab bar inside); opens on Courses.
  { href: "/courses", label: "School", icon: GraduationCap, match: SCHOOL_PATHS },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/themes", label: "Themes", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, item: NavItem | string) {
  const { href, match } = typeof item === "string" ? { href: item, match: undefined } : item;
  if (href === "/") return pathname === "/";
  return (match ?? [href]).some((p) => isUnder(pathname, p));
}
