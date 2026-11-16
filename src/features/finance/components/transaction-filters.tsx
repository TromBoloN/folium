"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { shiftMonth } from "../lib/compare-months";
import { filtersHref } from "../lib/filters-href";
import type { TransactionFilters as Filters } from "../schemas";
import { KIND_LABELS, TRANSACTION_KINDS } from "../schemas";

type Option = { id: string; name: string; archived?: boolean };
type CategoryOption = Option & { kind: "expense" | "income"; parentId: string | null };

const BASE = "/money/transactions";

const pill =
  "h-9 rounded-full border border-border bg-surface-1 pl-3 pr-8 text-sm font-medium transition-colors duration-(--dur-fast) hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground";

/**
 * Filters are a plain GET form first: the URL holds them (shareable, back
 * button works) and they apply without JavaScript via the Apply button. With
 * JavaScript, every change applies at once (search is debounced) and Apply hides.
 */
export function TransactionFilters({
  filters,
  accounts,
  categories,
  currentMonth,
}: {
  filters: Filters;
  accounts: Option[];
  categories: CategoryOption[];
  currentMonth: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [js, setJs] = useState(false);
  const [pending, start] = useTransition();
  const debounce = useRef<number | undefined>(undefined);
  const [q, setQ] = useState(filters.q ?? "");
  const typing = useRef(false);
  useEffect(() => setJs(true), []);
  // Keep the box in step with the URL (a removed chip, back button), but not while typing.
  useEffect(() => {
    if (!typing.current) setQ(filters.q ?? "");
  }, [filters.q]);
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const apply = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const next = Object.fromEntries(
      ["q", "account", "category", "kind", "month"].map((k) => [k, String(data.get(k) ?? "").trim() || undefined]),
    ) as Filters;
    start(() => router.replace(filtersHref(next), { scroll: false }));
  };

  const accountName = accounts.find((a) => a.id === filters.account)?.name;
  const categoryName = categories.find((c) => c.id === filters.category)?.name;
  const monthName = filters.month
    ? formatDate(`${filters.month}-01`, {
        month: "long",
        ...(filters.month.slice(0, 4) !== currentMonth.slice(0, 4) ? { year: "numeric" } : {}),
      })
    : null;
  const chips = [
    filters.q ? { key: "q" as const, label: `“${filters.q}”` } : null,
    accountName ? { key: "account" as const, label: accountName } : null,
    categoryName ? { key: "category" as const, label: categoryName } : null,
    filters.kind ? { key: "kind" as const, label: KIND_LABELS[filters.kind] } : null,
    monthName ? { key: "month" as const, label: monthName } : null,
  ].filter((c) => c !== null);

  const month = filters.month;
  const prevMonth = month ? shiftMonth(month, -1) : currentMonth;
  const nextMonth = month && month < currentMonth ? shiftMonth(month, 1) : null;
  const arrow =
    "flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95";

  return (
    <div className="flex flex-col gap-3" aria-busy={pending || undefined}>
      <search>
        <form
          ref={formRef}
          action={BASE}
          method="get"
          aria-label="Filter transactions"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          onChange={(e) => {
            if ((e.target as HTMLElement).getAttribute("name") === "q") return;
            apply();
          }}
          className="flex flex-col gap-3"
        >
          <div className="relative">
            <label htmlFor="q" className="sr-only">
              Search payee or note
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="q"
              name="q"
              type="search"
              value={q}
              placeholder="Search payee or note"
              autoComplete="off"
              onFocus={() => {
                typing.current = true;
              }}
              onBlur={() => {
                typing.current = false;
              }}
              onChange={(e) => {
                setQ(e.target.value);
                window.clearTimeout(debounce.current);
                debounce.current = window.setTimeout(apply, 300);
              }}
              className="h-11 w-full rounded-full border border-border bg-surface-1 pr-4 pl-10 text-base shadow-tile outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="f-account">
              Account
            </label>
            <select
              key={filters.account ?? ""}
              id="f-account"
              name="account"
              defaultValue={filters.account ?? ""}
              data-active={!!filters.account}
              className={pill}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="f-category">
              Category
            </label>
            <select
              key={filters.category ?? ""}
              id="f-category"
              name="category"
              defaultValue={filters.category ?? ""}
              data-active={!!filters.category}
              className={pill}
            >
              <option value="">All categories</option>
              {(["expense", "income"] as const).map((kind) => (
                <optgroup key={kind} label={kind === "expense" ? "Expense" : "Income"}>
                  {categories
                    .filter((c) => c.kind === kind && !c.parentId)
                    .flatMap((p) => [p, ...categories.filter((c) => c.parentId === p.id)])
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parentId ? `· ${c.name}` : c.name}
                        {c.archived ? " (archived)" : ""}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <label className="sr-only" htmlFor="f-kind">
              Kind
            </label>
            <select
              key={filters.kind ?? ""}
              id="f-kind"
              name="kind"
              defaultValue={filters.kind ?? ""}
              data-active={!!filters.kind}
              className={pill}
            >
              <option value="">All kinds</option>
              {TRANSACTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>

            <input type="hidden" name="month" value={filters.month ?? ""} />
            <nav aria-label="Month" className="flex items-center rounded-full border border-border bg-surface-1">
              <Link
                href={filtersHref(filters, { month: prevMonth })}
                scroll={false}
                className={arrow}
                aria-label={month ? "Previous month" : "This month"}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
              <span className={cn("min-w-24 px-1 text-center font-medium text-sm", !month && "text-muted-foreground")}>
                {monthName ?? "All months"}
              </span>
              {nextMonth ? (
                <Link
                  href={filtersHref(filters, { month: nextMonth })}
                  scroll={false}
                  className={arrow}
                  aria-label="Next month"
                >
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              ) : (
                <span aria-hidden className={cn(arrow, "pointer-events-none opacity-40")}>
                  <ChevronRight className="size-4" />
                </span>
              )}
            </nav>

            {js ? null : (
              <Button type="submit" size="sm">
                Apply
              </Button>
            )}
          </div>
        </form>
      </search>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link
                href={filtersHref(filters, { [chip.key]: undefined })}
                scroll={false}
                aria-label={`Remove filter: ${chip.label}`}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-accent pr-2 pl-3 text-accent-foreground text-sm transition-transform duration-(--dur-fast) hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-95"
              >
                {chip.label}
                <X aria-hidden className="size-3.5" />
              </Link>
            </li>
          ))}
          {chips.length > 1 ? (
            <li>
              <Link
                href={BASE}
                scroll={false}
                className="rounded-sm px-2 text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              >
                Clear all
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
