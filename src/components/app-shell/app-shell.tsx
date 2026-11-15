import Link from "next/link";
import { Suspense } from "react";
import { UserChip, UserChipSkeleton } from "@/features/auth/components/user-chip";
import { AddFab, SearchButton } from "@/features/search/components/palette-buttons";
import { PaletteProvider } from "@/features/search/components/palette-provider";
import { ClientData } from "@/features/tasks/components/client-data";
import { TaskOpsProvider } from "@/features/tasks/components/task-ops";
import { LeafMark } from "../leaf-mark";
import { Ambient } from "../motion/ambient";
import { MotionRuntime } from "../motion/motion-runtime";
import { PwaRuntime } from "../pwa/pwa-runtime";
import { Toaster } from "../toast/toaster";
import { BottomNav, SidebarNav } from "./app-nav";
import { PageTransition } from "./page-transition";

export function AppShell({ children, modal }: { children: React.ReactNode; modal?: React.ReactNode }) {
  return (
    <Toaster>
      <TaskOpsProvider>
        <PaletteProvider>
          <div className="min-h-svh">
            <Ambient />
            <Suspense fallback={null}>
              <ClientData />
            </Suspense>
            <MotionRuntime />
            <PwaRuntime />
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-sidebar-border border-r bg-sidebar px-3 py-5 text-sidebar-foreground md:flex">
              <Link href="/" className="flex items-center gap-2 px-3 font-display font-medium text-2xl tracking-tight">
                <LeafMark className="size-7 text-primary" />
                Folium
              </Link>
              <SearchButton />
              <SidebarNav />
              <div className="mt-auto border-sidebar-border border-t pt-3">
                <Suspense fallback={<UserChipSkeleton />}>
                  <UserChip />
                </Suspense>
              </div>
            </aside>
            <div className="pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-60">
              {/* Uses the width beside the sidebar; pages lay out their own columns, and forms keep a reading width. */}
              <main className="mx-auto w-full max-w-[90rem] px-4 py-6 md:px-8 md:py-10 xl:px-10">
                <PageTransition>{children}</PageTransition>
              </main>
            </div>
            {modal}
            <AddFab />
            <BottomNav />
          </div>
        </PaletteProvider>
      </TaskOpsProvider>
    </Toaster>
  );
}
