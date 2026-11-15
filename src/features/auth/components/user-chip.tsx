import Link from "next/link";
import { getDisplayName } from "@/features/dashboard/queries";
import { requireUser } from "../queries";

/** Name + initials avatar at the bottom of the sidebar; links to settings. */
export async function UserChip() {
  const [user, name] = await Promise.all([requireUser(), getDisplayName()]);
  const label = name ?? user.email ?? "You";
  const initials =
    label
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  return (
    <Link href="/settings" className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sidebar-active">
      <span className="sr-only">Account settings: </span>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display font-medium text-primary-foreground text-sm"
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-medium text-sm">{label}</span>
        {name && user.email ? <span className="truncate text-muted-foreground text-xs">{user.email}</span> : null}
      </span>
    </Link>
  );
}

export function UserChipSkeleton() {
  return (
    <div role="status" aria-label="Loading account" className="flex items-center gap-3 p-2">
      <span className="size-9 animate-pulse rounded-full bg-muted" />
      <span className="h-4 w-24 animate-pulse rounded bg-muted" />
    </div>
  );
}
