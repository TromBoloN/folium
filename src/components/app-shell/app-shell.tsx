import Link from "next/link";
import { Suspense } from "react";
import { UserChip, UserChipSkeleton } from "@/features/auth/components/user-chip";
import { LeafMark } from "../leaf-mark";
import { Ambient } from "../motion/ambient";
import { MotionRuntime } from "../motion/motion-runtime";
import { BottomNav, SidebarNav } from "./app-nav";
import { PageTransition } from "./page-transition";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <Ambient />
      <MotionRuntime />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-8 border-sidebar-border border-r bg-sidebar px-3 py-5 text-sidebar-foreground md:flex">
        <Link href="/" className="flex items-center gap-2 px-3 font-display font-medium text-2xl tracking-tight">
          <LeafMark className="size-7 text-primary" />
          Folium
        </Link>
        <SidebarNav />
        <div className="mt-auto border-sidebar-border border-t pt-3">
          <Suspense fallback={<UserChipSkeleton />}>
            <UserChip />
          </Suspense>
        </div>
      </aside>
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-60">
        {/* Reading width by default; pages that need room (dashboard, week grid) mark content with data-wide. */}
        <main className="mx-auto w-full max-w-3xl px-4 py-6 has-[[data-wide]]:max-w-6xl md:px-8 md:py-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
