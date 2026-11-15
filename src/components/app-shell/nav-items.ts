import { BookOpen, GraduationCap, ListChecks, type LucideIcon, Settings, Sun } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** The app's top-level sections, shared by the sidebar and the bottom nav. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
