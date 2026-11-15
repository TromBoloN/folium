import Link from "next/link";
import { BottomNav, SidebarNav } from "./app-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-sidebar-border border-r bg-sidebar px-3 py-5 text-sidebar-foreground md:flex">
        <Link href="/" className="px-3 font-semibold text-lg tracking-tight">
          Folium
        </Link>
        <SidebarNav />
      </aside>
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-60">
        {/* Reading width by default; pages that need room (the week grid) mark content with data-wide. */}
        <main className="mx-auto w-full max-w-3xl px-4 py-6 has-[[data-wide]]:max-w-6xl md:px-8 md:py-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
