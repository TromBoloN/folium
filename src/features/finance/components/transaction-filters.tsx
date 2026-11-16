import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Account, Category } from "../queries";
import { type TransactionFilters as Filters, KIND_LABELS, TRANSACTION_KINDS } from "../schemas";

/**
 * Filters are a plain GET form: the URL holds them (shareable, back button
 * works) and they apply without JavaScript.
 */
export function TransactionFilters({
  filters,
  accounts,
  categories,
}: {
  filters: Filters;
  accounts: Account[];
  categories: Category[];
}) {
  const active = Object.values(filters).some(Boolean);
  return (
    <form action="/money/transactions" method="get" className="tile grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="q">Search</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Payee or note"
            className="pl-9"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="account">Account</Label>
        <NativeSelect id="account" name="account" defaultValue={filters.account ?? ""}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.archived ? " (archived)" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="category">Category</Label>
        <NativeSelect id="category" name="category" defaultValue={filters.category ?? ""}>
          <option value="">All categories</option>
          {(["expense", "income"] as const).map((kind) => (
            <optgroup key={kind} label={kind === "expense" ? "Expense" : "Income"}>
              {categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.archived ? " (archived)" : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="kind">Kind</Label>
        <NativeSelect id="kind" name="kind" defaultValue={filters.kind ?? ""}>
          <option value="">All kinds</option>
          {TRANSACTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="month">Month</Label>
        <Input id="month" name="month" type="month" defaultValue={filters.month ?? ""} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        {active ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/money/transactions">Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
