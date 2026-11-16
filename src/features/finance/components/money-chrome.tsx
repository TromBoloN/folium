"use client";

import { Download, Landmark, Plus, Settings2, Tags } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SectionTabs, tabClass } from "@/components/section-tabs";
import { Button } from "@/components/ui/button";
import { isMoneyManagePath, MONEY_TABS } from "@/lib/sections";
import { cn } from "@/lib/utils";

/** Full-page forms (no-JS fallback for the sheets) get no chrome: they have their own header and back link. */
const isFormPage = (path: string) => path === "/money/new" || /^\/money\/[^/]+\/edit$/.test(path);
const isTab = (path: string) => MONEY_TABS.some((t) => t.href === path.replace(/\/+$/, ""));

/**
 * The shared /money shell: title and actions, a tab bar, and the quick-add bar
 * (on the tabs), so adding works from every tab. The quick-add bar arrives as a
 * server-rendered slot.
 */
export function MoneyChrome({ quick, children }: { quick: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  if (isFormPage(pathname)) return children;
  const tab = isTab(pathname);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {tab ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display font-medium text-3xl tracking-tight md:text-4xl">Money</h1>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/money/new">
                  <Plus aria-hidden />
                  Add transaction
                </Link>
              </Button>
              <ManageMenu />
            </div>
          </div>
        ) : null}
        <SectionTabs
          label="Money"
          items={MONEY_TABS}
          extra={
            isMoneyManagePath(pathname) ? (
              <span aria-current="page" className={cn(tabClass, "border-primary")}>
                <Settings2 aria-hidden className="size-4" />
                Manage
              </span>
            ) : null
          }
        />
      </div>
      {tab ? quick : null}
      {children}
    </div>
  );
}

const menuItem =
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30";

/** Setup, not daily use: accounts, categories, export. A native <details>, so it works without JavaScript. */
function ManageMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) {
        el.open = false;
        if (e instanceof KeyboardEvent) el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label="Manage money"
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-surface-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden"
      >
        <Settings2 aria-hidden className="size-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 flex w-52 flex-col gap-0.5 rounded-xl border border-border-soft bg-popover p-1.5 shadow-raised">
        <Link href="/money/accounts" className={menuItem}>
          <Landmark aria-hidden className="size-4 text-muted-foreground" />
          Accounts
        </Link>
        <Link href="/money/categories" className={menuItem}>
          <Tags aria-hidden className="size-4 text-muted-foreground" />
          Categories
        </Link>
        <Link href="/money/import" className={menuItem}>
          <Download aria-hidden className="size-4 text-muted-foreground" />
          Import and export
        </Link>
      </div>
    </details>
  );
}
