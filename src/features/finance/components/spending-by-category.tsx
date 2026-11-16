import { PieChart } from "lucide-react";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { formatIdr } from "../lib/format-idr";
import { OTHER, type Slice, UNCATEGORISED } from "../lib/rollup-by-category";

function hrefFor(slice: Slice, month: string) {
  if (slice.id === UNCATEGORISED) return `/money/transactions?category=none&kind=expense&month=${month}`;
  if (slice.id === OTHER) return `/money/transactions?kind=expense&month=${month}`;
  return `/money/transactions?category=${slice.id}&month=${month}`;
}

/** Uncategorised is a light neutral nudge, not a category colour; Other is mid grey. */
function colorOf(slice: Slice) {
  if (slice.id === UNCATEGORISED) return "var(--border)";
  return slice.color ?? "var(--muted-foreground)";
}

/**
 * This month's spending by category: one stacked bar (decorative) and a legend
 * list that carries the numbers. Child categories are already rolled up.
 */
export async function SpendingByCategory({ slices, total, month }: { slices: Slice[]; total: bigint; month: string }) {
  const { t, tl } = await getI18n();
  return (
    <section
      aria-labelledby="spending-h"
      className="tile reveal flex flex-col gap-4 p-5"
      style={{ "--i": 7 } as React.CSSProperties}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="spending-h" className="font-medium">
          {t("Spending by category")}
        </h2>
        {total > 0n ? <span className="text-muted-foreground text-sm tabular-nums">{formatIdr(total)}</span> : null}
      </div>
      {slices.length === 0 ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <PieChart aria-hidden className="size-4" />
          {t("No spending this month yet.")}
        </p>
      ) : (
        <>
          <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {slices.map((s) =>
              s.percent > 0 ? (
                <span
                  key={s.id}
                  className="money-accent h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${s.percent}%`, "--c": colorOf(s) } as React.CSSProperties}
                />
              ) : null,
            )}
          </div>
          <ul className="flex flex-col">
            {slices.map((s) => (
              <li key={s.id}>
                <Link
                  href={hrefFor(s, month)}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-(--dur-fast) hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  <span
                    aria-hidden
                    className="money-accent size-2.5 shrink-0 rounded-full"
                    style={{ "--c": colorOf(s) } as React.CSSProperties}
                  />
                  {s.id === UNCATEGORISED ? (
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="truncate text-muted-foreground">{tl(s.name)}</span>
                      <span className="font-medium text-primary text-xs underline underline-offset-2">
                        {t("Categorise")}
                      </span>
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{s.id === OTHER ? tl(s.name) : s.name}</span>
                  )}
                  <span className="tabular-nums">{formatIdr(s.amount)}</span>
                  <span className="w-10 text-right text-muted-foreground tabular-nums">{s.percent}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
