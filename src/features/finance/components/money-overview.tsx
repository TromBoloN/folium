import { ArrowDownLeft, ArrowUpRight, Banknote, Building2, PiggyBank, Wallet } from "lucide-react";
import Link from "next/link";
import { Tile } from "@/components/ui/tile";
import { cn } from "@/lib/utils";
import { formatIdr } from "../lib/format-idr";
import type { Account } from "../queries";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "../schemas";
import { MoneyCountUp } from "./money-count-up";

export const ACCOUNT_ICONS: Record<AccountType, typeof Wallet> = {
  bank: Building2,
  ewallet: Wallet,
  cash: Banknote,
  savings: PiggyBank,
};

/** One card per active account: name, type and its balance (from account_balances). */
export function AccountCards({ accounts }: { accounts: Account[] }) {
  const active = accounts.filter((a) => !a.archived);
  const total = active.reduce((sum, a) => sum + a.balance, 0n);
  return (
    <section aria-labelledby="accounts-h" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="accounts-h" className="font-medium">
          Accounts
        </h2>
        <p className="text-muted-foreground text-sm">
          Total <span className="font-medium text-foreground tabular-nums">{formatIdr(total)}</span>
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {active.map((a, i) => {
          const Icon = ACCOUNT_ICONS[a.type];
          return (
            <li key={a.id}>
              <Tile
                as={Link}
                href={`/money/transactions?account=${a.id}`}
                tint={a.color}
                reveal={i}
                spotlight
                className="flex h-full flex-col gap-3 overflow-hidden p-4 pl-5 transition-transform duration-(--dur-fast) hover:-translate-y-0.5"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-(--tint)" />
                <span className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="truncate font-medium text-foreground">{a.name}</span>
                  {/* The link's name is its visible text plus this (no aria-label: it must contain what's shown). */}
                  <span className="sr-only">, {ACCOUNT_TYPE_LABELS[a.type]}, balance</span>
                </span>
                <span
                  data-testid={`balance-${a.id}`}
                  className={cn(
                    "font-display font-medium text-xl leading-none sm:text-2xl",
                    a.balance < 0n && "text-destructive",
                  )}
                >
                  <MoneyCountUp amount={a.balance.toString()} />
                </span>
              </Tile>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** This month's money in and out (posted income and expenses; transfers and adjustments excluded). */
export function MonthTotals({ income, expense, label }: { income: bigint; expense: bigint; label: string }) {
  const net = income - expense;
  return (
    <section aria-labelledby="month-h" className="flex flex-col gap-3">
      <h2 id="month-h" className="font-medium">
        This month <span className="font-normal text-muted-foreground text-sm">· {label}</span>
      </h2>
      <dl className="grid grid-cols-3 gap-3">
        {[
          { term: "In", value: income, icon: ArrowDownLeft, tone: "text-primary" },
          { term: "Out", value: expense, icon: ArrowUpRight, tone: "text-destructive" },
          { term: "Net", value: net, icon: null, tone: net < 0n ? "text-destructive" : "" },
        ].map((item, i) => (
          <Tile key={item.term} reveal={i + 4} className="flex flex-col gap-1 p-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground text-sm">
              {item.icon ? <item.icon aria-hidden className={cn("size-4", item.tone)} /> : null}
              {item.term}
            </dt>
            <dd className={cn("font-display font-medium text-lg leading-tight sm:text-xl", item.tone)}>
              <MoneyCountUp amount={item.value.toString()} />
            </dd>
          </Tile>
        ))}
      </dl>
    </section>
  );
}
